import csv
import io
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models import (
    User,
    CaregiverProfile,
    CaregiverElderLink,
    ElderProfile,
    Vital,
    Medication,
    MedicationSchedule,
    MedicationLog,
    HealthAssessment,
    Notification,
    ConnectionRequest,
)


caregiver_bp = Blueprint(
    "caregiver",
    __name__,
    url_prefix="/api/caregiver"
)


# -------------------------------------------------------------------
# AUTHENTICATION
# -------------------------------------------------------------------

def get_current_caregiver():
    identity = get_jwt_identity()

    if not identity:
        return None, None, (
            jsonify({
                "success": False,
                "message": "Authentication required."
            }),
            401,
        )

    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        return None, None, (
            jsonify({
                "success": False,
                "message": "Invalid authentication token."
            }),
            401,
        )

    user = db.session.get(
        User,
        user_id
    )

    if not user:
        return None, None, (
            jsonify({
                "success": False,
                "message": "User not found."
            }),
            404,
        )

    if user.role != "CAREGIVER":
        return None, None, (
            jsonify({
                "success": False,
                "message": "Caregiver access required."
            }),
            403,
        )

    caregiver = CaregiverProfile.query.filter_by(
        user_id=user.id
    ).first()

    if not caregiver:
        return None, None, (
            jsonify({
                "success": False,
                "message": "Caregiver profile not found."
            }),
            404,
        )

    return user, caregiver, None


# -------------------------------------------------------------------
# HELPERS
# -------------------------------------------------------------------

def format_time(value):
    if not value:
        return None

    return value.strftime("%H:%M")


def format_datetime(value):
    if not value:
        return None

    return value.strftime(
        "%Y-%m-%dT%H:%M:%S"
    )


def display_time(value):
    if not value:
        return ""

    return value.strftime(
        "%I:%M %p"
    ).lstrip("0")


def serialize_schedule(schedule):
    return {
        "id": schedule.id,
        "time": format_time(schedule.time),
        "dose_amount": schedule.dose_amount,
        "instructions": schedule.instructions,
        "is_active": bool(schedule.is_active),
        "reminder_enabled": bool(
            schedule.reminder_enabled
            if schedule.reminder_enabled is not None
            else True
        ),
    }


def serialize_medication(medication):
    schedules = [
        schedule
        for schedule in medication.schedules
        if schedule.is_active
    ]

    schedules.sort(
        key=lambda schedule: schedule.time
    )

    return {
        "id": medication.id,
        "name": medication.name,
        "dosage": medication.dosage,
        "form": medication.form,
        "purpose": medication.purpose,
        "instructions": medication.instructions,
        "start_date": (
            medication.start_date.isoformat()
            if medication.start_date
            else None
        ),
        "end_date": (
            medication.end_date.isoformat()
            if medication.end_date
            else None
        ),
        "is_active": bool(
            medication.is_active
        ),
        "photo_path": medication.photo_path,
        "photo_url": (
            f"/api/medications/photos/"
            f"{medication.photo_path}"
            if medication.photo_path
            else None
        ),
        "schedules": [
            serialize_schedule(schedule)
            for schedule in schedules
        ],
    }


def serialize_log(log):
    medication = db.session.get(
        Medication,
        log.medication_id
    )

    schedule = db.session.get(
        MedicationSchedule,
        log.schedule_id
    )

    return {
        "id": log.id,
        "medication_id": log.medication_id,
        "medication_name": (
            medication.name
            if medication
            else "Unknown medicine"
        ),
        "dosage": (
            medication.dosage
            if medication
            else None
        ),
        "schedule_id": log.schedule_id,
        "scheduled_at": format_datetime(
            log.scheduled_at
        ),
        "scheduled_time": (
            format_time(schedule.time)
            if schedule
            else None
        ),
        "scheduled_display": (
            display_time(log.scheduled_at)
            if log.scheduled_at
            else ""
        ),
        "taken_at": format_datetime(
            log.taken_at
        ),
        "taken_display": (
            display_time(log.taken_at)
            if log.taken_at
            else None
        ),
        "status": log.status,
        "notes": log.notes,
        "missed_reason": log.missed_reason,
    }


