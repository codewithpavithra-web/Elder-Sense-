from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler

from extensions import db
from models import (
    Medication,
    MedicationSchedule,
    MedicationLog,
    CaregiverElderLink,
    CaregiverProfile,
    Notification,
    User,
    ElderProfile,
)


# =========================================================
# CONFIGURATION
# =========================================================

GRACE_MINUTES = 5
CHECK_INTERVAL_SECONDS = 30


# =========================================================
# MISSED MEDICATION CHECK
# =========================================================

def check_missed_medications(app):
    """
    Automatically detects medication doses that were not marked
    as taken within the configured grace period.

    This backend scheduler is separate from the frontend:
    - Frontend reminder: immediate reminder + 5-minute follow-up
    - Backend scheduler: caregiver notification and missed detection after the 5-minute grace period

    The backend scheduler continues to work even if the user
    does not interact with the reminder popup.
    """

    with app.app_context():
        now = datetime.now()

        schedules = (
            MedicationSchedule.query
            .filter_by(is_active=True)
            .all()
        )

        for schedule in schedules:

            # -------------------------------------------------
            # SAFETY: schedule must have a time
            # -------------------------------------------------

            if not schedule.time:
                continue

            # -------------------------------------------------
            # FIND MEDICATION
            # -------------------------------------------------

            medication = db.session.get(
                Medication,
                schedule.medication_id
            )

            if not medication:
                continue

            if not medication.is_active:
                continue
            if medication.start_date and now.date() < medication.start_date:
                continue
            if medication.end_date and now.date() > medication.end_date:
                continue

            # -------------------------------------------------
            # REMINDER SETTING
            # -------------------------------------------------

            reminder_enabled = bool(
                getattr(
                    schedule,
                    "reminder_enabled",
                    True
                )
            )

            # -------------------------------------------------
            # CREATE TODAY'S SCHEDULED DATETIME
            # -------------------------------------------------

            scheduled_at = datetime.combine(
                now.date(),
                schedule.time
            )

            # -------------------------------------------------
            # ONLY PROCESS AFTER GRACE PERIOD
            # -------------------------------------------------

            missed_after = (
                scheduled_at
                + timedelta(minutes=GRACE_MINUTES)
            )

            if now < missed_after:
                continue

            # -------------------------------------------------
            # CHECK EXISTING LOG
            # -------------------------------------------------

            existing_log = (
                MedicationLog.query
                .filter_by(
                    schedule_id=schedule.id,
                    scheduled_at=scheduled_at
                )
                .first()
            )

            # -------------------------------------------------
            # ALREADY PROCESSED
            # -------------------------------------------------

            if existing_log:
                continue

            # -------------------------------------------------
            # FIND ELDER
            # -------------------------------------------------

            elder_profile = db.session.get(
                ElderProfile,
                medication.elder_id
            )

            if not elder_profile:
                continue

            elder_user = db.session.get(
                User,
                elder_profile.user_id
            )

            elder_name = (
                elder_user.full_name
                if elder_user
                else "Your linked elder"
            )

            # -------------------------------------------------
            # CREATE MISSED LOG
            # -------------------------------------------------

            missed_log = MedicationLog(
                medication_id=medication.id,
                schedule_id=schedule.id,
                scheduled_at=scheduled_at,
                status="MISSED",
                notes=(
                    "Automatically marked missed "
                    "after the 5-minute grace period."
                ),
            )

            # If the model contains missed_reason, leave it
            # empty because the system automatically detected
            # the missed dose.
            if hasattr(missed_log, "missed_reason"):
                missed_log.missed_reason = None

            db.session.add(missed_log)
            db.session.flush()

            # -------------------------------------------------
            # REMINDER OFF
            # -------------------------------------------------
            #
            # If reminder is disabled, do not create a
            # caregiver medication-missed notification.
            #
            # The automatic log is still created so medication
            # history and adherence remain accurate.
            #

            if not reminder_enabled:
                continue

            # -------------------------------------------------
            # FIND LINKED CAREGIVERS
            # -------------------------------------------------

            links = (
                CaregiverElderLink.query
                .filter_by(
                    elder_id=elder_profile.id,
                    is_active=True
                )
                .all()
            )

            # -------------------------------------------------
            # DETERMINE TIME PERIOD
            # -------------------------------------------------

            current_hour = scheduled_at.hour

            if current_hour < 12:
                time_period = "morning"
            elif current_hour < 17:
                time_period = "afternoon"
            elif current_hour < 21:
                time_period = "evening"
            else:
                time_period = "night"

            # -------------------------------------------------
            # CREATE CAREGIVER NOTIFICATIONS
            # -------------------------------------------------

            for link in links:

                caregiver = db.session.get(
                    CaregiverProfile,
                    link.caregiver_id
                )

                if not caregiver:
                    continue

                caregiver_user = db.session.get(
                    User,
                    caregiver.user_id
                )

                if not caregiver_user:
                    continue

                # -------------------------------------------------
                # DUPLICATE PROTECTION
                # -------------------------------------------------

                existing_notification = (
                    Notification.query
                    .filter_by(
                        user_id=caregiver.user_id,
                        notification_type="MEDICATION_MISSED"
                    )
                    .filter(
                        Notification.message.contains(
                            medication.name
                        )
                    )
                    .filter(
                        Notification.message.contains(
                            elder_name
                        )
                    )
                    .filter(
                        Notification.created_at >= scheduled_at
                    )
                    .first()
                )

                if existing_notification:
                    continue

                # -------------------------------------------------
                # CREATE NOTIFICATION
                # -------------------------------------------------

                notification = Notification(
                    user_id=caregiver.user_id,
                    title="Missed Medication Alert 🔔",
                    message=(
                        f"{elder_name} missed the "
                        f"{time_period} medication "
                        f"({medication.name}). "
                        f"Please check on the elder."
                    ),
                    notification_type="MEDICATION_MISSED",
                    is_read=False,
                )

                db.session.add(notification)

        # -----------------------------------------------------
        # COMMIT ALL CHANGES
        # -----------------------------------------------------

        try:
            db.session.commit()

        except Exception:
            db.session.rollback()
            raise


# =========================================================
# START SCHEDULER
# =========================================================

def start_medication_scheduler(app):
    """
    Starts the background medication checker.

    Runs every 30 seconds and automatically marks a dose
    MISSED after the configured 5-minute grace period.
    """

    scheduler = BackgroundScheduler()

    scheduler.add_job(
        check_missed_medications,
        "interval",
        seconds=CHECK_INTERVAL_SECONDS,
        args=[app],
        id="medication_missed_checker",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()

    print(
        "Medication scheduler started "
        f"(checks every {CHECK_INTERVAL_SECONDS} seconds; "
        f"{GRACE_MINUTES}-minute grace period)."
    )

    return scheduler