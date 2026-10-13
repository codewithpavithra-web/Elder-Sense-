from datetime import timedelta

import bcrypt
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
)

from extensions import db
from models import User, ElderProfile, CaregiverProfile, DoctorProfile


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}

    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    role = data.get("role", "ELDER").strip().upper()

    if not full_name or not email or not password:
        return jsonify({
            "status": "error",
            "message": "Full name, email and password are required."
        }), 400

    if role not in {"ELDER", "CAREGIVER", "DOCTOR"}:
        return jsonify({
            "status": "error",
            "message": "Invalid role."
        }), 400

    if len(password) < 6:
        return jsonify({
            "status": "error",
            "message": "Password must contain at least 6 characters."
        }), 400

    existing_user = User.query.filter_by(email=email).first()

    if existing_user:
        return jsonify({
            "status": "error",
            "message": "An account with this email already exists."
        }), 409

    password_hash = bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")

    user = User(
        full_name=full_name,
        email=email,
        password_hash=password_hash,
        role=role,
        phone=data.get("phone"),
        profile_image=data.get("profile_image"),
    )

    db.session.add(user)
    db.session.flush()

    if role == "ELDER":
        profile = ElderProfile(user_id=user.id)
        db.session.add(profile)

    elif role == "CAREGIVER":
        profile = CaregiverProfile(
            user_id=user.id,
            relationship_to_elder=data.get("relationship_to_elder")
        )
        db.session.add(profile)

    elif role == "DOCTOR":
        profile = DoctorProfile(
            user_id=user.id,
            specialization=data.get("specialization"),
            qualification=data.get("qualification"),
            experience_years=data.get("experience_years"),
            hospital=data.get("hospital"),
            license_number=data.get("license_number"),
            bio=data.get("bio"),
            # New doctor profiles are not publicly listed until an
            # administrator verifies the supplied professional details.
            is_available=False,
        )
        db.session.add(profile)

    db.session.commit()

    return jsonify({
        "status": "success",
        "message": "Account created successfully.",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role
        }
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({
            "status": "error",
            "message": "Email and password are required."
        }), 400

    user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({
            "status": "error",
            "message": "Invalid email or password."
        }), 401

    password_valid = bcrypt.checkpw(
        password.encode("utf-8"),
        user.password_hash.encode("utf-8")
    )

    if not password_valid:
        return jsonify({
            "status": "error",
            "message": "Invalid email or password."
        }), 401

    access_token = create_access_token(
        identity=str(user.id),
        expires_delta=timedelta(hours=24)
    )

    return jsonify({
        "status": "success",
        "message": "Login successful.",
        "access_token": access_token,
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role
        }
    })


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    user_id = get_jwt_identity()

    user = db.session.get(User, int(user_id))

    if not user:
        return jsonify({
            "status": "error",
            "message": "User not found."
        }), 404

    return jsonify({
        "status": "success",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "phone": user.phone,
            "profile_image": user.profile_image
        }
    })