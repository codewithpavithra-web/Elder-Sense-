# medications.py (Complete corrected file)
import csv
import io
import os
from datetime import datetime, date, time, timedelta

from flask import Blueprint, jsonify, request, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from extensions import db
from models import (
    User,
    ElderProfile,
    Medication,
    MedicationSchedule,
    MedicationLog,
    CaregiverElderLink,
    CaregiverProfile,
    Notification,
)

medications_bp = Blueprint(
    "medications",
    __name__,
    url_prefix="/api/medications",
)

SUPPORTED_LANGUAGES = {
    "English",
    "Kannada",
    "Tamil",
    "Telugu",
    "Hindi",
    "Malayalam",
}

VALID_STATUSES = {
    "TAKEN",
    "MISSED",
    "SKIPPED",
}

VALID_MISSED_REASONS = {
    "Forgot",
    "Feeling unwell",
    "Not available",
    "Other",
}

GRACE_MINUTES = 15

UPLOAD_FOLDER = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "uploads",
    "medications",
)

ALLOWED_IMAGE_EXTENSIONS = {
    "png",
    "jpg",
    "jpeg",
    "webp",
}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


# ============================================================
# AUTH / HELPERS
# ============================================================

def get_current_elder():
    identity = get_jwt_identity()

    if not identity:
        return None, None, (
            jsonify({
                "success": False,
                "message": "Authentication required.",
            }),
            401,
        )

    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        return None, None, (
            jsonify({
                "success": False,
                "message": "Invalid authentication token.",
            }),
            401,
        )

    user = db.session.get(User, user_id)

    if not user:
        return None, None, (
            jsonify({
                "success": False,
                "message": "User not found.",
            }),
            404,
        )

    if user.role != "ELDER":
        return None, None, (
            jsonify({
                "success": False,
                "message": "Only elder accounts can manage medications.",
            }),
            403,
        )

    elder = ElderProfile.query.filter_by(
        user_id=user.id
    ).first()

    if not elder:
        return None, None, (
            jsonify({
                "success": False,
                "message": "Elder profile not found.",
            }),
            404,
        )

    return user, elder, None


def parse_date(value):
    if not value:
        return None

    if isinstance(value, date):
        return value

    try:
        return datetime.strptime(
            str(value).strip(),
            "%Y-%m-%d",
        ).date()
    except ValueError:
        return None


