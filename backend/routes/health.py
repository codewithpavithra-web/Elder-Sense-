from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models import User, ElderProfile, Vital, HealthAssessment


health_bp = Blueprint(
    "health",
    __name__,
    url_prefix="/api/health"
)


def get_current_elder():
    user_id = get_jwt_identity()

    user = db.session.get(User, int(user_id))

    if not user:
        return None, "User not found."

    elder = ElderProfile.query.filter_by(
        user_id=user.id
    ).first()

    if not elder:
        return None, "Elder profile not found."

    return elder, None


# ============================================================
# GET ALL VITALS
# ============================================================

@health_bp.route("/vitals", methods=["GET"])
@jwt_required()
def get_vitals():

    elder, error = get_current_elder()

    if error:
        return jsonify({
            "status": "error",
            "message": error
        }), 404

    vitals = (
        Vital.query
        .filter_by(elder_id=elder.id)
        .order_by(Vital.recorded_at.desc())
        .limit(20)
        .all()
    )

    return jsonify({
        "status": "success",
        "vitals": [
            {
                "id": vital.id,
                "recorded_at": (
                    vital.recorded_at.isoformat()
                    if vital.recorded_at
                    else None
                ),
                "blood_pressure": vital.blood_pressure,
                "heart_rate": vital.heart_rate,
                "blood_sugar": vital.blood_sugar,
                "temperature": vital.temperature,
                "oxygen_level": vital.oxygen_level,
                "weight": vital.weight,
                "notes": vital.notes
            }
            for vital in vitals
        ]
    })


# ============================================================
# ADD VITALS
# ============================================================

@health_bp.route("/vitals", methods=["POST"])
@jwt_required()
def add_vitals():

    elder, error = get_current_elder()

    if error:
        return jsonify({
            "status": "error",
            "message": error
        }), 404

    data = request.get_json() or {}

    bp = str(data.get("blood_pressure") or "").strip() or None
    if bp:
        parts = bp.split("/", 1)
        if len(parts) != 2:
            return jsonify({"status": "error", "message": "Blood pressure must be entered as systolic/diastolic, for example 120/80."}), 400
        try:
            if float(parts[0]) <= 0 or float(parts[1]) <= 0:
                raise ValueError
        except ValueError:
            return jsonify({"status": "error", "message": "Enter valid positive systolic and diastolic blood-pressure values."}), 400

    vital = Vital(
        elder_id=elder.id,
        blood_pressure=bp,
        heart_rate=data.get("heart_rate"),
        blood_sugar=data.get("blood_sugar"),
        temperature=data.get("temperature"),
        oxygen_level=data.get("oxygen_level"),
        weight=data.get("weight"),
        notes=data.get("notes")
    )

    db.session.add(vital)
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": "Vitals recorded successfully.",
        "vital": {
            "id": vital.id,
            "recorded_at": vital.recorded_at.isoformat(),
            "blood_pressure": vital.blood_pressure,
            "heart_rate": vital.heart_rate,
            "blood_sugar": vital.blood_sugar,
            "temperature": vital.temperature,
            "oxygen_level": vital.oxygen_level,
            "weight": vital.weight,
            "notes": vital.notes
        }
    }), 201


# ============================================================
# DELETE A VITAL RECORD
# ============================================================

@health_bp.route("/vitals/<int:vital_id>", methods=["DELETE"])
@jwt_required()
def delete_vital(vital_id):

    elder, error = get_current_elder()

    if error:
        return jsonify({
            "status": "error",
            "message": error
        }), 404

    vital = (
        Vital.query
        .filter_by(
            id=vital_id,
            elder_id=elder.id
        )
        .first()
    )

    if not vital:
        return jsonify({
            "status": "error",
            "message": "Vital record not found."
        }), 404

    db.session.delete(vital)
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": "Vital record deleted successfully."
    })


# ============================================================
# HEALTH ASSESSMENT
# ============================================================