def has_elder_access(
    caregiver,
    elder_id
):
    return CaregiverElderLink.query.filter_by(
        caregiver_id=caregiver.id,
        elder_id=elder_id,
        is_active=True
    ).first() is not None


def get_elder(
    caregiver,
    elder_id
):
    if not has_elder_access(
        caregiver,
        elder_id
    ):
        return None

    return db.session.get(
        ElderProfile,
        elder_id
    )


# -------------------------------------------------------------------
# ADHERENCE CALCULATION
# -------------------------------------------------------------------

def calculate_adherence(
    elder,
    days=7
):
    try:
        days = int(days)
    except (TypeError, ValueError):
        days = 7

    days = max(
        1,
        min(days, 90)
    )

    now = datetime.now()

    start_date = (
        now.date()
        - timedelta(days=days - 1)
    )

    medications = (
        Medication.query
        .filter_by(
            elder_id=elder.id,
            is_active=True
        )
        .all()
    )

    taken = 0
    missed = 0
    pending = 0

    daily = []

    for offset in range(days):
        current_date = (
            start_date
            + timedelta(days=offset)
        )

        day_taken = 0
        day_missed = 0
        day_total = 0

        for medication in medications:

            if (
                medication.start_date
                and current_date < medication.start_date
            ):
                continue

            if (
                medication.end_date
                and current_date > medication.end_date
            ):
                continue

            for schedule in medication.schedules:

                if (
                    not schedule.is_active
                    or not schedule.time
                ):
                    continue

                scheduled_at = datetime.combine(
                    current_date,
                    schedule.time
                )

                if scheduled_at > now:
                    continue

                day_total += 1

                log = MedicationLog.query.filter_by(
                    schedule_id=schedule.id,
                    scheduled_at=scheduled_at
                ).first()

                if log:
                    status = (
                        str(log.status)
                        .upper()
                        if log.status
                        else ""
                    )

                    if status == "TAKEN":
                        taken += 1
                        day_taken += 1

                    elif status in {
                        "MISSED",
                        "SKIPPED"
                    }:
                        missed += 1
                        day_missed += 1

                    else:
                        pending += 1

                else:
                    if now >= (
                        scheduled_at
                        + timedelta(minutes=15)
                    ):
                        missed += 1
                        day_missed += 1
                    else:
                        pending += 1

        daily.append({
            "date": current_date.isoformat(),
            "label": current_date.strftime("%a"),
            "taken": day_taken,
            "missed": day_missed,
            "total": day_total,
        })

    completed = taken + missed

    percentage = (
        round(
            (taken / completed) * 100,
            1
        )
        if completed
        else 0
    )

    return {
        "days": days,
        "percentage": percentage,
        "taken": taken,
        "missed": missed,
        "total": completed,
        "pending": pending,
        "daily": daily,
    }


def calculate_streak(elder):
    now = datetime.now()

    medications = (
        Medication.query
        .filter_by(
            elder_id=elder.id,
            is_active=True
        )
        .all()
    )

    if not medications:
        return {
            "streak": 0,
            "message": "No medication streak yet."
        }

    streak = 0
    current_date = now.date()

    for _ in range(365):

        day_total = 0
        day_taken = 0

        for medication in medications:

            if (
                medication.start_date
                and current_date < medication.start_date
            ):
                continue

            if (
                medication.end_date
                and current_date > medication.end_date
            ):
                continue

            for schedule in medication.schedules:

                if (
                    not schedule.is_active
                    or not schedule.time
                ):
                    continue

                scheduled_at = datetime.combine(
                    current_date,
                    schedule.time
                )

                if scheduled_at > now:
                    continue

                day_total += 1

                log = MedicationLog.query.filter_by(
                    schedule_id=schedule.id,
                    scheduled_at=scheduled_at
                ).first()

                if (
                    log
                    and str(log.status).upper()
                    == "TAKEN"
                ):
                    day_taken += 1

        if day_total == 0:
            current_date -= timedelta(days=1)
            continue

        if day_taken == day_total:
            streak += 1
            current_date -= timedelta(days=1)
        else:
            break

    if streak == 0:
        message = "Start your medication streak today."
    elif streak == 1:
        message = "1 day on track!"
    else:
        message = f"{streak} days on track!"

    return {
        "streak": streak,
        "message": message,
    }