def parse_time(value):
    if not value:
        return None

    if isinstance(value, time):
        return value

    value = str(value).strip()

    formats = [
        "%H:%M",
        "%H:%M:%S",
        "%I:%M %p",
        "%I:%M:%S %p",
        "%I:%M%p",
        "%I:%M:%S%p",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(
                value,
                fmt,
            ).time()
        except ValueError:
            continue

    return None


def parse_datetime_local(value):
    if not value:
        return None

    if isinstance(value, datetime):
        return value

    value = str(value).strip()

    formats = [
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d %H:%M:%S",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(
                value,
                fmt,
            )
        except ValueError:
            continue

    return None


def parse_bool(value, default=True):
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    if isinstance(value, int):
        return value != 0

    return str(value).strip().lower() in {
        "true",
        "1",
        "yes",
        "on",
    }


def format_time_value(value):
    if not value:
        return None

    return value.strftime("%H:%M")


def format_datetime_value(value):
    if not value:
        return None

    return value.strftime("%Y-%m-%dT%H:%M:%S")


def format_display_time(value):
    if not value:
        return ""

    return value.strftime("%I:%M %p").lstrip("0")


def medication_photo_url(photo_path):
    if not photo_path:
        return None

    return f"/api/medications/photos/{photo_path}"


def serialize_schedule(schedule):
    return {
        "id": schedule.id,
        "time": format_time_value(schedule.time),
        "display_time": format_display_time(schedule.time),
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
        key=lambda item: item.time or time.min
    )

    return {
        "id": medication.id,
        "name": medication.name,
        "dosage": medication.dosage,
        "form": medication.form,
        "instructions": medication.instructions,
        "purpose": medication.purpose,
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
        "is_active": bool(medication.is_active),
        "photo_path": medication.photo_path,
        "photo_url": medication_photo_url(
            medication.photo_path
        ),
        "schedules": [
            serialize_schedule(schedule)
            for schedule in schedules
        ],
    }


def medication_belongs_to_elder(medication, elder):
    return (
        medication is not None
        and elder is not None
        and medication.elder_id == elder.id
    )


def get_schedule_for_medication(
    medication_id,
    schedule_id,
):
    schedule = db.session.get(
        MedicationSchedule,
        schedule_id,
    )

    if not schedule:
        return None

    if schedule.medication_id != medication_id:
        return None

    return schedule


def normalize_status(value):
    if not value:
        return None

    return str(value).strip().upper()


def normalize_missed_reason(value):
    if not value:
        return None

    value = str(value).strip()

    if value in VALID_MISSED_REASONS:
        return value

    return "Other"


# ============================================================
# CAREGIVER NOTIFICATION
# ============================================================

def notify_caregivers_of_missed_dose(
    elder,
    medication,
    scheduled_at,
):
    elder_user = db.session.get(
        User,
        elder.user_id,
    )

    elder_name = (
        elder_user.full_name
        if elder_user and elder_user.full_name
        else "Your linked elder"
    )

    links = (
        CaregiverElderLink.query
        .filter_by(
            elder_id=elder.id,
            is_active=True,
        )
        .all()
    )

    current_hour = scheduled_at.hour

    if current_hour < 12:
        period = "morning"
    elif current_hour < 17:
        period = "afternoon"
    elif current_hour < 21:
        period = "evening"
    else:
        period = "night"

    message = (
        f"{elder_name} missed the {period} dose of "
        f"{medication.name} scheduled at "
        f"{format_display_time(scheduled_at)}. "
        f"Please check on the elder."
    )

    for link in links:
        caregiver = db.session.get(
            CaregiverProfile,
            link.caregiver_id,
        )

        if not caregiver:
            continue

        existing = (
            Notification.query
            .filter_by(
                user_id=caregiver.user_id,
                notification_type="MEDICATION_MISSED",
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
                Notification.created_at >= (
                    scheduled_at - timedelta(minutes=2)
                )
            )
            .first()
        )

        if existing:
            continue

        db.session.add(
            Notification(
                user_id=caregiver.user_id,
                title="Missed Medication Alert 🔔",
                message=message,
                notification_type="MEDICATION_MISSED",
                is_read=False,
            )
        )


# ============================================================
# LOG SERIALIZATION
# ============================================================

def log_to_dict(log):
    medication = db.session.get(
        Medication,
        log.medication_id,
    )

    schedule = db.session.get(
        MedicationSchedule,
        log.schedule_id,
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
        "scheduled_at": format_datetime_value(
            log.scheduled_at
        ),
        "scheduled_time": (
            format_time_value(schedule.time)
            if schedule
            else None
        ),
        "scheduled_display": (
            format_display_time(log.scheduled_at)
            if log.scheduled_at
            else ""
        ),
        "taken_at": format_datetime_value(
            log.taken_at
        ),
        "taken_display": (
            format_display_time(log.taken_at)
            if log.taken_at
            else None
        ),
        "status": log.status,
        "notes": log.notes,
        "missed_reason": log.missed_reason,
    }


# ============================================================
# ADHERENCE
# ============================================================

def calculate_adherence(elder, days=7):
    try:
        days = int(days)
    except (TypeError, ValueError):
        days = 7

    days = max(1, min(days, 90))

    now = datetime.now()
    start_date = now.date() - timedelta(days=days - 1)

    medications = (
        Medication.query
        .filter_by(
            elder_id=elder.id,
            is_active=True,
        )
        .all()
    )

    taken_count = 0
    missed_count = 0
    pending_count = 0
    daily = []

    for offset in range(days):
        current_date = start_date + timedelta(days=offset)

        day_total = 0
        day_taken = 0
        day_missed = 0

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
                    schedule.time,
                )

                if scheduled_at > now:
                    continue

                day_total += 1

                log = MedicationLog.query.filter_by(
                    schedule_id=schedule.id,
                    scheduled_at=scheduled_at,
                ).first()

                if log:
                    status = normalize_status(log.status)

                    if status == "TAKEN":
                        day_taken += 1
                        taken_count += 1

                    elif status in {
                        "MISSED",
                        "SKIPPED",
                    }:
                        day_missed += 1
                        missed_count += 1

                    else:
                        pending_count += 1

                elif now >= (
                    scheduled_at
                    + timedelta(minutes=GRACE_MINUTES)
                ):
                    day_missed += 1
                    missed_count += 1

                else:
                    pending_count += 1

        daily.append({
            "date": current_date.isoformat(),
            "label": current_date.strftime("%a"),
            "taken": day_taken,
            "missed": day_missed,
            "total": day_total,
        })

    completed_total = taken_count + missed_count

    percentage = (
        round(
            taken_count / completed_total * 100,
            1,
        )
        if completed_total
        else 0
    )

    return {
        "days": days,
        "percentage": percentage,
        "taken": taken_count,
        "missed": missed_count,
        "total": completed_total,
        "pending": pending_count,
        "daily": daily,
    }


