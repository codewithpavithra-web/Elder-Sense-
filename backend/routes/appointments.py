from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime

from extensions import db
from models import (
    Appointment,
    ElderProfile,
    DoctorProfile,
    User,
    DoctorElderLink,
    CaregiverProfile,
    CaregiverElderLink,
)


appointments_bp = Blueprint(
    "appointments",
    __name__,
    url_prefix="/api/appointments"
)


# =================================================
# CURRENT USER HELPER
# =================================================

def get_current_user():
    user_id = get_jwt_identity()

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        return None

    return db.session.get(User, user_id)


# =================================================
# DOCTOR SERIALIZER
# =================================================

def doctor_to_dict(doctor):
    doctor_user = db.session.get(
        User,
        doctor.user_id
    )

    return {
        "id": doctor.id,
        "user_id": doctor.user_id,
        "name": (
            doctor_user.full_name
            if doctor_user
            else "Doctor"
        ),
        "email": (
            doctor_user.email
            if doctor_user
            else ""
        ),
        "specialization": doctor.specialization,
        "qualification": doctor.qualification,
        "experience_years": doctor.experience_years,
        "hospital": doctor.hospital,
        "phone": (
            doctor_user.phone
            if doctor_user
            else ""
        ),
        "bio": doctor.bio,
        "is_available": doctor.is_available,
        "city": doctor.city,
    }


# =================================================
# APPOINTMENT SERIALIZER
# =================================================

def appointment_to_dict(appointment):
    elder = db.session.get(
        ElderProfile,
        appointment.elder_id
    )

    doctor = db.session.get(
        DoctorProfile,
        appointment.doctor_id
    )

    elder_user = (
        db.session.get(
            User,
            elder.user_id
        )
        if elder
        else None
    )

    doctor_user = (
        db.session.get(
            User,
            doctor.user_id
        )
        if doctor
        else None
    )

    return {
        "id": appointment.id,

        "appointment_date": (
            appointment.appointment_date.isoformat()
            if appointment.appointment_date
            else None
        ),

        "status": appointment.status,

        "reason": appointment.reason,

        "notes": appointment.notes,

        "elder": {
            "id": (
                elder.id
                if elder
                else None
            ),
            "name": (
                elder_user.full_name
                if elder_user
                else "Elder"
            )
        },

        "doctor": {
            "id": (
                doctor.id
                if doctor
                else None
            ),
            "name": (
                doctor_user.full_name
                if doctor_user
                else "Doctor"
            ),
            "specialization": (
                doctor.specialization
                if doctor
                else ""
            ),
            "hospital": (
                doctor.hospital
                if doctor
                else ""
            ),
            "city": (
                doctor.city
                if doctor
                else ""
            )
        }
    }


# =================================================
# GET DOCTORS
# =================================================

@appointments_bp.route("/doctors", methods=["GET"])
@jwt_required()
def get_doctors():

    current_user = get_current_user()

    if not current_user:
        return jsonify({
            "status": "error",
            "message": "User not found."
        }), 404

    city = request.args.get(
        "city",
        ""
    ).strip()

    query = (
        DoctorProfile.query
        .join(User, DoctorProfile.user_id == User.id)
        .filter(User.role == "DOCTOR")
        .filter(DoctorProfile.is_available.is_(True))
        .filter(~User.email.ilike("%demo%"))
        .filter(~db.func.coalesce(DoctorProfile.license_number, "").ilike("DEMO%"))
        .filter(~db.func.coalesce(DoctorProfile.bio, "").ilike("%demo doctor%"))
    )

    # ---------------------------------------------
    # CITY FILTER
    # ---------------------------------------------

    if city:
        query = query.filter(DoctorProfile.city.ilike(city))

    doctors = (
        query
        .order_by(
            User.full_name.asc()
        )
        .all()
    )

    return jsonify({
        "status": "success",

        "city": (
            city
            if city
            else "All Cities"
        ),

        "doctor_count": len(doctors),
        "source": "Elder Sense registered doctor profiles",
        "availability_note": "Only registered profiles marked available are shown. This is not a complete city-wide medical directory and does not guarantee an appointment slot.",

        "doctors": [
            doctor_to_dict(doctor)
            for doctor in doctors
        ]
    })


