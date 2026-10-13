from datetime import datetime
import base64
import re

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func

from extensions import db
from models import User, ElderProfile, NutritionRecord, Medication, MedicineInformation

nutrition_bp = Blueprint("nutrition", __name__, url_prefix="/api/nutrition")

DISCLAIMER = (
    "Nutrition values are rough estimates based on typical portions, not exact measurements. "
    "They are not medical advice."
)
SAFETY_NOTE = (
    "These are general suggestions, not a prescribed medical diet. Confirm food–medicine "
    "interactions and special dietary needs with a doctor or pharmacist."
)

# Approximate nutrition per commonly used serving. These are intentionally estimates.
# Values: calories, protein_g, carbohydrates_g, fat_g, serving description.
FOOD_DATA = {
    "idli": (58, 2, 12, 0.4, "1 medium idli"),
    "dosa": (168, 4, 27, 5, "1 medium plain dosa"),
    "masala dosa": (300, 6, 45, 10, "1 medium masala dosa"),
    "chapati": (120, 3, 20, 3, "1 medium chapati"),
    "roti": (120, 3, 20, 3, "1 medium roti"),
    "rice": (205, 4, 45, 0.4, "1 cup cooked rice"),
    "white rice": (205, 4, 45, 0.4, "1 cup cooked rice"),
    "brown rice": (216, 5, 45, 2, "1 cup cooked brown rice"),
    "sambar": (110, 5, 17, 2, "1 cup sambar"),
    "dal": (180, 10, 30, 3, "1 cup cooked dal"),
    "curd": (100, 6, 8, 4, "1 cup plain curd"),
    "yogurt": (100, 6, 8, 4, "1 cup plain yogurt"),
    "milk": (122, 8, 12, 5, "1 cup milk"),
    "boiled egg": (78, 6, 1, 5, "1 large boiled egg"),
    "egg": (78, 6, 1, 5, "1 large egg, approximate"),
    "chicken": (220, 31, 0, 10, "100 g cooked chicken; preparation varies"),
    "fish": (180, 25, 0, 8, "100 g cooked fish; type varies"),
    "banana": (105, 1, 27, 0.4, "1 medium banana"),
    "apple": (95, 0.5, 25, 0.3, "1 medium apple"),
    "orange": (62, 1, 15, 0.2, "1 medium orange"),
    "oats": (150, 5, 27, 3, "40 g dry oats prepared with water"),
    "upma": (250, 6, 38, 8, "1 cup vegetable upma"),
    "poha": (250, 5, 45, 6, "1 cup poha; recipe varies"),
    "pongal": (280, 8, 42, 8, "1 cup pongal; recipe varies"),
    "vegetable curry": (140, 4, 18, 6, "1 cup vegetable curry; recipe varies"),
    "salad": (50, 2, 10, 0.5, "1 cup simple vegetable salad"),
    "peanuts": (170, 7, 6, 14, "28 g peanuts"),
    "almonds": (164, 6, 6, 14, "28 g almonds"),
    "bread": (80, 3, 15, 1, "1 slice bread"),
    "biscuit": (70, 1, 10, 3, "1 small biscuit; brand varies"),
    "potato": (130, 3, 30, 0.2, "1 medium boiled potato"),
}


def get_current_elder():
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        return None, "Invalid login session. Please sign in again."
    user = db.session.get(User, user_id)
    if not user:
        return None, "User not found."
    elder = ElderProfile.query.filter_by(user_id=user.id).first()
    if not elder:
        return None, "Elder profile not found."
    return elder, None


def error_response(message, status=400):
    return jsonify({"status": "error", "message": message}), status


def safe_float(value, default=0.0):
    try:
        number = float(value)
        return number if number >= 0 and number < 1_000_000 else default
    except (ValueError, TypeError):
        return default


def safe_non_negative_number(value, default=0):
    return max(0, round(safe_float(value, default)))


def normalize_macros(analysis):
    return {
        "protein_grams": safe_non_negative_number(analysis.get("protein_grams", analysis.get("protein", 0))),
        "carbohydrates_grams": safe_non_negative_number(analysis.get("carbohydrates_grams", analysis.get("carbohydrates", 0))),
        "fat_grams": safe_non_negative_number(analysis.get("fat_grams", analysis.get("fats", 0))),
    }