def calculate_streak(elder):
    now = datetime.now()

    medications = (
        Medication.query
        .filter_by(
            elder_id=elder.id,
            is_active=True,
        )
        .all()
    )

    if not medications:
        return {
            "streak": 0,
            "message": "No medication streak yet.",
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
                    schedule.time,
                )

                if scheduled_at > now:
                    continue

                day_total += 1

                log = MedicationLog.query.filter_by(
                    schedule_id=schedule.id,
                    scheduled_at=scheduled_at,
                ).first()

                if (
                    log
                    and normalize_status(log.status) == "TAKEN"
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


# ============================================================
# MEDICATIONS
# ============================================================

@medications_bp.get("")
@jwt_required()
def get_medications():
    user, elder, error = get_current_elder()

    if error:
        return error

    medications = (
        Medication.query
        .filter_by(
            elder_id=elder.id,
            is_active=True,
        )
        .order_by(
            Medication.created_at.desc()
        )
        .all()
    )

    return jsonify({
        "success": True,
        "elder_name": user.full_name,
        "preferred_language": (
            elder.preferred_language or "English"
        ),
        "medications": [
            serialize_medication(m)
            for m in medications
        ],
    })


@medications_bp.post("")
@jwt_required()
def add_medication():
    user, elder, error = get_current_elder()

    if error:
        return error

    data = request.get_json(
        silent=True
    ) or {}

    name = str(
        data.get("name", "")
    ).strip()

    if not name:
        return jsonify({
            "success": False,
            "message": "Medicine name is required.",
        }), 400

    start_date = parse_date(
        data.get("start_date")
    )

    end_date = parse_date(
        data.get("end_date")
    )

    if (
        start_date
        and end_date
        and end_date < start_date
    ):
        return jsonify({
            "success": False,
            "message": "End date cannot be before start date.",
        }), 400

    medication = Medication(
        elder_id=elder.id,
        name=name,
        dosage=str(
            data.get("dosage", "")
        ).strip() or None,
        form=str(
            data.get("form", "")
        ).strip() or None,
        purpose=str(
            data.get("purpose", "")
        ).strip() or None,
        instructions=str(
            data.get("instructions", "")
        ).strip() or None,
        start_date=start_date,
        end_date=end_date,
        is_active=True,
    )

    db.session.add(medication)
    db.session.flush()

    schedules = data.get("schedules", [])

    if isinstance(schedules, list):
        for schedule_data in schedules:
            if not isinstance(schedule_data, dict):
                continue

            schedule_time = parse_time(
                schedule_data.get("time")
            )

            if not schedule_time:
                continue

            db.session.add(
                MedicationSchedule(
                    medication_id=medication.id,
                    time=schedule_time,
                    dose_amount=str(
                        schedule_data.get(
                            "dose_amount",
                            "",
                        )
                    ).strip() or None,
                    instructions=str(
                        schedule_data.get(
                            "instructions",
                            "",
                        )
                    ).strip() or None,
                    is_active=True,
                    reminder_enabled=parse_bool(
                        schedule_data.get(
                            "reminder_enabled"
                        ),
                        True,
                    ),
                )
            )

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to save medication.",
            "error": str(exc),
        }), 500

    return jsonify({
        "success": True,
        "message": "Medication added successfully.",
        "medication": serialize_medication(medication),
    }), 201