# -------------------------------------------------------------------
# CAREGIVER PROFILE
# -------------------------------------------------------------------

@caregiver_bp.get("/profile")
@jwt_required()
def caregiver_profile():
    user, caregiver, error = get_current_caregiver()

    if error:
        return error

    return jsonify({
        "success": True,
        "profile": {
            "id": caregiver.id,
            "user_id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone,
            "relationship_to_elder": (
                caregiver.relationship_to_elder
            ),
            "role": user.role,
        },
    })


# -------------------------------------------------------------------
# LINKED ELDERS & PERMANENT REMOVAL
# -------------------------------------------------------------------

@caregiver_bp.get("/elders")
@jwt_required()
def get_linked_elders():
    user, caregiver, error = get_current_caregiver()

    if error:
        return error

    links = (
        CaregiverElderLink.query
        .filter_by(
            caregiver_id=caregiver.id,
            is_active=True
        )
        .all()
    )

    result = []

    for link in links:

        elder = db.session.get(
            ElderProfile,
            link.elder_id
        )

        if not elder:
            continue

        elder_user = db.session.get(
            User,
            elder.user_id
        )

        latest_vital = (
            Vital.query
            .filter_by(
                elder_id=elder.id
            )
            .order_by(
                Vital.recorded_at.desc()
            )
            .first()
        )

        latest_assessment = (
            HealthAssessment.query
            .filter_by(
                elder_id=elder.id
            )
            .order_by(
                HealthAssessment.created_at.desc()
            )
            .first()
        )

        active_medication_count = (
            Medication.query
            .filter_by(
                elder_id=elder.id,
                is_active=True
            )
            .count()
        )

        adherence = calculate_adherence(
            elder,
            7
        )

        streak = calculate_streak(
            elder
        )

        result.append({
            "id": elder.id,
            "elder_id": elder.id,
            "name": (
                elder_user.full_name
                if elder_user
                else "Unknown elder"
            ),
            "full_name": (
                elder_user.full_name
                if elder_user
                else "Unknown elder"
            ),
            "email": (
                elder_user.email
                if elder_user
                else None
            ),
            "gender": elder.gender,
            "blood_group": elder.blood_group,
            "phone": (
                elder_user.phone
                if elder_user
                else None
            ),
            "active_medication_count": (
                active_medication_count
            ),
            "medication_adherence": (
                adherence["percentage"]
            ),
            "medication_streak": (
                streak["streak"]
            ),
            "latest_vital": (
                {
                    "heart_rate": latest_vital.heart_rate,
                    "oxygen_level": latest_vital.oxygen_level,
                    "blood_pressure": latest_vital.blood_pressure,
                    "systolic": (latest_vital.blood_pressure.split("/", 1)[0] if latest_vital.blood_pressure and "/" in latest_vital.blood_pressure else None),
                    "diastolic": (latest_vital.blood_pressure.split("/", 1)[1] if latest_vital.blood_pressure and "/" in latest_vital.blood_pressure else None),
                    "temperature": latest_vital.temperature,
                    "recorded_at": format_datetime(
                        latest_vital.recorded_at
                    ),
                }
                if latest_vital
                else None
            ),
            "latest_assessment": (
                {
                    "risk_level": (
                        latest_assessment.risk_level
                    ),
                    "risk_score": (
                        latest_assessment.risk_score
                    ),
                    "summary": (
                        latest_assessment.summary
                    ),
                    "created_at": format_datetime(
                        latest_assessment.created_at
                    ),
                }
                if latest_assessment
                else None
            ),
        })

    return jsonify({
        "success": True,
        "elders": result,
    })