# =================================================
# CREATE APPOINTMENT
# =================================================

@appointments_bp.route("", methods=["POST"])
@jwt_required()
def create_appointment():

    current_user = get_current_user()

    if not current_user:
        return jsonify({
            "status": "error",
            "message": "User not found."
        }), 404


    # =============================================
    # ELDER BOOKING
    # =============================================

    if current_user.role == "ELDER":

        elder = ElderProfile.query.filter_by(
            user_id=current_user.id
        ).first()

        if not elder:
            return jsonify({
                "status": "error",
                "message": "Elder profile not found."
            }), 404


    # =============================================
    # CAREGIVER BOOKING
    # =============================================

    elif current_user.role == "CAREGIVER":

        data = request.get_json() or {}

        elder_id = data.get(
            "elder_id"
        )

        if not elder_id:
            return jsonify({
                "status": "error",
                "message": "Please select an elder."
            }), 400

        caregiver = CaregiverProfile.query.filter_by(
            user_id=current_user.id
        ).first()

        if not caregiver:
            return jsonify({
                "status": "error",
                "message": "Caregiver profile not found."
            }), 404

        link = (
            CaregiverElderLink.query
            .filter_by(
                caregiver_id=caregiver.id,
                elder_id=elder_id,
                is_active=True
            )
            .first()
        )

        if not link:
            return jsonify({
                "status": "error",
                "message": "You are not linked to this elder."
            }), 403

        elder = db.session.get(
            ElderProfile,
            elder_id
        )

        if not elder:
            return jsonify({
                "status": "error",
                "message": "Elder not found."
            }), 404


    # =============================================
    # OTHER ROLES
    # =============================================

    else:

        return jsonify({
            "status": "error",
            "message": (
                "Only elders and caregivers "
                "can book appointments."
            )
        }), 403


    # =============================================
    # APPOINTMENT DATA
    # =============================================

    data = request.get_json() or {}

    doctor_id = data.get(
        "doctor_id"
    )

    appointment_date = data.get(
        "appointment_date"
    )

    reason = data.get(
        "reason",
        ""
    )

    notes = data.get(
        "notes",
        ""
    )


    # =============================================
    # VALIDATION
    # =============================================

    if not doctor_id or not appointment_date:

        return jsonify({
            "status": "error",
            "message": (
                "Doctor and appointment date "
                "are required."
            )
        }), 400


    doctor = db.session.get(
        DoctorProfile,
        doctor_id
    )

    if not doctor:

        return jsonify({
            "status": "error",
            "message": "Doctor not found."
        }), 404


    # =============================================
    # DATE VALIDATION
    # =============================================

    try:

        appointment_datetime = datetime.fromisoformat(
            appointment_date
        )

    except (TypeError, ValueError):

        return jsonify({
            "status": "error",
            "message": (
                "Invalid appointment date and time."
            )
        }), 400


    # =============================================
    # CREATE APPOINTMENT
    # =============================================

    appointment = Appointment(
        elder_id=elder.id,
        doctor_id=doctor.id,
        appointment_date=appointment_datetime,
        status="PENDING",
        reason=reason,
        notes=notes,
    )

    db.session.add(
        appointment
    )


    # =============================================
    # AUTOMATICALLY LINK DOCTOR AND ELDER
    # =============================================

    existing_link = (
        DoctorElderLink.query
        .filter_by(
            doctor_id=doctor.id,
            elder_id=elder.id
        )
        .first()
    )

    if not existing_link:

        existing_link = DoctorElderLink(
            doctor_id=doctor.id,
            elder_id=elder.id,
            is_active=True
        )

        db.session.add(
            existing_link
        )


    db.session.commit()


    return jsonify({

        "status": "success",

        "message": (
            "Appointment booked successfully."
        ),

        "appointment": appointment_to_dict(
            appointment
        )

    }), 201


# =================================================
# GET MY APPOINTMENTS
# =================================================