@medications_bp.route(
    "/<int:medication_id>",
    methods=["PUT", "PATCH"],
)
@jwt_required()
def update_medication(medication_id):
    user, elder, error = get_current_elder()

    if error:
        return error

    medication = db.session.get(
        Medication,
        medication_id,
    )

    if not medication_belongs_to_elder(
        medication,
        elder,
    ):
        return jsonify({
            "success": False,
            "message": "Medication not found.",
        }), 404

    data = request.get_json(
        silent=True
    ) or {}

    if "name" in data:
        name = str(
            data.get("name", "")
        ).strip()

        if not name:
            return jsonify({
                "success": False,
                "message": "Medicine name is required.",
            }), 400

        medication.name = name

    if "dosage" in data:
        medication.dosage = str(
            data.get("dosage", "")
        ).strip() or None

    if "form" in data:
        medication.form = str(
            data.get("form", "")
        ).strip() or None

    if "purpose" in data:
        medication.purpose = str(
            data.get("purpose", "")
        ).strip() or None

    if "instructions" in data:
        medication.instructions = str(
            data.get("instructions", "")
        ).strip() or None

    if "start_date" in data:
        medication.start_date = parse_date(
            data.get("start_date")
        )

    if "end_date" in data:
        medication.end_date = parse_date(
            data.get("end_date")
        )

    if (
        medication.start_date
        and medication.end_date
        and medication.end_date < medication.start_date
    ):
        return jsonify({
            "success": False,
            "message": "End date cannot be before start date.",
        }), 400

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to update medication.",
            "error": str(exc),
        }), 500

    return jsonify({
        "success": True,
        "message": "Medication updated successfully.",
        "medication": serialize_medication(medication),
    })


@medications_bp.delete(
    "/<int:medication_id>"
)
@jwt_required()
def delete_medication(medication_id):
    user, elder, error = get_current_elder()

    if error:
        return error

    medication = db.session.get(
        Medication,
        medication_id,
    )

    if not medication_belongs_to_elder(
        medication,
        elder,
    ):
        return jsonify({
            "success": False,
            "message": "Medication not found.",
        }), 404

    medication.is_active = False

    for schedule in medication.schedules:
        schedule.is_active = False

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to remove medication.",
            "error": str(exc),
        }), 500

    return jsonify({
        "success": True,
        "message": "Medication removed successfully.",
    })


# ============================================================
# SCHEDULES
# ============================================================

@medications_bp.post(
    "/<int:medication_id>/schedule"
)
@medications_bp.post(
    "/<int:medication_id>/schedules"
)
@jwt_required()
def add_schedule(medication_id):
    user, elder, error = get_current_elder()

    if error:
        return error

    medication = db.session.get(
        Medication,
        medication_id,
    )

    if not medication_belongs_to_elder(
        medication,
        elder,
    ):
        return jsonify({
            "success": False,
            "message": "Medication not found.",
        }), 404

    data = request.get_json(
        silent=True
    ) or {}

    schedule_time = parse_time(
        data.get("time")
    )

    if not schedule_time:
        return jsonify({
            "success": False,
            "message": "Valid medication time is required.",
        }), 400

    schedule = MedicationSchedule(
        medication_id=medication.id,
        time=schedule_time,
        dose_amount=str(
            data.get("dose_amount", "")
        ).strip() or None,
        instructions=str(
            data.get("instructions", "")
        ).strip() or None,
        is_active=True,
        reminder_enabled=parse_bool(
            data.get("reminder_enabled"),
            True,
        ),
    )

    db.session.add(schedule)

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to add schedule.",
            "error": str(exc),
        }), 500

    return jsonify({
        "success": True,
        "message": "Schedule added successfully.",
        "schedule": serialize_schedule(schedule),
    }), 201