@caregiver_bp.route("/elders/<int:elder_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def remove_linked_elder(elder_id):
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    user, caregiver, error = get_current_caregiver()
    if error:
        return error

    try:
        # Permanently delete all caregiver-elder links (active or inactive)
        links = CaregiverElderLink.query.filter_by(
            caregiver_id=caregiver.id,
            elder_id=elder_id
        ).all()
        for link in links:
            db.session.delete(link)

        # Clean up any related connection requests (either direction)
        elder_profile = db.session.get(ElderProfile, elder_id)
        if elder_profile:
            reqs = ConnectionRequest.query.filter(
                ((ConnectionRequest.requester_id == user.id) & (ConnectionRequest.elder_user_id == elder_profile.user_id)) |
                ((ConnectionRequest.requester_id == elder_profile.user_id) & (ConnectionRequest.elder_user_id == user.id))
            ).all()
            for r in reqs:
                db.session.delete(r)

        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": "Could not remove this elder. Please try again."
        }), 500

    return jsonify({
        "success": True,
        "message": "Elder permanently unlinked and connection deleted."
    }), 200


# -------------------------------------------------------------------
# ELDER DETAILS
# -------------------------------------------------------------------

@caregiver_bp.get(
    "/elders/<int:elder_id>"
)
@jwt_required()
def get_elder_details(elder_id):
    user, caregiver, error = get_current_caregiver()

    if error:
        return error

    elder = get_elder(
        caregiver,
        elder_id
    )

    if not elder:
        return jsonify({
            "success": False,
            "message": (
                "You are not authorized to access this elder."
            ),
        }), 403

    elder_user = db.session.get(
        User,
        elder.user_id
    )

    medications = (
        Medication.query
        .filter_by(
            elder_id=elder.id,
            is_active=True
        )
        .order_by(
            Medication.name.asc()
        )
        .all()
    )

    vitals = (
        Vital.query
        .filter_by(
            elder_id=elder.id
        )
        .order_by(
            Vital.recorded_at.desc()
        )
        .limit(20)
        .all()
    )

    assessments = (
        HealthAssessment.query
        .filter_by(
            elder_id=elder.id
        )
        .order_by(
            HealthAssessment.created_at.desc()
        )
        .limit(20)
        .all()
    )

    adherence = calculate_adherence(
        elder,
        7
    )

    streak = calculate_streak(
        elder
    )

    return jsonify({
        "success": True,

        "elder": {
            "id": elder.id,
            "name": (
                elder_user.full_name
                if elder_user
                else "Unknown elder"
            ),
            "full_name": (
                elder_user.full_name
                if elder_user
                else "Unknown elder"
            ),
            "email": (
                elder_user.email
                if elder_user
                else None
            ),
            "phone": (
                elder_user.phone
                if elder_user
                else None
            ),
            "gender": elder.gender,
            "blood_group": elder.blood_group,
            "date_of_birth": (
                elder.date_of_birth.isoformat()
                if elder.date_of_birth
                else None
            ),
            "address": elder.address,
            "emergency_contact": (
                elder.emergency_contact
            ),
            "emergency_phone": (
                elder.emergency_phone
            ),
        },

        "medications": [
            serialize_medication(
                medication
            )
            for medication in medications
        ],

        "medication_adherence": adherence,
        "medication_streak": streak,

        "vitals": [
            {
                "id": vital.id,
                "heart_rate": vital.heart_rate,
                "blood_pressure": vital.blood_pressure,
                "systolic": (vital.blood_pressure.split("/", 1)[0] if vital.blood_pressure and "/" in vital.blood_pressure else None),
                "diastolic": (vital.blood_pressure.split("/", 1)[1] if vital.blood_pressure and "/" in vital.blood_pressure else None),
                "oxygen_level": vital.oxygen_level,
                "temperature": vital.temperature,
                "recorded_at": format_datetime(
                    vital.recorded_at
                ),
            }
            for vital in vitals
        ],

        "assessments": [
            {
                "id": assessment.id,
                "risk_level": (
                    assessment.risk_level
                ),
                "risk_score": (
                    assessment.risk_score
                ),
                "summary": (
                    assessment.summary
                ),
                "recommendations": (
                    assessment.recommendations
                ),
                "created_at": format_datetime(
                    assessment.created_at
                ),
            }
            for assessment in assessments
        ],
    })


# -------------------------------------------------------------------
# MEDICATIONS FOR LINKED ELDER
# -------------------------------------------------------------------