def estimate_food_text(food_items):
    """Offline estimate for foods in FOOD_DATA; unknown foods are not fabricated."""
    text = re.sub(r"\s+", " ", str(food_items).lower()).strip()
    # Parse optional quantity immediately before a known food, e.g. "2 idli, 1 banana".
    chunks = [c.strip() for c in re.split(r"[,;+\n]", text) if c.strip()]
    foods = []
    unknown = []
    for chunk in chunks:
        match = re.match(r"^(\d+(?:\.\d+)?)\s+(.+)$", chunk)
        qty = float(match.group(1)) if match else 1.0
        phrase = match.group(2).strip() if match else chunk
        # Prefer the longest matching food phrase to avoid matching "dosa" inside "masala dosa".
        candidates = sorted(FOOD_DATA.keys(), key=len, reverse=True)
        key = next((k for k in candidates if k in phrase), None)
        if not key:
            unknown.append(chunk)
            continue
        calories, protein, carbs, fat, serving = FOOD_DATA[key]
        foods.append({
            "name": key.title(),
            "portion": f"{qty:g} × {serving}",
            "estimated_calories": round(calories * qty),
            "estimated_protein_grams": round(protein * qty),
            "estimated_carbohydrates_grams": round(carbs * qty),
            "estimated_fat_grams": round(fat * qty),
            "confidence": "medium",
        })
    if not foods:
        return None, unknown or [text]
    total_calories = sum(x["estimated_calories"] for x in foods)
    protein = sum(x["estimated_protein_grams"] for x in foods)
    carbs = sum(x["estimated_carbohydrates_grams"] for x in foods)
    fat = sum(x["estimated_fat_grams"] for x in foods)
    # A modest, transparent balance score—not a medical assessment.
    score = 50
    if len(foods) >= 2:
        score += 10
    if protein >= 8:
        score += 10
    if any(any(v in x["name"].lower() for v in ("salad", "vegetable", "orange", "apple", "banana")) for x in foods):
        score += 10
    if total_calories > 0 and fat / max(total_calories / 9, 1) > 0.5:
        score -= 5
    score = max(0, min(100, score))
    notes = "Offline estimate using typical serving values. Actual nutrition depends on portion size, recipe, oil and ingredients."
    if unknown:
        notes += " No estimate was available for: " + ", ".join(unknown) + ". These items were excluded from totals."
    return {
        "identified_foods": foods,
        "food_items": ", ".join(x["name"] for x in foods),
        "total_estimated_calories": total_calories,
        "protein_grams": protein,
        "carbohydrates_grams": carbs,
        "fat_grams": fat,
        "nutrition_score": score,
        "confidence": "medium" if not unknown else "low",
        "notes": notes,
    }, unknown


def list_active_medications(elder_id):
    meds = Medication.query.filter_by(elder_id=elder_id, is_active=True).all()
    context = []
    for med in meds:
        name = str(getattr(med, "name", "") or "")
        info = None
        if name:
            info = MedicineInformation.query.filter(
                func.lower(MedicineInformation.name) == name.lower()
            ).first()
        context.append({
            "name": name,
            "dosage": getattr(med, "dosage", None),
            "form": getattr(med, "form", None),
            "instructions": getattr(med, "instructions", None),
            "purpose": getattr(med, "purpose", None),
            "known_food_interactions": getattr(info, "food_interactions", None) if info else None,
        })
    return context


def medication_response_items(context):
    return [{"name": m["name"], "dosage": m["dosage"], "purpose": m["purpose"]} for m in context]


@nutrition_bp.route("", methods=["GET"])
@jwt_required()
def get_nutrition_records():
    elder, error = get_current_elder()
    if error:
        return error_response(error, 404)
    try:
        records = NutritionRecord.query.filter_by(elder_id=elder.id).order_by(NutritionRecord.recorded_at.desc()).all()
        result = []
        for record in records:
            item = {
                "id": record.id,
                "meal_type": record.meal_type,
                "food_items": record.food_items,
                "calories": record.calories,
                "nutrition_score": record.nutrition_score,
                "notes": record.notes,
                "recorded_at": record.recorded_at.isoformat() if record.recorded_at else None,
            }
            # Expose macros if the model/table contains them.
            for attr, key in (("protein", "protein"), ("carbohydrates", "carbohydrates"), ("fats", "fats")):
                if hasattr(record, attr):
                    item[key] = getattr(record, attr)
            result.append(item)
        return jsonify({"status": "success", "records": result, "count": len(result)})
    except Exception as exc:
        db.session.rollback()
        print("Get nutrition records error:", exc)
        return error_response("Unable to load nutrition records. Check the nutrition_records database columns.", 500)