@medications_bp.route(
    "/<int:medication_id>/schedules/<int:schedule_id>",
    methods=["PUT", "PATCH"],
)
@jwt_required()
def update_schedule(
    medication_id,
    schedule_id,
):
    user, elder, error = get_current_elder()

    if error:
        return error

    medication = db.session.get(
        Medication,
        medication_id,
    )

    if not medication_belongs_to_elder(
        medication,
        elder,
    ):
        return jsonify({
            "success": False,
            "message": "Medication not found.",
        }), 404

    schedule = get_schedule_for_medication(
        medication_id,
        schedule_id,
    )

    if not schedule:
        return jsonify({
            "success": False,
            "message": "Schedule not found.",
        }), 404

    data = request.get_json(
        silent=True
    ) or {}

    if "time" in data:
        schedule_time = parse_time(
            data.get("time")
        )

        if not schedule_time:
            return jsonify({
                "success": False,
                "message": "Valid medication time is required.",
            }), 400

        schedule.time = schedule_time

    if "dose_amount" in data:
        schedule.dose_amount = str(
            data.get("dose_amount", "")
        ).strip() or None

    if "instructions" in data:
        schedule.instructions = str(
            data.get("instructions", "")
        ).strip() or None

    if "reminder_enabled" in data:
        schedule.reminder_enabled = parse_bool(
            data.get("reminder_enabled"),
            True,
        )

    if "is_active" in data:
        schedule.is_active = parse_bool(
            data.get("is_active"),
            True,
        )

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to update schedule.",
            "error": str(exc),
        }), 500

    return jsonify({
        "success": True,
        "message": "Schedule updated successfully.",
        "schedule": serialize_schedule(schedule),
    })


@medications_bp.delete(
    "/<int:medication_id>/schedules/<int:schedule_id>"
)
@jwt_required()
def delete_schedule(
    medication_id,
    schedule_id,
):
    user, elder, error = get_current_elder()

    if error:
        return error

    medication = db.session.get(
        Medication,
        medication_id,
    )

    if not medication_belongs_to_elder(
        medication,
        elder,
    ):
        return jsonify({
            "success": False,
            "message": "Medication not found.",
        }), 404

    schedule = get_schedule_for_medication(
        medication_id,
        schedule_id,
    )

    if not schedule:
        return jsonify({
            "success": False,
            "message": "Schedule not found.",
        }), 404

    schedule.is_active = False

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to remove schedule.",
            "error": str(exc),
        }), 500

    return jsonify({
        "success": True,
        "message": "Schedule removed successfully.",
    })


# ============================================================
# REMINDER TOGGLE
# ============================================================

@medications_bp.route(
    "/<int:medication_id>/schedule/<int:schedule_id>/reminder",
    methods=["PATCH", "PUT"],
)
@jwt_required()
def toggle_schedule_reminder(
    medication_id,
    schedule_id,
):
    user, elder, error = get_current_elder()

    if error:
        return error

    medication = db.session.get(
        Medication,
        medication_id,
    )

    if not medication_belongs_to_elder(
        medication,
        elder,
    ):
        return jsonify({
            "success": False,
            "message": "Medication not found.",
        }), 404

    schedule = get_schedule_for_medication(
        medication_id,
        schedule_id,
    )

    if not schedule:
        return jsonify({
            "success": False,
            "message": "Schedule not found.",
        }), 404

    data = request.get_json(
        silent=True
    ) or {}

    if "reminder_enabled" in data:
        schedule.reminder_enabled = parse_bool(
            data.get("reminder_enabled"),
            True,
        )
    else:
        schedule.reminder_enabled = not bool(
            schedule.reminder_enabled
        )

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to change reminder setting.",
            "error": str(exc),
        }), 500

    return jsonify({
        "success": True,
        "message": (
            "Reminder enabled."
            if schedule.reminder_enabled
            else "Reminder disabled."
        ),
        "reminder_enabled": bool(
            schedule.reminder_enabled
        ),
        "schedule": serialize_schedule(schedule),
    })


# ============================================================
# MEDICATION LOG
# ============================================================

