
import os

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from groq import Groq

from extensions import db

from models import (
    User,
    ElderProfile,
    CaregiverProfile,
    DoctorProfile,
    CaregiverElderLink,
    DoctorElderLink,
    AIConversation,
)


ai_bp = Blueprint("ai", __name__, url_prefix="/api/ai")


# =========================================================
# GROQ CONFIGURATION
# =========================================================

GROQ_MODEL = os.getenv(
    "GROQ_MODEL",
    "openai/gpt-oss-20b",
).strip()


# =========================================================
# SUPPORTED RESPONSE LANGUAGES
# =========================================================

SUPPORTED_LANGUAGES = {
    "english": "English",
    "en": "English",
    "en-in": "English",

    "ಕನ್ನಡ": "Kannada",
    "kannada": "Kannada",
    "kn": "Kannada",
    "kn-in": "Kannada",

    "தமிழ்": "Tamil",
    "tamil": "Tamil",
    "ta": "Tamil",
    "ta-in": "Tamil",

    "हिन्दी": "Hindi",
    "हिंदी": "Hindi",
    "hindi": "Hindi",
    "hi": "Hindi",
    "hi-in": "Hindi",

    "తెలుగు": "Telugu",
    "telugu": "Telugu",
    "te": "Telugu",
    "te-in": "Telugu",

    "മലയാളം": "Malayalam",
    "malayalam": "Malayalam",
    "ml": "Malayalam",
    "ml-in": "Malayalam",
}


def normalize_language(value):
    if not isinstance(value, str) or not value.strip():
        return "English"

    value = value.strip()

    return SUPPORTED_LANGUAGES.get(
        value.casefold(),
        SUPPORTED_LANGUAGES.get(value, "English"),
    )


# =========================================================
# AI SAFETY INSTRUCTIONS
# =========================================================

AI_INSTRUCTIONS = """
You are Elder Sense AI Care Assistant.

You help older adults, caregivers, and healthcare professionals
understand general health and elderly-care information.

SAFETY:
1. Give general health education, nutrition suggestions,
   hydration advice, exercise-safety tips, and medication-reminder
   information.
2. Do not diagnose diseases or guarantee medical outcomes.
3. Never invent a person's medical history, prescriptions,
   symptoms, vital signs, or application records.
4. Never instruct a user to start, stop, skip, or change a
   prescription medicine or its dosage without consulting
   a qualified healthcare professional.
5. For chest pain, severe breathing difficulty, stroke symptoms,
   unconsciousness, or severe bleeding, recommend immediate
   emergency medical assistance.
6. Recommend professional assessment for concerning or worsening
   symptoms.
7. Explain uncertainty when necessary.
8. Do not claim to have read patient records unless those records
   were actually supplied in the conversation.
9. Protect the privacy of every user.

ANSWER QUALITY:
1. Answer the actual question directly.
2. Use simple, respectful language suitable for older adults.
3. Use short paragraphs and helpful bullet points.
4. Complete your sentences and lists.
5. Do not unnecessarily repeat the question.
6. Provide practical, general suggestions without inventing facts.
7. Do not claim that AI replaces professional medical care.
"""


# =========================================================
# AUTHENTICATED USER
# =========================================================

def get_authenticated_user():
    identity = get_jwt_identity()

    if identity is None:
        return None

    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        return None

    return db.session.get(User, user_id)


def get_user_role(user):
    role = getattr(user, "role", "")

    if hasattr(role, "value"):
        role = role.value

    return str(role).strip().upper()


# =========================================================
# ELDER ACCESS VALIDATION
# =========================================================