@health_bp.route("/assessment", methods=["GET"])
@jwt_required()
def get_latest_assessment():
    elder, error = get_current_elder()

    if error:
        return jsonify({
            "status": "error",
            "message": error
        }), 404

    assessment = (
        HealthAssessment.query
        .filter_by(elder_id=elder.id)
        .order_by(HealthAssessment.created_at.desc())
        .first()
    )

    if not assessment:
        return jsonify({
            "status": "success",
            "assessment": None
        })

    return jsonify({
        "status": "success",
        "assessment": {
            "id": assessment.id,
            "risk_level": assessment.risk_level,
            "risk_score": assessment.risk_score,
            "prediction": assessment.prediction,
            "recommendations": assessment.recommendations,
            "model_name": assessment.model_name,
            "created_at": assessment.created_at.isoformat()
        }
    })


@health_bp.route("/assessment", methods=["POST"])
@jwt_required()
def health_assessment():

    elder, error = get_current_elder()

    if error:
        return jsonify({
            "status": "error",
            "message": error
        }), 404

    latest_vital = (
        Vital.query
        .filter_by(elder_id=elder.id)
        .order_by(Vital.recorded_at.desc())
        .first()
    )

    if not latest_vital:
        return jsonify({
            "status": "error",
            "message": (
                "Please record at least one vital before "
                "running the assessment."
            )
        }), 400

    score = 0
    factors = []

    if latest_vital.blood_pressure:
        try:
            systolic, diastolic = [float(part.strip()) for part in latest_vital.blood_pressure.split("/", 1)]
            if systolic >= 140 or diastolic >= 90:
                score += 2
                factors.append("elevated blood pressure")
            elif systolic >= 130 or diastolic >= 80:
                score += 1
                factors.append("borderline blood pressure")
        except (ValueError, AttributeError):
            pass

    if latest_vital.heart_rate is not None:
        if (
            latest_vital.heart_rate > 100
            or latest_vital.heart_rate < 50
        ):
            score += 2
            factors.append(
                "heart-rate reading outside the usual range"
            )
        elif latest_vital.heart_rate > 90:
            score += 1
            factors.append("higher heart rate")

    if latest_vital.blood_sugar is not None:
        if latest_vital.blood_sugar >= 200:
            score += 2
            factors.append("high blood sugar reading")
        elif latest_vital.blood_sugar >= 140:
            score += 1
            factors.append(
                "elevated blood sugar reading"
            )

    if latest_vital.temperature is not None:
        if latest_vital.temperature >= 38:
            score += 2
            factors.append("elevated temperature")

    if latest_vital.oxygen_level is not None:
        if latest_vital.oxygen_level < 92:
            score += 3
            factors.append("low oxygen reading")
        elif latest_vital.oxygen_level < 95:
            score += 1
            factors.append(
                "oxygen reading below typical levels"
            )

    if score >= 5:
        risk_level = "HIGH"
        prediction = (
            "The recorded measurements contain several values "
            "that may require medical attention."
        )
    elif score >= 2:
        risk_level = "MODERATE"
        prediction = (
            "Some recorded measurements may need monitoring "
            "and discussion with a healthcare professional."
        )
    else:
        risk_level = "LOW"
        prediction = (
            "The available measurements do not indicate major "
            "risk factors according to this prototype assessment."
        )

    if factors:
        recommendations = (
            "Factors considered: "
            + ", ".join(factors)
            + ". Continue monitoring your readings and discuss "
              "unusual or persistent results with a healthcare "
              "professional."
        )
    else:
        recommendations = (
            "Continue recording your vital signs regularly and "
            "follow your healthcare professional's advice."
        )

    assessment = HealthAssessment(
        elder_id=elder.id,
        risk_level=risk_level,
        risk_score=float(score),
        prediction=prediction,
        recommendations=recommendations,
        model_name="Elder Sense Prototype Risk Assessment"
    )

    db.session.add(assessment)
    db.session.commit()

    return jsonify({
        "status": "success",
        "assessment": {
            "id": assessment.id,
            "risk_level": assessment.risk_level,
            "risk_score": assessment.risk_score,
            "prediction": assessment.prediction,
            "recommendations": assessment.recommendations,
            "model_name": assessment.model_name,
            "created_at": assessment.created_at.isoformat()
        }
    })