@medications_bp.post(
    "/<int:medication_id>/log"
)
@jwt_required()
def log_medication(medication_id):
    user, elder, error = get_current_elder()

    if error:
        return error

    medication = db.session.get(
        Medication,
        medication_id,
    )

    if not medication_belongs_to_elder(
        medication,
        elder,
    ):
        return jsonify({
            "success": False,
            "message": "Medication not found.",
        }), 404

    data = request.get_json(
        silent=True
    ) or {}

    status = normalize_status(
        data.get("status")
    )

    if status not in VALID_STATUSES:
        return jsonify({
            "success": False,
            "message": (
                "Status must be TAKEN, MISSED, or SKIPPED."
            ),
        }), 400

    schedule_id = data.get("schedule_id")

    if not schedule_id:
        return jsonify({
            "success": False,
            "message": "Schedule ID is required.",
        }), 400

    try:
        schedule_id = int(schedule_id)
    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "Invalid schedule ID.",
        }), 400

    schedule = get_schedule_for_medication(
        medication_id,
        schedule_id,
    )

    if not schedule:
        return jsonify({
            "success": False,
            "message": "Schedule not found.",
        }), 404

    scheduled_at = parse_datetime_local(
        data.get("scheduled_at")
    )

    if not scheduled_at:
        scheduled_at = datetime.combine(
            datetime.now().date(),
            schedule.time,
        )

    missed_reason = None

    if status in {
        "MISSED",
        "SKIPPED",
    }:
        missed_reason = normalize_missed_reason(
            data.get("missed_reason")
        )

    notes = str(
        data.get("notes", "")
    ).strip() or None

    existing_log = (
        MedicationLog.query
        .filter_by(
            schedule_id=schedule.id,
            scheduled_at=scheduled_at,
        )
        .first()
    )

    if existing_log:
        old_status = normalize_status(
            existing_log.status
        )

        if (
            old_status == "MISSED"
            and status == "TAKEN"
        ):
            existing_log.status = "TAKEN"
            existing_log.taken_at = datetime.now()
            existing_log.missed_reason = None

            if notes:
                existing_log.notes = notes

            try:
                db.session.commit()
            except Exception as exc:
                db.session.rollback()

                return jsonify({
                    "success": False,
                    "message": "Unable to update medication log.",
                    "error": str(exc),
                }), 500

            return jsonify({
                "success": True,
                "message": "Medication marked as taken.",
                "log": log_to_dict(existing_log),
                "updated_existing_log": True,
            })

        return jsonify({
            "success": True,
            "message": "This dose has already been recorded.",
            "log": log_to_dict(existing_log),
            "duplicate": True,
        })

    taken_at = (
        datetime.now()
        if status == "TAKEN"
        else None
    )

    log = MedicationLog(
        medication_id=medication.id,
        schedule_id=schedule.id,
        scheduled_at=scheduled_at,
        taken_at=taken_at,
        status=status,
        notes=notes,
        missed_reason=missed_reason,
    )

    db.session.add(log)

    try:
        db.session.flush()

        if status in {
            "MISSED",
            "SKIPPED",
        }:
            notify_caregivers_of_missed_dose(
                elder,
                medication,
                scheduled_at,
            )

        db.session.commit()

    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to record medication status.",
            "error": str(exc),
        }), 500

    return jsonify({
        "success": True,
        "message": (
            "Medication marked as taken."
            if status == "TAKEN"
            else "Medication status recorded."
        ),
        "log": log_to_dict(log),
    })


# ============================================================
# HISTORY & DELETE HISTORY LOG (FIXED)
# ============================================================

@medications_bp.get("/history")
@jwt_required()
def medication_history():
    user, elder, error = get_current_elder()

    if error:
        return error

    try:
        days = int(
            request.args.get(
                "days",
                30,
            )
        )
    except (TypeError, ValueError):
        days = 30

    days = max(1, min(days, 365))

    start_datetime = (
        datetime.now()
        - timedelta(days=days - 1)
    ).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    medication_ids = [
        medication.id
        for medication in Medication.query.filter_by(
            elder_id=elder.id
        ).all()
    ]

    logs = []

    if medication_ids:
        logs = (
            MedicationLog.query
            .filter(
                MedicationLog.medication_id.in_(
                    medication_ids
                ),
                MedicationLog.scheduled_at >= start_datetime,
            )
            .order_by(
                MedicationLog.scheduled_at.desc()
            )
            .all()
        )

    return jsonify({
        "success": True,
        "days": days,
        "history": [
            log_to_dict(log)
            for log in logs
        ],
    })