@caregiver_bp.get(
    "/elders/<int:elder_id>/medications"
)
@jwt_required()
def caregiver_medications(elder_id):
    user, caregiver, error = get_current_caregiver()

    if error:
        return error

    elder = get_elder(
        caregiver,
        elder_id
    )

    if not elder:
        return jsonify({
            "success": False,
            "message": "Unauthorized elder access."
        }), 403

    medications = (
        Medication.query
        .filter_by(
            elder_id=elder.id,
            is_active=True
        )
        .order_by(
            Medication.name.asc()
        )
        .all()
    )

    adherence = calculate_adherence(
        elder,
        7
    )

    streak = calculate_streak(
        elder
    )

    return jsonify({
        "success": True,
        "elder_id": elder.id,
        "medications": [
            serialize_medication(
                medication
            )
            for medication in medications
        ],
        "adherence": adherence,
        "streak": streak,
    })


# -------------------------------------------------------------------
# MEDICATION HISTORY
# -------------------------------------------------------------------

@caregiver_bp.get(
    "/elders/<int:elder_id>/medications/history"
)
@jwt_required()
def caregiver_medication_history(elder_id):
    user, caregiver, error = get_current_caregiver()

    if error:
        return error

    elder = get_elder(
        caregiver,
        elder_id
    )

    if not elder:
        return jsonify({
            "success": False,
            "message": "Unauthorized elder access."
        }), 403

    try:
        days = int(
            request.args.get(
                "days",
                30
            )
        )
    except (TypeError, ValueError):
        days = 30

    days = max(
        1,
        min(days, 365)
    )

    start_datetime = (
        datetime.now()
        - timedelta(days=days - 1)
    ).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0
    )

    medication_ids = [
        medication.id
        for medication in Medication.query
        .filter_by(
            elder_id=elder.id
        )
        .all()
    ]

    logs = []

    if medication_ids:
        logs = (
            MedicationLog.query
            .filter(
                MedicationLog.medication_id.in_(
                    medication_ids
                ),
                MedicationLog.scheduled_at >= (
                    start_datetime
                )
            )
            .order_by(
                MedicationLog.scheduled_at.desc()
            )
            .all()
        )

    return jsonify({
        "success": True,
        "elder_id": elder.id,
        "days": days,
        "history": [
            serialize_log(log)
            for log in logs
        ],
    })


# -------------------------------------------------------------------
# ADHERENCE
# -------------------------------------------------------------------

@caregiver_bp.get(
    "/elders/<int:elder_id>/medications/adherence"
)
@jwt_required()
def caregiver_medication_adherence(elder_id):
    user, caregiver, error = get_current_caregiver()

    if error:
        return error

    elder = get_elder(
        caregiver,
        elder_id
    )

    if not elder:
        return jsonify({
            "success": False,
            "message": "Unauthorized elder access."
        }), 403

    try:
        days = int(
            request.args.get(
                "days",
                7
            )
        )
    except (TypeError, ValueError):
        days = 7

    adherence = calculate_adherence(
        elder,
        days
    )

    streak = calculate_streak(
        elder
    )

    return jsonify({
        "success": True,
        "elder_id": elder.id,
        "adherence": adherence,
        "streak": streak,

        "percentage": adherence["percentage"],
        "taken": adherence["taken"],
        "missed": adherence["missed"],
        "total": adherence["total"],
        "pending": adherence["pending"],
        "daily": adherence["daily"],
    })


# -------------------------------------------------------------------
# MEDICATION REPORT
# -------------------------------------------------------------------