@nutrition_bp.route("", methods=["POST"])
@jwt_required()
def add_nutrition_record():
    elder, error = get_current_elder()
    if error:
        return error_response(error, 404)
    data = request.get_json(silent=True) or {}
    meal_type = str(data.get("meal_type", "")).strip()
    food_items = str(data.get("food_items", "")).strip()
    if not meal_type:
        return error_response("Meal type is required.")
    if not food_items:
        return error_response("Food items are required.")
    try:
        calories = float(data["calories"]) if data.get("calories") not in (None, "") else None
        score = float(data["nutrition_score"]) if data.get("nutrition_score") not in (None, "") else None
        if calories is not None and (calories < 0 or calories > 1_000_000):
            raise ValueError
        if score is not None:
            score = max(0, min(100, score))
    except (ValueError, TypeError):
        return error_response("Calories and nutrition score must be valid non-negative numbers.")
    try:
        record = NutritionRecord(
            elder_id=elder.id,
            meal_type=meal_type,
            food_items=food_items,
            calories=calories,
            nutrition_score=score,
            notes=data.get("notes"),
            recorded_at=datetime.utcnow(),
        )
        # Save macro values when these model columns exist.
        for attr, key in (("protein", "protein_grams"), ("carbohydrates", "carbohydrates_grams"), ("fats", "fat_grams")):
            if hasattr(type(record), attr) and data.get(key) not in (None, ""):
                setattr(record, attr, safe_non_negative_number(data.get(key)))
        db.session.add(record)
        db.session.commit()
        return jsonify({"status": "success", "message": "Nutrition record added successfully.", "record_id": record.id}), 201
    except Exception as exc:
        db.session.rollback()
        print("Add nutrition record error:", exc)
        return error_response("Unable to save the nutrition record. Please check the database schema and try again.", 500)


@nutrition_bp.route("/<int:record_id>", methods=["DELETE"])
@jwt_required()
def delete_nutrition_record(record_id):
    elder, error = get_current_elder()
    if error:
        return error_response(error, 404)
    try:
        record = NutritionRecord.query.filter_by(id=record_id, elder_id=elder.id).first()
        if not record:
            return error_response("Nutrition record not found.", 404)
        db.session.delete(record)
        db.session.commit()
        return jsonify({"status": "success", "message": "Nutrition record deleted successfully."})
    except Exception as exc:
        db.session.rollback()
        print("Delete nutrition record error:", exc)
        return error_response("Unable to delete nutrition record right now.", 500)


@nutrition_bp.route("/estimate", methods=["POST"])
@jwt_required()
def estimate_manual_food():
    elder, error = get_current_elder()
    if error:
        return error_response(error, 404)
    data = request.get_json(silent=True) or {}
    food_items = str(data.get("food_items", "")).strip()
    if not food_items:
        return error_response("Food items are required.")
    analysis, unknown = estimate_food_text(food_items)
    if not analysis:
        return jsonify({
            "status": "error",
            "message": "No foods in this entry match the offline nutrition database. Try common foods such as idli, dosa, rice, chapati, dal, curd, egg, chicken, banana or apple. No values were guessed.",
            "unknown_foods": unknown,
        }), 422
    return jsonify({"status": "success", "analysis": analysis, "disclaimer": DISCLAIMER})


@nutrition_bp.route("/scan", methods=["POST"])
@jwt_required()
def scan_food_image():
    elder, error = get_current_elder()
    if error:
        return error_response(error, 404)
    data = request.get_json(silent=True) or {}
    image_data = data.get("image")
    if not image_data:
        return error_response("Food image is required.")
    if not isinstance(image_data, str) or not image_data.startswith("data:image/"):
        return error_response("Invalid image format.")
    if len(image_data) > 12 * 1024 * 1024:
        return error_response("Image is too large.")
    # Do not fabricate image recognition. This endpoint needs a configured vision-capable AI provider.
    return jsonify({
        "status": "error",
        "code": "VISION_PROVIDER_NOT_CONFIGURED",
        "message": "Camera food recognition is temporarily unavailable because no vision AI provider is configured. You can still enter the food names manually to get offline nutrition estimates.",
    }), 503