@medications_bp.delete("/history/<int:log_id>")
@jwt_required()
def delete_medication_history_log(log_id):
    user, elder, error = get_current_elder()

    if error:
        return error

    log = db.session.get(MedicationLog, log_id)

    if not log:
        return jsonify({
            "success": False,
            "message": "Medication history record not found.",
        }), 404

    medication = db.session.get(
        Medication,
        log.medication_id,
    )

    if not medication_belongs_to_elder(medication, elder):
        return jsonify({
            "success": False,
            "message": "Unauthorized access to this history record.",
        }), 403

    try:
        db.session.delete(log)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to delete medication history record.",
            "error": str(exc),
        }), 500

    return jsonify({
        "success": True,
        "message": "Medication history record deleted successfully.",
    })


# ============================================================
# ADHERENCE
# ============================================================

@medications_bp.get("/adherence")
@jwt_required()
def medication_adherence():
    user, elder, error = get_current_elder()

    if error:
        return error

    try:
        days = int(
            request.args.get(
                "days",
                7,
            )
        )
    except (TypeError, ValueError):
        days = 7

    adherence = calculate_adherence(
        elder,
        days,
    )

    streak = calculate_streak(elder)

    return jsonify({
        "success": True,
        "adherence": adherence,
        "streak": streak,
        "percentage": adherence["percentage"],
        "taken": adherence["taken"],
        "missed": adherence["missed"],
        "total": adherence["total"],
        "pending": adherence["pending"],
        "daily": adherence["daily"],
    })


# ============================================================
# LANGUAGE
# ============================================================

@medications_bp.get("/language")
@jwt_required()
def get_language():
    user, elder, error = get_current_elder()

    if error:
        return error

    language = (
        elder.preferred_language
        or "English"
    )

    if language not in SUPPORTED_LANGUAGES:
        language = "English"

    return jsonify({
        "success": True,
        "language": language,
        "supported_languages": sorted(
            SUPPORTED_LANGUAGES
        ),
    })


@medications_bp.put("/language")
@jwt_required()
def update_language():
    user, elder, error = get_current_elder()

    if error:
        return error

    data = request.get_json(
        silent=True
    ) or {}

    language = str(
        data.get(
            "language",
            "",
        )
    ).strip()

    if language not in SUPPORTED_LANGUAGES:
        return jsonify({
            "success": False,
            "message": "Unsupported language.",
            "supported_languages": sorted(
                SUPPORTED_LANGUAGES
            ),
        }), 400

    elder.preferred_language = language

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to save language preference.",
            "error": str(exc),
        }), 500

    return jsonify({
        "success": True,
        "message": "Language preference saved.",
        "language": language,
    })


# ============================================================
# STREAK
# ============================================================

@medications_bp.get("/streak")
@jwt_required()
def medication_streak():
    user, elder, error = get_current_elder()

    if error:
        return error

    return jsonify({
        "success": True,
        **calculate_streak(elder),
    })


# ============================================================
# MEDICINE PHOTO
# ============================================================

def allowed_image(filename):
    if not filename or "." not in filename:
        return False

    extension = (
        filename.rsplit(".", 1)[1]
        .lower()
    )

    return extension in ALLOWED_IMAGE_EXTENSIONS