@caregiver_bp.get(
    "/elders/<int:elder_id>/medications/report"
)
@jwt_required()
def caregiver_medication_report(elder_id):
    user, caregiver, error = get_current_caregiver()

    if error:
        return error

    elder = get_elder(
        caregiver,
        elder_id
    )

    if not elder:
        return jsonify({
            "success": False,
            "message": "Unauthorized elder access."
        }), 403

    elder_user = db.session.get(
        User,
        elder.user_id
    )

    try:
        days = int(
            request.args.get(
                "days",
                30
            )
        )
    except (TypeError, ValueError):
        days = 30

    days = max(
        1,
        min(days, 365)
    )

    start_datetime = (
        datetime.now()
        - timedelta(days=days - 1)
    ).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0
    )

    medication_ids = [
        medication.id
        for medication in Medication.query
        .filter_by(
            elder_id=elder.id
        )
        .all()
    ]

    logs = []

    if medication_ids:
        logs = (
            MedicationLog.query
            .filter(
                MedicationLog.medication_id.in_(
                    medication_ids
                ),
                MedicationLog.scheduled_at >= (
                    start_datetime
                )
            )
            .order_by(
                MedicationLog.scheduled_at.desc()
            )
            .all()
        )

    adherence = calculate_adherence(
        elder,
        days
    )

    output = io.StringIO()

    writer = csv.writer(
        output
    )

    writer.writerow([
        "Elder Name",
        "Medicine Name",
        "Dose",
        "Scheduled Time",
        "Actual Marked Taken Time",
        "Date",
        "Status",
        "Missed Reason",
        "Adherence (%)",
    ])

    for log in logs:

        medication = db.session.get(
            Medication,
            log.medication_id
        )

        if not medication:
            continue

        schedule = db.session.get(
            MedicationSchedule,
            log.schedule_id
        )

        writer.writerow([
            (
                elder_user.full_name
                if elder_user
                else "Unknown elder"
            ),
            medication.name,
            (
                schedule.dose_amount
                if schedule
                else medication.dosage
            ),
            (
                display_time(schedule.time)
                if schedule
                else display_time(
                    log.scheduled_at
                )
            ),
            (
                "Marked as taken at "
                + display_time(log.taken_at)
                if log.taken_at
                else ""
            ),
            (
                log.scheduled_at.strftime(
                    "%Y-%m-%d"
                )
                if log.scheduled_at
                else ""
            ),
            log.status,
            log.missed_reason or "",
            adherence["percentage"],
        ])

    if not logs:
        writer.writerow([
            (
                elder_user.full_name
                if elder_user
                else "Unknown elder"
            ),
            "",
            "",
            "",
            "",
            "",
            "No medication logs",
            "",
            adherence["percentage"],
        ])

    output.seek(0)

    filename = (
        f"elder_sense_"
        f"{elder_user.full_name.replace(' ', '_') if elder_user else 'elder'}_"
        f"medication_report.csv"
    )

    return (
        output.getvalue(),
        200,
        {
            "Content-Type": (
                "text/csv; charset=utf-8"
            ),
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            ),
        },
    )


# -------------------------------------------------------------------
# CAREGIVER NOTIFICATIONS
# -------------------------------------------------------------------

@caregiver_bp.get("/notifications")
@jwt_required()
def caregiver_notifications():
    user, caregiver, error = get_current_caregiver()

    if error:
        return error

    notifications = (
        Notification.query
        .filter_by(
            user_id=user.id
        )
        .order_by(
            Notification.created_at.desc()
        )
        .limit(20)
        .all()
    )

    unread_count = (
        Notification.query
        .filter_by(
            user_id=user.id,
            is_read=False
        )
        .count()
    )

    return jsonify({
        "success": True,
        "unread_count": unread_count,
        "notifications": [
            {
                "id": notification.id,
                "title": notification.title,
                "message": notification.message,
                "notification_type": (
                    notification.notification_type
                ),
                "is_read": bool(
                    notification.is_read
                ),
                "created_at": format_datetime(
                    notification.created_at
                ),
            }
            for notification in notifications
        ],
    })


@caregiver_bp.post(
    "/notifications/<int:notification_id>/read"
)
@jwt_required()
def mark_notification_read(
    notification_id
):
    user, caregiver, error = get_current_caregiver()

    if error:
        return error

    notification = db.session.get(
        Notification,
        notification_id
    )

    if not notification:
        return jsonify({
            "success": False,
            "message": "Notification not found."
        }), 404

    if notification.user_id != user.id:
        return jsonify({
            "success": False,
            "message": "Unauthorized notification access."
        }), 403

    notification.is_read = True

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to update notification.",
            "error": str(exc),
        }), 500

    return jsonify({
        "success": True,
        "message": "Notification marked as read."
    })