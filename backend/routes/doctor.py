from datetime import datetime, timedelta
import csv
import io

from flask import Blueprint, jsonify, Response, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models import (
    User,
    DoctorProfile,
    DoctorElderLink,
    ElderProfile,
    Vital,
    Medication,
    MedicationSchedule,
    MedicationLog,
    HealthAssessment,
    ConnectionRequest,
)


doctor_bp = Blueprint("doctor", __name__, url_prefix="/api/doctor")

GRACE_MINUTES = 15


# =========================================================
# HELPERS
# =========================================================

def get_current_doctor():
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return None, (jsonify({
            "status": "error",
            "message": "Invalid authentication token."
        }), 401)

    user = db.session.get(User, user_id)

    if not user:
        return None, (jsonify({
            "status": "error",
            "message": "User not found."
        }), 404)

    if str(user.role).upper() != "DOCTOR":
        return None, (jsonify({
            "status": "error",
            "message": "Doctor access required."
        }), 403)

    doctor = DoctorProfile.query.filter_by(user_id=user.id).first()

    if not doctor:
        return None, (jsonify({
            "status": "error",
            "message": "Doctor profile not found."
        }), 404)

    return doctor, None


def is_linked_doctor_to_elder(doctor_id, elder_id):
    return (
        DoctorElderLink.query
        .filter_by(
            doctor_id=doctor_id,
            elder_id=elder_id,
            is_active=True
        )
        .first()
        is not None
    )


def serialize_schedule(schedule):
    return {
        "id": schedule.id,
        "medication_id": schedule.medication_id,
        "time": (
            schedule.time.strftime("%H:%M")
            if schedule.time else None
        ),
        "dose": getattr(schedule, "dose", None),
        "is_active": bool(schedule.is_active),
        "reminder_enabled": bool(
            getattr(schedule, "reminder_enabled", True)
        ),
    }


def serialize_medication(medication):
    schedules = (
        MedicationSchedule.query
        .filter_by(
            medication_id=medication.id,
            is_active=True
        )
        .order_by(MedicationSchedule.time.asc())
        .all()
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
            if medication.start_date else None
        ),
        "end_date": (
            medication.end_date.isoformat()
            if medication.end_date else None
        ),
        "photo_path": getattr(medication, "photo_path", None),
        "schedules": [
            serialize_schedule(schedule)
            for schedule in schedules
        ],
    }


def get_scheduled_occurrences(medications, days=7):
    now = datetime.now()
    today = now.date()

    occurrences = []

    for medication in medications:
        schedules = (
            MedicationSchedule.query
            .filter_by(
                medication_id=medication.id,
                is_active=True
            )
            .all()
        )

        for schedule in schedules:
            if not schedule.time:
                continue

            for offset in range(days):
                occurrence_date = today - timedelta(days=offset)

                if (
                    medication.start_date
                    and occurrence_date < medication.start_date
                ):
                    continue

                if (
                    medication.end_date
                    and occurrence_date > medication.end_date
                ):
                    continue

                scheduled_at = datetime.combine(
                    occurrence_date,
                    schedule.time
                )

                if scheduled_at > now:
                    continue

                occurrences.append({
                    "medication": medication,
                    "schedule": schedule,
                    "scheduled_at": scheduled_at,
                })

    return occurrences