def get_accessible_elder(user, requested_elder_id=None):
    """
    ELDER: own profile only.
    CAREGIVER: actively linked elders only.
    DOCTOR: actively linked elders only.

    Caregivers and doctors may ask general questions without
    selecting an elder.
    """

    role = get_user_role(user)

    if requested_elder_id is not None:
        try:
            requested_elder_id = int(requested_elder_id)

            if requested_elder_id <= 0:
                return None, (
                    jsonify({
                        "success": False,
                        "message": "Invalid elder ID.",
                    }),
                    400,
                )

        except (TypeError, ValueError):
            return None, (
                jsonify({
                    "success": False,
                    "message": "Invalid elder ID.",
                }),
                400,
            )

    if role == "ELDER":
        elder = ElderProfile.query.filter_by(
            user_id=user.id
        ).first()

        if elder is None:
            return None, (
                jsonify({
                    "success": False,
                    "message": "Elder profile not found.",
                }),
                404,
            )

        if (
            requested_elder_id is not None
            and requested_elder_id != elder.id
        ):
            return None, (
                jsonify({
                    "success": False,
                    "message": (
                        "You cannot access another elder's records."
                    ),
                }),
                403,
            )

        return elder, None

    if role == "CAREGIVER":
        caregiver = CaregiverProfile.query.filter_by(
            user_id=user.id
        ).first()

        if caregiver is None:
            return None, (
                jsonify({
                    "success": False,
                    "message": "Caregiver profile not found.",
                }),
                404,
            )

        query = CaregiverElderLink.query.filter_by(
            caregiver_id=caregiver.id,
            is_active=True,
        )

        if requested_elder_id is not None:
            query = query.filter_by(
                elder_id=requested_elder_id
            )

        link = query.first()

        if requested_elder_id is not None and link is None:
            return None, (
                jsonify({
                    "success": False,
                    "message": (
                        "You do not have permission to access "
                        "this elder."
                    ),
                }),
                403,
            )

        if link is not None:
            return db.session.get(
                ElderProfile,
                link.elder_id,
            ), None

        return None, None

    if role == "DOCTOR":
        doctor = DoctorProfile.query.filter_by(
            user_id=user.id
        ).first()

        if doctor is None:
            return None, (
                jsonify({
                    "success": False,
                    "message": "Doctor profile not found.",
                }),
                404,
            )

        query = DoctorElderLink.query.filter_by(
            doctor_id=doctor.id,
            is_active=True,
        )

        if requested_elder_id is not None:
            query = query.filter_by(
                elder_id=requested_elder_id
            )

        link = query.first()

        if requested_elder_id is not None and link is None:
            return None, (
                jsonify({
                    "success": False,
                    "message": (
                        "You do not have permission to access "
                        "this elder."
                    ),
                }),
                403,
            )

        if link is not None:
            return db.session.get(
                ElderProfile,
                link.elder_id,
            ), None

        return None, None

    return None, (
        jsonify({
            "success": False,
            "message": "Your account role is not supported.",
        }),
        403,
    )


# =========================================================
# GROQ RESPONSE GENERATION
# =========================================================

def generate_ai_response(question, language="English"):
    api_key = os.getenv("GROQ_API_KEY", "").strip()

    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is missing from the backend environment."
        )

    model_name = os.getenv(
        "GROQ_MODEL",
        GROQ_MODEL,
    ).strip()

    if not model_name:
        model_name = "openai/gpt-oss-20b"

    language = normalize_language(language)

    client = Groq(
        api_key=api_key,
        timeout=45.0,
        max_retries=0,
    )

    language_instruction = f"""
RESPONSE LANGUAGE:
Write the complete answer in {language}.

Use natural, grammatically correct {language} that an older
adult can understand.

Even if the question is written in another language, answer
in {language}.

Do not switch to English unless English is selected.
Use English medical terms in parentheses only when helpful.
Do not translate the answer into several languages unless asked.
"""

    completion = client.chat.completions.create(
        model=model_name,
        messages=[
            {
                "role": "system",
                "content": (
                    AI_INSTRUCTIONS
                    + "\n\n"
                    + language_instruction
                ),
            },
            {
                "role": "user",
                "content": question,
            },
        ],
        temperature=0.3,
        max_completion_tokens=1800,
    )

    if not completion.choices:
        raise RuntimeError(
            "The AI provider returned no response choices."
        )

    answer = completion.choices[0].message.content

    if not isinstance(answer, str) or not answer.strip():
        raise RuntimeError(
            "The AI provider returned an empty answer."
        )

    return answer.strip()


# =========================================================
# CHAT API
# POST /api/ai/chat
# =========================================================