@medications_bp.post(
    "/<int:medication_id>/photo"
)
@jwt_required()
def upload_medication_photo(medication_id):
    user, elder, error = get_current_elder()

    if error:
        return error

    medication = db.session.get(
        Medication,
        medication_id,
    )

    if not medication_belongs_to_elder(
        medication,
        elder,
    ):
        return jsonify({
            "success": False,
            "message": "Medication not found.",
        }), 404

    photo = request.files.get("photo")

    if not photo:
        return jsonify({
            "success": False,
            "message": "Medicine photo is required.",
        }), 400

    if not allowed_image(photo.filename):
        return jsonify({
            "success": False,
            "message": (
                "Only PNG, JPG, JPEG, and WEBP images are allowed."
            ),
        }), 400

    original_filename = secure_filename(
        photo.filename
    )

    extension = original_filename.rsplit(
        ".",
        1,
    )[1].lower()

    filename = (
        f"medication_{medication.id}_"
        f"{int(datetime.now().timestamp())}."
        f"{extension}"
    )

    filepath = os.path.join(
        UPLOAD_FOLDER,
        filename,
    )

    try:
        photo.save(filepath)

        if medication.photo_path:
            old_path = os.path.join(
                UPLOAD_FOLDER,
                os.path.basename(
                    medication.photo_path
                ),
            )

            if (
                os.path.isfile(old_path)
                and os.path.abspath(old_path)
                != os.path.abspath(filepath)
            ):
                try:
                    os.remove(old_path)
                except OSError:
                    pass

        medication.photo_path = filename

        db.session.commit()

    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to save medicine photo.",
            "error": str(exc),
        }), 500

    return jsonify({
        "success": True,
        "message": "Medicine photo uploaded successfully.",
        "photo_path": medication.photo_path,
        "photo_url": medication_photo_url(
            medication.photo_path
        ),
    })


@medications_bp.get(
    "/photos/<path:filename>"
)
def serve_medication_photo(filename):
    safe_filename = os.path.basename(filename)

    return send_from_directory(
        UPLOAD_FOLDER,
        safe_filename,
    )


@medications_bp.delete(
    "/<int:medication_id>/photo"
)
@jwt_required()
def delete_medication_photo(medication_id):
    user, elder, error = get_current_elder()

    if error:
        return error

    medication = db.session.get(
        Medication,
        medication_id,
    )

    if not medication_belongs_to_elder(
        medication,
        elder,
    ):
        return jsonify({
            "success": False,
            "message": "Medication not found.",
        }), 404

    if medication.photo_path:
        filepath = os.path.join(
            UPLOAD_FOLDER,
            os.path.basename(
                medication.photo_path
            ),
        )

        if os.path.isfile(filepath):
            try:
                os.remove(filepath)
            except OSError:
                pass

        medication.photo_path = None

    try:
        db.session.commit()
    except Exception as exc:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Unable to remove medicine photo.",
            "error": str(exc),
        }), 500

    return jsonify({
        "success": True,
        "message": "Medicine photo removed.",
    })


# ============================================================
# MEDICATION REPORT
# ============================================================

@medications_bp.get("/report")
@jwt_required()
def medication_report():
    user, elder, error = get_current_elder()

    if error:
        return error

    try:
        days = int(
            request.args.get(
                "days",
                30,
            )
        )
    except (TypeError, ValueError):
        days = 30

    days = max(1, min(days, 365))

    start_datetime = (
        datetime.now()
        - timedelta(days=days - 1)
    ).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    medications = (
        Medication.query
        .filter_by(
            elder_id=elder.id
        )
        .order_by(
            Medication.name.asc()
        )
        .all()
    )

    medication_ids = [
        medication.id
        for medication in medications
    ]

    logs = []

    if medication_ids:
        logs = (
            MedicationLog.query
            .filter(
                MedicationLog.medication_id.in_(
                    medication_ids
                ),
                MedicationLog.scheduled_at >= start_datetime,
            )
            .order_by(
                MedicationLog.scheduled_at.desc()
            )
            .all()
        )

    adherence = calculate_adherence(
        elder,
        days,
    )

    output = io.StringIO()

    writer = csv.writer(output)

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
            log.medication_id,
        )

        if not medication:
            continue

        schedule = db.session.get(
            MedicationSchedule,
            log.schedule_id,
        )

        writer.writerow([
            user.full_name,
            medication.name,
            (
                schedule.dose_amount
                if schedule
                else medication.dosage
            ),
            (
                format_display_time(schedule.time)
                if schedule
                else format_display_time(
                    log.scheduled_at
                )
            ),
            (
                "Marked as taken at "
                + format_display_time(log.taken_at)
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
            user.full_name,
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
        "elder_sense_medication_report_"
        f"{date.today().isoformat()}.csv"
    )

    return (
        output.getvalue(),
        200,
        {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": (
                f'attachment; filename="{filename}"'
            ),
        },
    )