def get_medication_adherence(elder_id, days=7):
    try:
        days = int(days)
    except (TypeError, ValueError):
        days = 7

    days = max(1, min(days, 90))

    medications = (
        Medication.query
        .filter_by(
            elder_id=elder_id,
            is_active=True
        )
        .all()
    )

    occurrences = get_scheduled_occurrences(
        medications,
        days=days
    )

    taken = 0
    missed = 0
    pending = 0

    occurrence_rows = []

    for occurrence in occurrences:
        medication = occurrence["medication"]
        schedule = occurrence["schedule"]
        scheduled_at = occurrence["scheduled_at"]

        log = (
            MedicationLog.query
            .filter_by(
                schedule_id=schedule.id,
                scheduled_at=scheduled_at
            )
            .first()
        )

        status = None
        actual_taken_at = None
        missed_reason = None

        if log:
            status = str(log.status).upper()

            if status == "TAKEN":
                taken += 1
                log_time = getattr(log, "created_at", None) or getattr(log, "logged_at", None) or getattr(log, "timestamp", None)
                actual_taken_at = (
                    log_time.isoformat()
                    if log_time
                    else None
                )

            elif status == "MISSED":
                missed += 1
                missed_reason = getattr(
                    log,
                    "missed_reason",
                    None
                )

        else:
            now = datetime.now()

            if now <= scheduled_at + timedelta(
                minutes=GRACE_MINUTES
            ):
                pending += 1
                status = "PENDING"
            else:
                status = "MISSED"

        occurrence_rows.append({
            "medication_id": medication.id,
            "medication_name": medication.name,
            "dosage": medication.dosage,
            "schedule_id": schedule.id,
            "scheduled_at": scheduled_at.isoformat(),
            "actual_taken_at": actual_taken_at,
            "status": status,
            "missed_reason": missed_reason,
        })

    total_due = taken + missed + pending

    adherence_percentage = (
        round((taken / total_due) * 100, 1)
        if total_due > 0
        else 0
    )

    return {
        "days": days,
        "total_due": total_due,
        "taken": taken,
        "missed": missed,
        "pending": pending,
        "adherence_percentage": adherence_percentage,
        "occurrences": occurrence_rows,
    }


def calculate_streak(elder_id):
    medications = (
        Medication.query
        .filter_by(
            elder_id=elder_id,
            is_active=True
        )
        .all()
    )

    if not medications:
        return 0

    today = datetime.now().date()
    streak = 0

    for offset in range(365):
        current_date = today - timedelta(days=offset)

        day_occurrences = []

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

            schedules = (
                MedicationSchedule.query
                .filter_by(
                    medication_id=medication.id,
                    is_active=True
                )
                .all()
            )

            for schedule in schedules:
                if not schedule.time:
                    continue

                scheduled_at = datetime.combine(
                    current_date,
                    schedule.time
                )

                if scheduled_at > datetime.now():
                    continue

                day_occurrences.append(
                    (schedule, scheduled_at)
                )

        if not day_occurrences:
            continue

        all_taken = True

        for schedule, scheduled_at in day_occurrences:
            log = (
                MedicationLog.query
                .filter_by(
                    schedule_id=schedule.id,
                    scheduled_at=scheduled_at
                )
                .first()
            )

            if not log or str(log.status).upper() != "TAKEN":
                all_taken = False
                break

        if all_taken:
            streak += 1
        else:
            break

    return streak


def get_elder_name(elder_profile):
    elder_user = db.session.get(
        User,
        elder_profile.user_id
    )

    return (
        elder_user.full_name
        if elder_user
        else "Patient"
    )


# =========================================================
# DOCTOR PROFILE
# =========================================================

@doctor_bp.route("/profile", methods=["GET", "PUT", "POST", "OPTIONS"])
@jwt_required()
def doctor_profile():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    doctor, error = get_current_doctor()

    if error:
        return error

    user = db.session.get(User, doctor.user_id)

    if request.method in ["PUT", "POST"]:
        data = request.get_json() or {}

        if "designation" in data:
            doctor.designation = data["designation"]
        if "qualification" in data:
            doctor.qualification = data["qualification"]
        if "experience" in data:
            doctor.experience = data["experience"]
        if "services" in data:
            doctor.services = data["services"]
        if "is_available" in data:
            doctor.is_available = bool(data["is_available"])

        db.session.commit()

    return jsonify({
        "status": "success",
        "message": "Doctor profile retrieved/updated successfully.",
        "doctor": {
            "id": doctor.id,
            "user_id": doctor.user_id,
            "name": user.full_name if user else None,
            "email": user.email if user else None,
            "phone": user.phone if user else None,
            "specialization": getattr(doctor, "specialization", None),
            "designation": getattr(doctor, "designation", None),
            "qualification": getattr(doctor, "qualification", None),
            "experience": getattr(doctor, "experience", None),
            "services": getattr(doctor, "services", None),
            "is_available": getattr(doctor, "is_available", True),
            "license_number": getattr(doctor, "license_number", None),
        }
    })


# =========================================================
# PATIENT LIST & PERMANENT REMOVAL
# =========================================================