@nutrition_bp.route("/medication-guidance", methods=["GET"])
@jwt_required()
def medication_food_guidance():
    elder, error = get_current_elder()
    if error:
        return error_response(error, 404)
    try:
        context = list_active_medications(elder.id)
        if not context:
            return jsonify({
                "status": "success", "has_medications": False, "medications": [],
                "recommendations": {"recommended_foods": [], "foods_to_limit": [], "summary": "No active medications are currently recorded.", "safety_note": SAFETY_NOTE},
                "foods_to_limit": [], "message": "No active medications are currently recorded.",
            })
        known = []
        for med in context:
            interaction = med.get("known_food_interactions")
            if interaction and str(interaction).strip():
                known.append({"food": "Check the recorded interaction for " + med["name"], "reason": str(interaction).strip(), "confidence": "database-recorded; confirm with pharmacist"})
        return jsonify({
            "status": "success", "has_medications": True,
            "medications": medication_response_items(context),
            "recommendations": {
                "recommended_foods": [
                    {"food": "A varied meal with vegetables, a protein source and a staple food", "reason": "General balanced-meal idea; adjust to the elder's individual needs.", "confidence": "general guidance"},
                    {"food": "Water throughout the day, unless a clinician has prescribed fluid restriction", "reason": "General hydration reminder.", "confidence": "general guidance"},
                ],
                "foods_to_limit": known,
                "summary": "Only interactions already recorded in the medicine information database are shown. A missing entry does not prove that no interaction exists.",
                "safety_note": SAFETY_NOTE,
            },
        })
    except Exception as exc:
        db.session.rollback()
        print("Medication food guidance error:", exc)
        return error_response("Unable to load medication-based food guidance right now.", 500)


@nutrition_bp.route("/meal-suggestions", methods=["GET"])
@jwt_required()
def ai_meal_suggestions():
    elder, error = get_current_elder()
    if error:
        return error_response(error, 404)
    try:
        medication_context = list_active_medications(elder.id)
        records = NutritionRecord.query.filter_by(elder_id=elder.id).order_by(NutritionRecord.recorded_at.desc()).limit(20).all()
        nutrition_context = [{
            "meal_type": r.meal_type,
            "food_items": r.food_items,
            "calories": r.calories,
            "nutrition_score": r.nutrition_score,
            "notes": r.notes,
            "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
        } for r in records]
        recent_text = " ".join(str(r.get("food_items") or "").lower() for r in nutrition_context)
        suggestions = [
            {"meal_type": "Breakfast", "meal": "Idli with sambar", "foods": ["Idli", "Sambar"], "reason": "A familiar meal with carbohydrates and some protein from lentils.", "medication_note": ""},
            {"meal_type": "Lunch", "meal": "Rice or chapati with dal and vegetables", "foods": ["Rice or chapati", "Dal", "Vegetables"], "reason": "Offers a mix of staple food, plant protein and vegetables.", "medication_note": ""},
            {"meal_type": "Snack", "meal": "A fruit with plain curd, if suitable", "foods": ["Seasonal fruit", "Plain curd"], "reason": "A simple snack option; consider allergies, swallowing needs and individual dietary restrictions.", "medication_note": ""},
            {"meal_type": "Dinner", "meal": "Chapati with vegetable curry and egg, dal or another suitable protein", "foods": ["Chapati", "Vegetable curry", "Suitable protein source"], "reason": "Provides variety across food groups; adapt to preferences and care-team advice.", "medication_note": ""},
        ]
        # Add variety when these foods already appear in the recent record history.
        if "idli" in recent_text:
            suggestions[0] = {"meal_type": "Breakfast", "meal": "Oats with milk or plain curd", "foods": ["Oats", "Milk or curd"], "reason": "A different breakfast option for variety.", "medication_note": ""}
        elif "dosa" in recent_text:
            suggestions[0] = {"meal_type": "Breakfast", "meal": "Idli with sambar", "foods": ["Idli", "Sambar"], "reason": "A different breakfast option for variety.", "medication_note": ""}
        known_interactions = [m for m in medication_context if m.get("known_food_interactions")]
        for item in suggestions:
            if known_interactions:
                item["medication_note"] = "Medicine information is recorded for this elder; confirm any food interactions with a pharmacist. Do not infer an interaction from this suggestion."
        return jsonify({
            "status": "success",
            "has_medications": len(medication_context) > 0,
            "medications": medication_response_items(medication_context),
            "records_used": len(nutrition_context),
            "suggestions": suggestions,
            "summary": "Suggestions are general ideas. They use the available nutrition history for variety but are not a personalized medical diet.",
            "safety_note": SAFETY_NOTE,
        })
    except Exception as exc:
        db.session.rollback()
        print("Meal suggestions error:", exc)
        return error_response("Unable to generate meal suggestions right now.", 500)