@appointments_bp.route("", methods=["GET"])
@jwt_required()
def get_my_appointments():

    current_user = get_current_user()

    if not current_user:

        return jsonify({
            "status": "error",
            "message": "User not found."
        }), 404


    appointments = []


    # =============================================
    # ELDER APPOINTMENTS
    # =============================================

    if current_user.role == "ELDER":

        elder = ElderProfile.query.filter_by(
            user_id=current_user.id
        ).first()

        if elder:

            appointments = (
                Appointment.query
                .filter_by(
                    elder_id=elder.id
                )
                .order_by(
                    Appointment.appointment_date.desc()
                )
                .all()
            )


    # =============================================
    # CAREGIVER APPOINTMENTS
    # =============================================

    elif current_user.role == "CAREGIVER":

        caregiver = CaregiverProfile.query.filter_by(
            user_id=current_user.id
        ).first()

        if caregiver:

            links = (
                CaregiverElderLink.query
                .filter_by(
                    caregiver_id=caregiver.id,
                    is_active=True
                )
                .all()
            )

            elder_ids = [
                link.elder_id
                for link in links
            ]

            if elder_ids:

                appointments = (
                    Appointment.query
                    .filter(
                        Appointment.elder_id.in_(
                            elder_ids
                        )
                    )
                    .order_by(
                        Appointment.appointment_date.desc()
                    )
                    .all()
                )


    # =============================================
    # DOCTOR APPOINTMENTS
    # =============================================

    elif current_user.role == "DOCTOR":

        doctor = DoctorProfile.query.filter_by(
            user_id=current_user.id
        ).first()

        if doctor:

            appointments = (
                Appointment.query
                .filter_by(
                    doctor_id=doctor.id
                )
                .order_by(
                    Appointment.appointment_date.desc()
                )
                .all()
            )


    # =============================================
    # INVALID ROLE
    # =============================================

    else:

        return jsonify({
            "status": "error",
            "message": "Access denied."
        }), 403


    return jsonify({

        "status": "success",

        "appointments": [
            appointment_to_dict(
                appointment
            )
            for appointment in appointments
        ]

    })


# =================================================
# DOCTOR: UPDATE APPOINTMENT STATUS
# =================================================

@appointments_bp.route(
    "/<int:appointment_id>/status",
    methods=["PUT"]
)
@jwt_required()
def update_appointment_status(appointment_id):

    current_user = get_current_user()


    # =============================================
    # USER VALIDATION
    # =============================================

    if not current_user:

        return jsonify({
            "status": "error",
            "message": "User not found."
        }), 404


    # =============================================
    # DOCTOR ONLY
    # =============================================

    if current_user.role != "DOCTOR":

        return jsonify({
            "status": "error",
            "message": (
                "Only doctors can update "
                "appointment status."
            )
        }), 403


    # =============================================
    # DOCTOR PROFILE
    # =============================================

    doctor = DoctorProfile.query.filter_by(
        user_id=current_user.id
    ).first()

    if not doctor:

        return jsonify({
            "status": "error",
            "message": "Doctor profile not found."
        }), 404


    # =============================================
    # FIND APPOINTMENT
    # =============================================

    appointment = db.session.get(
        Appointment,
        appointment_id
    )

    if not appointment:

        return jsonify({
            "status": "error",
            "message": "Appointment not found."
        }), 404


    # =============================================
    # AUTHORIZATION
    # =============================================

    if appointment.doctor_id != doctor.id:

        return jsonify({
            "status": "error",
            "message": (
                "You are not authorized to "
                "update this appointment."
            )
        }), 403


    # =============================================
    # REQUEST DATA
    # =============================================

    data = request.get_json() or {}

    new_status = str(
        data.get(
            "status",
            ""
        )
    ).strip().upper()


    # =============================================
    # VALID STATUSES
    # =============================================

    allowed_statuses = {
        "PENDING",
        "CONFIRMED",
        "CANCELLED",
        "COMPLETED"
    }


    if new_status not in allowed_statuses:

        return jsonify({
            "status": "error",
            "message": (
                "Invalid appointment status. "
                "Use PENDING, CONFIRMED, "
                "CANCELLED, or COMPLETED."
            )
        }), 400


    # =============================================
    # UPDATE STATUS
    # =============================================

    appointment.status = new_status

    db.session.commit()


    # =============================================
    # RESPONSE
    # =============================================

    return jsonify({

        "status": "success",

        "message": (
            f"Appointment marked as "
            f"{new_status.lower()}."
        ),

        "appointment": appointment_to_dict(
            appointment
        )

    }), 200