@doctor_bp.route("/patients", methods=["GET", "OPTIONS"])
@jwt_required()
def doctor_patients():
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    doctor, error = get_current_doctor()

    if error:
        return error

    links = (
        DoctorElderLink.query
        .filter_by(
            doctor_id=doctor.id,
            is_active=True
        )
        .all()
    )

    patients = []

    for link in links:
        elder = db.session.get(
            ElderProfile,
            link.elder_id
        )

        if not elder:
            continue

        user = db.session.get(
            User,
            elder.user_id
        )

        latest_vital = (
            Vital.query
            .filter_by(elder_id=elder.id)
            .order_by(Vital.recorded_at.desc())
            .first()
        )

        latest_assessment = (
            HealthAssessment.query
            .filter_by(elder_id=elder.id)
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

        adherence = get_medication_adherence(
            elder.id,
            days=7
        )

        patients.append({
            "id": elder.id,
            "elder_id": elder.id,
            "name": (
                user.full_name
                if user
                else "Patient"
            ),
            "email": user.email if user else None,
            "gender": elder.gender,
            "blood_group": elder.blood_group,
            "phone": (
                user.phone
                if user
                else None
            ),
            "active_medication_count":
                active_medication_count,
            "adherence": adherence[
                "adherence_percentage"
            ],
            "streak": calculate_streak(
                elder.id
            ),
            "latest_vital": (
                {
                    "heart_rate":
                        latest_vital.heart_rate,
                    "oxygen_level":
                        latest_vital.oxygen_level,
                    "recorded_at":
                        latest_vital.recorded_at.isoformat()
                        if latest_vital.recorded_at
                        else None,
                }
                if latest_vital
                else None
            ),
            "latest_assessment": (
                {
                    "risk_level":
                        latest_assessment.risk_level,
                    "created_at":
                        latest_assessment.created_at.isoformat()
                        if latest_assessment.created_at
                        else None,
                }
                if latest_assessment
                else None
            ),
        })

    return jsonify({
        "status": "success",
        "patients": patients
    })


@doctor_bp.route("/patients/<int:elder_id>", methods=["DELETE", "OPTIONS"])
@jwt_required()
def remove_patient_link(elder_id):
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    doctor, error = get_current_doctor()
    if error:
        return error

    try:
        # Permanently delete all active or inactive links between this doctor and elder
        links = DoctorElderLink.query.filter_by(doctor_id=doctor.id, elder_id=elder_id).all()
        for link in links:
            db.session.delete(link)

        elder = db.session.get(ElderProfile, elder_id)
        if elder:
            reqs = ConnectionRequest.query.filter(
                ((ConnectionRequest.requester_id == doctor.user_id) & (ConnectionRequest.elder_user_id == elder.user_id)) |
                ((ConnectionRequest.requester_id == elder.user_id) & (ConnectionRequest.elder_user_id == doctor.user_id))
            ).all()
            for r in reqs:
                db.session.delete(r)

        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({
            "status": "error",
            "success": False,
            "message": "Could not remove this patient. Please try again."
        }), 500

    return jsonify({
        "status": "success",
        "success": True,
        "message": "Patient connection permanently deleted."
    }), 200


# =========================================================
# PATIENT DETAILS & REPORTS
# =========================================================

@doctor_bp.get("/patients/<int:elder_id>")
@jwt_required()
def doctor_patient_details(elder_id):
    doctor, error = get_current_doctor()

    if error:
        return error

    if not is_linked_doctor_to_elder(
        doctor.id,
        elder_id
    ):
        return jsonify({
            "status": "error",
            "message": "You are not authorized to view this patient."
        }), 403

    elder = db.session.get(
        ElderProfile,
        elder_id
    )

    if not elder:
        return jsonify({
            "status": "error",
            "message": "Patient not found."
        }), 404

    user = db.session.get(
        User,
        elder.user_id
    )

    medications = (
        Medication.query
        .filter_by(
            elder_id=elder.id,
            is_active=True
        )
        .order_by(Medication.name.asc())
        .all()
    )

    vitals = (
        Vital.query
        .filter_by(elder_id=elder.id)
        .order_by(Vital.recorded_at.desc())
        .limit(20)
        .all()
    )

    assessments = (
        HealthAssessment.query
        .filter_by(elder_id=elder.id)
        .order_by(
            HealthAssessment.created_at.desc()
        )
        .limit(20)
        .all()
    )

    return jsonify({
        "status": "success",
        "patient": {
            "id": elder.id,
            "name": (
                user.full_name
                if user
                else "Patient"
            ),
            "email": user.email if user else None,
            "phone": user.phone if user else None,
            "gender": elder.gender,
            "blood_group": elder.blood_group,
        },
        "medications": [
            serialize_medication(medication)
            for medication in medications
        ],
        "vitals": [
            {
                "id": vital.id,
                "heart_rate": vital.heart_rate,
                "oxygen_level": vital.oxygen_level,
                "blood_pressure":
                    getattr(
                        vital,
                        "blood_pressure",
                        None
                    ),
                "temperature":
                    getattr(
                        vital,
                        "temperature",
                        None
                    ),
                "recorded_at":
                    vital.recorded_at.isoformat()
                    if vital.recorded_at
                    else None,
            }
            for vital in vitals
        ],
        "assessments": [
            {
                "id": assessment.id,
                "risk_level":
                    assessment.risk_level,
                "created_at":
                    assessment.created_at.isoformat()
                    if assessment.created_at
                    else None,
                "score":
                    getattr(
                        assessment,
                        "score",
                        None
                    ),
                "summary":
                    getattr(
                        assessment,
                        "summary",
                        None
                    ),
            }
            for assessment in assessments
        ],
    })


@doctor_bp.get("/patients/<int:elder_id>/medications")
@jwt_required()
def doctor_patient_medications(elder_id):
    doctor, error = get_current_doctor()

    if error:
        return error

    if not is_linked_doctor_to_elder(
        doctor.id,
        elder_id
    ):
        return jsonify({
            "status": "error",
            "message": "You are not authorized to view this patient."
        }), 403

    medications = (
        Medication.query
        .filter_by(
            elder_id=elder_id,
            is_active=True
        )
        .order_by(Medication.name.asc())
        .all()
    )

    return jsonify({
        "status": "success",
        "medications": [
            serialize_medication(medication)
            for medication in medications
        ]
    })


@doctor_bp.get("/patients/<int:elder_id>/medications/adherence")
@jwt_required()
def doctor_patient_medication_adherence(elder_id):
    doctor, error = get_current_doctor()

    if error:
        return error

    if not is_linked_doctor_to_elder(
        doctor.id,
        elder_id
    ):
        return jsonify({
            "status": "error",
            "message": "You are not authorized to view this patient."
        }), 403

    days = request.args.get(
        "days",
        default=7,
        type=int
    )

    adherence = get_medication_adherence(
        elder_id,
        days=days
    )

    adherence["streak"] = calculate_streak(
        elder_id
    )

    return jsonify({
        "status": "success",
        "adherence": adherence
    })


@doctor_bp.get("/patients/<int:elder_id>/medications/history")
@jwt_required()
def doctor_patient_medication_history(elder_id):
    doctor, error = get_current_doctor()

    if error:
        return error

    if not is_linked_doctor_to_elder(
        doctor.id,
        elder_id
    ):
        return jsonify({
            "status": "error",
            "message": "You are not authorized to view this patient."
        }), 403

    days = request.args.get(
        "days",
        default=30,
        type=int
    )

    days = max(1, min(days, 90))

    cutoff = datetime.now() - timedelta(
        days=days
    )

    medications = (
        Medication.query
        .filter_by(
            elder_id=elder_id
        )
        .all()
    )

    medication_ids = [
        medication.id
        for medication in medications
    ]

    if not medication_ids:
        return jsonify({
            "status": "success",
            "history": []
        })

    logs = (
        MedicationLog.query
        .filter(
            MedicationLog.medication_id.in_(
                medication_ids
            ),
            MedicationLog.scheduled_at >= cutoff
        )
        .order_by(
            MedicationLog.scheduled_at.desc()
        )
        .all()
    )

    medication_map = {
        medication.id: medication
        for medication in medications
    }

    history = []

    for log in logs:
        medication = medication_map.get(
            log.medication_id
        )

        if not medication:
            continue

        schedule = (
            db.session.get(
                MedicationSchedule,
                log.schedule_id
            )
            if log.schedule_id
            else None
        )

        log_time = getattr(log, "created_at", None) or getattr(log, "logged_at", None) or getattr(log, "timestamp", None)

        history.append({
            "id": log.id,
            "medication_id":
                medication.id,
            "medication_name":
                medication.name,
            "dosage":
                medication.dosage,
            "schedule_id":
                log.schedule_id,
            "scheduled_time": (
                schedule.time.strftime("%H:%M")
                if schedule and schedule.time
                else None
            ),
            "scheduled_at":
                log.scheduled_at.isoformat()
                if log.scheduled_at
                else None,
            "actual_taken_at": (
                log_time.isoformat()
                if str(log.status).upper() == "TAKEN"
                and log_time
                else None
            ),
            "status":
                str(log.status).upper(),
            "missed_reason":
                getattr(
                    log,
                    "missed_reason",
                    None
                ),
            "notes":
                getattr(
                    log,
                    "notes",
                    None
                ),
        })

    return jsonify({
        "status": "success",
        "days": days,
        "history": history
    })


@doctor_bp.get("/patients/<int:elder_id>/medications/report")
@jwt_required()
def doctor_patient_medication_report(elder_id):
    doctor, error = get_current_doctor()

    if error:
        return error

    if not is_linked_doctor_to_elder(
        doctor.id,
        elder_id
    ):
        return jsonify({
            "status": "error",
            "message": "You are not authorized to view this patient."
        }), 403

    days = request.args.get(
        "days",
        default=30,
        type=int
    )

    days = max(1, min(days, 90))

    elder = db.session.get(
        ElderProfile,
        elder_id
    )

    if not elder:
        return jsonify({
            "status": "error",
            "message": "Patient not found."
        }), 404

    elder_name = get_elder_name(elder)

    medications = (
        Medication.query
        .filter_by(elder_id=elder_id)
        .all()
    )

    medication_ids = [
        medication.id
        for medication in medications
    ]

    cutoff = datetime.now() - timedelta(
        days=days
    )

    logs = []

    if medication_ids:
        logs = (
            MedicationLog.query
            .filter(
                MedicationLog.medication_id.in_(
                    medication_ids
                ),
                MedicationLog.scheduled_at >= cutoff
            )
            .order_by(
                MedicationLog.scheduled_at.desc()
            )
            .all()
        )

    medication_map = {
        medication.id: medication
        for medication in medications
    }

    output = io.StringIO()

    writer = csv.writer(output)

    writer.writerow([
        "Elder Name",
        "Medicine Name",
        "Dose",
        "Scheduled Time",
        "Marked as Taken At",
        "Date",
        "Status",
        "Missed Reason",
        "Adherence",
    ])

    for log in logs:
        medication = medication_map.get(
            log.medication_id
        )

        if not medication:
            continue

        schedule = (
            db.session.get(
                MedicationSchedule,
                log.schedule_id
            )
            if log.schedule_id
            else None
        )

        status = str(
            log.status
        ).upper()

        scheduled_at = log.scheduled_at

        actual_taken = ""

        log_time = getattr(log, "created_at", None) or getattr(log, "logged_at", None) or getattr(log, "timestamp", None)

        if (
            status == "TAKEN"
            and log_time
        ):
            actual_taken = (
                f"Marked as taken at "
                f"{log_time.strftime('%I:%M %p')}"
            )

        adherence = (
            "Taken"
            if status == "TAKEN"
            else "Missed"
            if status == "MISSED"
            else "Pending"
        )

        writer.writerow([
            elder_name,
            medication.name,
            medication.dosage or "",
            (
                schedule.time.strftime("%I:%M %p")
                if schedule and schedule.time
                else ""
            ),
            actual_taken,
            (
                scheduled_at.strftime("%Y-%m-%d")
                if scheduled_at
                else ""
            ),
            status,
            getattr(
                log,
                "missed_reason",
                None
            ) or "",
            adherence,
        ])

    filename = (
        f"elder_sense_medication_report_"
        f"{elder_id}.csv"
    )

    response = Response(
        output.getvalue(),
        mimetype="text/csv"
    )

    response.headers["Content-Disposition"] = (
        f'attachment; filename="{filename}"'
    )

    return response