@ai_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    user = get_authenticated_user()

    if user is None:
        return jsonify({
            "success": False,
            "message": (
                "Your login session is invalid or expired. "
                "Please log in again."
            ),
        }), 401

    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "success": False,
            "message": "Please send a valid JSON request.",
        }), 400

    question = data.get("message") or data.get("question") or ""

    if not isinstance(question, str):
        return jsonify({
            "success": False,
            "message": "Your message must be text.",
        }), 400

    question = question.strip()

    if not question:
        return jsonify({
            "success": False,
            "message": "Please enter a message.",
        }), 400

    if len(question) > 10000:
        return jsonify({
            "success": False,
            "message": (
                "Your message is too long. Please shorten it."
            ),
        }), 400

    selected_language = normalize_language(
        data.get("language")
        or data.get("response_language")
        or "English"
    )

    requested_elder_id = data.get("elder_id")

    elder_profile, access_error = get_accessible_elder(
        user,
        requested_elder_id,
    )

    if access_error is not None:
        return access_error

    try:
        answer = generate_ai_response(
            question=question,
            language=selected_language,
        )

    except Exception as exc:
        # Avoid logging API keys or other secret credentials.
        print(
            f"Groq AI request failed for user {user.id}: "
            f"{type(exc).__name__}: {exc}"
        )

        return jsonify({
            "success": False,
            "message": (
                "The AI assistant is temporarily unavailable. "
                "Please check your API quota, model availability, "
                "and backend configuration."
            ),
            "error": "AI_SERVICE_UNAVAILABLE",
        }), 503

    history_saved = True
    conversation_id = None

    try:
        conversation = AIConversation(
            user_id=user.id,
            question=question,
            answer=answer,
        )

        db.session.add(conversation)
        db.session.commit()

        conversation_id = conversation.id

    except Exception as exc:
        db.session.rollback()
        history_saved = False

        print(
            f"AI history save failed for user {user.id}: "
            f"{type(exc).__name__}: {exc}"
        )

    return jsonify({
        "success": True,
        "answer": answer,
        "response": answer,
        "message": answer,
        "language": selected_language,
        "history_saved": history_saved,
        "conversation_id": conversation_id,
    }), 200


# =========================================================
# CHAT HISTORY API
# GET /api/ai/history
# =========================================================

@ai_bp.route("/history", methods=["GET"])
@jwt_required()
def history():
    user = get_authenticated_user()

    if user is None:
        return jsonify({
            "success": False,
            "message": "Invalid or expired login session.",
        }), 401

    try:
        conversations = (
            AIConversation.query
            .filter_by(user_id=user.id)
            .order_by(AIConversation.created_at.asc())
            .all()
        )

        items = []

        for conversation in conversations:
            items.append({
                "id": conversation.id,
                "question": conversation.question,
                "answer": conversation.answer,
                "user_message": conversation.question,
                "assistant_message": conversation.answer,
                "created_at": (
                    conversation.created_at.isoformat()
                    if conversation.created_at
                    else None
                ),
            })

        return jsonify({
            "success": True,
            "history": items,
            "conversations": items,
            "count": len(items),
        }), 200

    except Exception as exc:
        print(
            f"AI history retrieval failed for user {user.id}: "
            f"{type(exc).__name__}: {exc}"
        )

        return jsonify({
            "success": False,
            "message": "Unable to load chat history right now.",
        }), 500


# =========================================================
# CLEAR CHAT HISTORY API
# DELETE /api/ai/history
# =========================================================

@ai_bp.route("/history", methods=["DELETE"])
@jwt_required()
def clear_history():
    user = get_authenticated_user()

    if user is None:
        return jsonify({
            "success": False,
            "message": "Invalid or expired login session.",
        }), 401

    try:
        AIConversation.query.filter_by(
            user_id=user.id
        ).delete(synchronize_session=False)

        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Your AI chat history has been cleared.",
        }), 200

    except Exception as exc:
        db.session.rollback()

        print(
            f"AI history deletion failed for user {user.id}: "
            f"{type(exc).__name__}: {exc}"
        )

        return jsonify({
            "success": False,
            "message": "Unable to clear chat history right now.",
        }), 500

