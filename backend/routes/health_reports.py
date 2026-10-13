
import traceback
from datetime import date, datetime, time, timedelta
from io import BytesIO
from xml.sax.saxutils import escape

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from extensions import db
from models import (
    User,
    ElderProfile,
    CaregiverProfile,
    DoctorProfile,
    CaregiverElderLink,
    DoctorElderLink,
    Medication,
    MedicationSchedule,
    MedicationLog,
    Vital,
    Symptom,
    HealthAssessment,
    Prescription,
    Appointment,
    NutritionRecord,
)

health_reports_bp = Blueprint(
    "health_reports",
    __name__,
    url_prefix="/api/health-reports",
)


# ---------------------------------------------------------
# GENERAL HELPERS
# ---------------------------------------------------------

def _log_error(message):
    """Print the complete error to the Flask backend terminal."""
    print("\n" + "=" * 70)
    print(f"ELDER SENSE HEALTH REPORT ERROR: {message}")
    traceback.print_exc()
    print("=" * 70 + "\n")


def _identity_user():
    """Return the authenticated user, or None if not found."""
    identity = get_jwt_identity()

    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        return None

    return db.session.get(User, user_id)


def _parse_date(value):
    if not value:
        return None

    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return None


def _date_value(value):
    if value is None:
        return None

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    return str(value)


def _number(value, digits=1):
    if value is None:
        return None

    try:
        return round(float(value), digits)
    except (TypeError, ValueError):
        return None


def _text(value, default="Not recorded"):
    if value is None:
        return default

    result = str(value).strip()
    return result if result else default


def _recorded_between(column, start_dt, end_exclusive):
    return (
        (column >= start_dt)
        & (column < end_exclusive)
    )


def _safe_error_response(message, status_code):
    return jsonify({"error": message}), status_code


# ---------------------------------------------------------
# USER AND ELDER ACCESS
# ---------------------------------------------------------

def _select_elder(user):
    """
    Elders can access only their own records.

    Caregivers and doctors must supply elder_id and must have
    an active relationship with that elder.
    """

    role = str(getattr(user, "role", "")).upper()

    if role == "ELDER":
        elder = ElderProfile.query.filter_by(
            user_id=user.id
        ).first()

        return elder, None

    elder_id_value = request.args.get("elder_id")

    if not elder_id_value:
        return None, _safe_error_response(
            "Select a linked elder to view their health report.",
            400,
        )

    try:
        elder_id = int(elder_id_value)
    except (TypeError, ValueError):
        return None, _safe_error_response(
            "Invalid elder ID.",
            400,
        )

    if role == "CAREGIVER":
        caregiver = CaregiverProfile.query.filter_by(
            user_id=user.id
        ).first()

        if not caregiver:
            return None, _safe_error_response(
                "Caregiver profile not found.",
                403,
            )

        link = CaregiverElderLink.query.filter_by(
            caregiver_id=caregiver.id,
            elder_id=elder_id,
            is_active=True,
        ).first()

        if not link:
            return None, _safe_error_response(
                "You do not have active access to this elder.",
                403,
            )

    elif role == "DOCTOR":
        doctor = DoctorProfile.query.filter_by(
            user_id=user.id
        ).first()

        if not doctor:
            return None, _safe_error_response(
                "Doctor profile not found.",
                403,
            )

        link = DoctorElderLink.query.filter_by(
            doctor_id=doctor.id,
            elder_id=elder_id,
            is_active=True,
        ).first()

        if not link:
            return None, _safe_error_response(
                "You do not have active access to this patient.",
                403,
            )

    else:
        return None, _safe_error_response(
            "Access denied.",
            403,
        )

    elder = db.session.get(ElderProfile, elder_id)

    if not elder:
        return None, _safe_error_response(
            "Elder not found.",
            404,
        )

    return elder, None


# ---------------------------------------------------------
# DATE FILTERS
# ---------------------------------------------------------

def _resolve_period():
    period_value = request.args.get("period", "7").lower()
    today = date.today()

    if period_value in ("7", "7days", "last7"):
        start_day = today - timedelta(days=6)
        end_day = today
        label = "Last 7 days"

    elif period_value in ("30", "30days", "last30"):
        start_day = today - timedelta(days=29)
        end_day = today
        label = "Last 30 days"

    elif period_value == "custom":
        start_day = _parse_date(
            request.args.get("start_date")
        )
        end_day = _parse_date(
            request.args.get("end_date")
        )

        if not start_day or not end_day:
            return None, _safe_error_response(
                "For a custom period, provide start_date and "
                "end_date in YYYY-MM-DD format.",
                400,
            )

        if start_day > end_day:
            return None, _safe_error_response(
                "Start date must not be after the end date.",
                400,
            )

        if (end_day - start_day).days > 366:
            return None, _safe_error_response(
                "Please select a date range of 367 days or less.",
                400,
            )

        label = "Custom date range"

    else:
        return None, _safe_error_response(
            "Invalid period. Use 7, 30, or custom.",
            400,
        )

    start_dt = datetime.combine(start_day, time.min)

    end_exclusive = datetime.combine(
        end_day + timedelta(days=1),
        time.min,
    )

    return {
        "start_date": start_day,
        "end_date": end_day,
        "start_dt": start_dt,
        "end_exclusive": end_exclusive,
        "label": label,
    }, None


def _age_from_dob(dob):
    if not dob:
        return None

    if isinstance(dob, datetime):
        dob = dob.date()

    if not isinstance(dob, date):
        return None

    today = date.today()

    return (
        today.year
        - dob.year
        - ((today.month, today.day) < (dob.month, dob.day))
    )


# ---------------------------------------------------------
# BUILD REPORT FROM SAVED DATABASE RECORDS
# ---------------------------------------------------------

def _build_report(elder, period):
    start_day = period["start_date"]
    end_day = period["end_date"]
    start_dt = period["start_dt"]
    end_exclusive = period["end_exclusive"]

    user = db.session.get(User, elder.user_id)

    if not user:
        raise ValueError(
            f"User record not found for elder profile {elder.id}."
        )

    dob = getattr(elder, "date_of_birth", None)

    profile = {
        "elder_id": elder.id,
        "name": _text(
            getattr(user, "full_name", None),
            "Elder",
        ),
        "age": _age_from_dob(dob),
        "date_of_birth": _date_value(dob),
        "gender": _text(
            getattr(elder, "gender", None)
        ),
        "blood_group": _text(
            getattr(elder, "blood_group", None)
        ),
        "generated_at": datetime.now().isoformat(
            timespec="seconds"
        ),
        "period_label": period["label"],
        "start_date": start_day.isoformat(),
        "end_date": end_day.isoformat(),
    }

    # -----------------------------------------------------
    # MEDICATION HISTORY
    # -----------------------------------------------------

    medication_rows = (
        db.session.query(MedicationLog, Medication)
        .join(
            Medication,
            MedicationLog.medication_id == Medication.id,
        )
        .filter(
            Medication.elder_id == elder.id,
            _recorded_between(
                MedicationLog.scheduled_at,
                start_dt,
                end_exclusive,
            ),
        )
        .order_by(
            MedicationLog.scheduled_at.desc()
        )
        .all()
    )

    medication_history = []

    counts = {
        "taken": 0,
        "missed": 0,
        "skipped": 0,
        "other": 0,
    }

    for log, medication in medication_rows:
        status = _text(
            getattr(log, "status", None),
            "Unknown",
        ).upper()

        if status == "TAKEN":
            counts["taken"] += 1
        elif status == "MISSED":
            counts["missed"] += 1
        elif status == "SKIPPED":
            counts["skipped"] += 1
        else:
            counts["other"] += 1

        medication_history.append({
            "medication": _text(
                getattr(medication, "name", None)
            ),
            "dosage": _text(
                getattr(medication, "dosage", None)
            ),
            "scheduled_at": _date_value(
                getattr(log, "scheduled_at", None)
            ),
            "taken_at": _date_value(
                getattr(log, "taken_at", None)
            ),
            "status": status,
            "notes": _text(
                getattr(log, "notes", None),
                "",
            ),
            "missed_reason": _text(
                getattr(log, "missed_reason", None),
                "",
            ),
        })

    logged_doses = (
        counts["taken"]
        + counts["missed"]
        + counts["skipped"]
    )

    adherence = (
        round(
            counts["taken"] / logged_doses * 100,
            1,
        )
        if logged_doses
        else None
    )

    active_medications = Medication.query.filter_by(
        elder_id=elder.id,
        is_active=True,
    ).order_by(
        Medication.name.asc()
    ).all()

    medication_list = []

    for medication in active_medications:
        schedules = MedicationSchedule.query.filter_by(
            medication_id=medication.id,
            is_active=True,
        ).order_by(
            MedicationSchedule.time.asc()
        ).all()

        medication_list.append({
            "name": _text(
                getattr(medication, "name", None)
            ),
            "dosage": _text(
                getattr(medication, "dosage", None)
            ),
            "instructions": _text(
                getattr(medication, "instructions", None),
                "",
            ),
            "purpose": _text(
                getattr(medication, "purpose", None),
                "",
            ),
            "schedules": [
                {
                    "time": _text(
                        getattr(schedule, "time", None)
                    ),
                    "dose_amount": _text(
                        getattr(schedule, "dose_amount", None),
                        "",
                    ),
                }
                for schedule in schedules
            ],
        })

    # -----------------------------------------------------
    # VITALS
    # -----------------------------------------------------

    vitals_db = Vital.query.filter(
        Vital.elder_id == elder.id,
        _recorded_between(
            Vital.recorded_at,
            start_dt,
            end_exclusive,
        ),
    ).order_by(
        Vital.recorded_at.desc()
    ).all()

    vital_history = []

    for vital in vitals_db:
        vital_history.append({
            "recorded_at": _date_value(
                getattr(vital, "recorded_at", None)
            ),
            "blood_pressure": _text(
                getattr(vital, "blood_pressure", None),
                "",
            ),
            "heart_rate": _number(
                getattr(vital, "heart_rate", None)
            ),
            "blood_sugar": _number(
                getattr(vital, "blood_sugar", None)
            ),
            "temperature": _number(
                getattr(vital, "temperature", None)
            ),
            "oxygen_level": _number(
                getattr(vital, "oxygen_level", None)
            ),
            "weight": _number(
                getattr(vital, "weight", None)
            ),
            "notes": _text(
                getattr(vital, "notes", None),
                "",
            ),
        })

    latest_vital = (
        vital_history[0]
        if vital_history
        else None
    )

    # -----------------------------------------------------
    # NUTRITION
    # -----------------------------------------------------

    nutrition_db = NutritionRecord.query.filter(
        NutritionRecord.elder_id == elder.id,
        _recorded_between(
            NutritionRecord.recorded_at,
            start_dt,
            end_exclusive,
        ),
    ).order_by(
        NutritionRecord.recorded_at.desc()
    ).all()

    nutrition_records = []

    for record in nutrition_db:
        nutrition_records.append({
            "meal_type": _text(
                getattr(record, "meal_type", None)
            ),
            "food_items": _text(
                getattr(record, "food_items", None)
            ),
            "calories": _number(
                getattr(record, "calories", None)
            ),
            "protein": _number(
                getattr(record, "protein", None)
            ),
            "carbohydrates": _number(
                getattr(record, "carbohydrates", None)
            ),
            "fats": _number(
                getattr(record, "fats", None)
            ),
            "nutrition_score": _number(
                getattr(record, "nutrition_score", None)
            ),
            "notes": _text(
                getattr(record, "notes", None),
                "",
            ),
            "recorded_at": _date_value(
                getattr(record, "recorded_at", None)
            ),
        })

    def sum_known(field):
        values = [
            item[field]
            for item in nutrition_records
            if item[field] is not None
        ]

        return (
            round(sum(values), 1)
            if values
            else None
        )

    nutrition_summary = {
        "meal_records": len(nutrition_records),
        "calories_total": sum_known("calories"),
        "protein_total": sum_known("protein"),
        "carbohydrates_total": sum_known("carbohydrates"),
        "fats_total": sum_known("fats"),
    }

    # -----------------------------------------------------
    # SYMPTOMS
    # -----------------------------------------------------

    symptom_db = Symptom.query.filter(
        Symptom.elder_id == elder.id,
        _recorded_between(
            Symptom.recorded_at,
            start_dt,
            end_exclusive,
        ),
    ).order_by(
        Symptom.recorded_at.desc()
    ).all()

    symptoms = [
        {
            "symptom": _text(
                getattr(item, "symptom", None)
            ),
            "severity": _text(
                getattr(item, "severity", None)
            ),
            "notes": _text(
                getattr(item, "notes", None),
                "",
            ),
            "recorded_at": _date_value(
                getattr(item, "recorded_at", None)
            ),
        }
        for item in symptom_db
    ]

    # -----------------------------------------------------
    # HEALTH ASSESSMENTS
    # -----------------------------------------------------

    assessment_db = HealthAssessment.query.filter(
        HealthAssessment.elder_id == elder.id,
        _recorded_between(
            HealthAssessment.created_at,
            start_dt,
            end_exclusive,
        ),
    ).order_by(
        HealthAssessment.created_at.desc()
    ).all()

    assessments = [
        {
            "risk_level": _text(
                getattr(item, "risk_level", None)
            ),
            "risk_score": _number(
                getattr(item, "risk_score", None)
            ),
            "prediction": _text(
                getattr(item, "prediction", None)
            ),
            "recommendations": _text(
                getattr(item, "recommendations", None),
                "",
            ),
            "created_at": _date_value(
                getattr(item, "created_at", None)
            ),
        }
        for item in assessment_db
    ]

    # -----------------------------------------------------
    # PRESCRIPTIONS
    # -----------------------------------------------------

    prescription_date_column = Prescription.prescription_date

    prescriptions_db = Prescription.query.filter(
        Prescription.elder_id == elder.id,
        prescription_date_column >= start_day,
        prescription_date_column <= end_day,
    ).order_by(
        prescription_date_column.desc()
    ).all()

    prescriptions = []

    for item in prescriptions_db:
        doctor_name = None
        doctor_id = getattr(item, "doctor_id", None)

        if doctor_id:
            doctor_profile = db.session.get(
                DoctorProfile,
                doctor_id,
            )

            if doctor_profile:
                doctor_user = db.session.get(
                    User,
                    doctor_profile.user_id,
                )

                if doctor_user:
                    doctor_name = doctor_user.full_name

        prescriptions.append({
            "prescription_date": _date_value(
                getattr(item, "prescription_date", None)
            ),
            "doctor": _text(
                doctor_name,
                "Not specified",
            ),
            "notes": _text(
                getattr(item, "notes", None)
            ),
        })

    # -----------------------------------------------------
    # APPOINTMENTS
    # -----------------------------------------------------

    appointment_date_column = Appointment.appointment_date

    appointments_db = Appointment.query.filter(
        Appointment.elder_id == elder.id,
        appointment_date_column >= start_day,
        appointment_date_column <= end_day,
    ).order_by(
        appointment_date_column.desc()
    ).all()

    appointments = []

    for item in appointments_db:
        doctor_name = None
        hospital = None
        specialization = None

        doctor_id = getattr(item, "doctor_id", None)

        if doctor_id:
            doctor_profile = db.session.get(
                DoctorProfile,
                doctor_id,
            )

            if doctor_profile:
                doctor_user = db.session.get(
                    User,
                    doctor_profile.user_id,
                )

                if doctor_user:
                    doctor_name = doctor_user.full_name

                hospital = getattr(
                    doctor_profile,
                    "hospital",
                    None,
                )

                specialization = getattr(
                    doctor_profile,
                    "specialization",
                    None,
                )

        appointments.append({
            "date": _date_value(
                getattr(item, "appointment_date", None)
            ),
            "time": _text(
                getattr(item, "appointment_time", None)
            ),
            "status": _text(
                getattr(item, "status", None)
            ).upper(),
            "reason": _text(
                getattr(item, "reason", None),
                "",
            ),
            "notes": _text(
                getattr(item, "notes", None),
                "",
            ),
            "doctor": _text(
                doctor_name,
                "Not specified",
            ),
            "specialization": _text(
                specialization,
                "Not specified",
            ),
            "hospital": _text(
                hospital,
                "Not specified",
            ),
        })

    today_string = date.today().isoformat()

    completed_appointments = sum(
        1
        for item in appointments
        if item["status"] == "COMPLETED"
    )

    upcoming_appointments = sum(
        1
        for item in appointments
        if (
            item["status"] in ("PENDING", "CONFIRMED")
            and item["date"]
            and item["date"] >= today_string
        )
    )

    # -----------------------------------------------------
    # FINAL REPORT
    # -----------------------------------------------------

    return {
        "profile": profile,

        "medications": {
            "active_medications": medication_list,
            "history": medication_history,
            "logged_doses": logged_doses,
            "taken": counts["taken"],
            "missed": counts["missed"],
            "skipped": counts["skipped"],
            "other_statuses": counts["other"],
            "adherence_percentage": adherence,
            "adherence_note": (
                "Calculated from saved medication logs in the "
                "selected period. It does not infer unlogged doses."
            ),
        },

        "vitals": {
            "count": len(vital_history),
            "latest": latest_vital,
            "history": vital_history,
        },

        "nutrition": {
            "summary": nutrition_summary,
            "records": nutrition_records,
        },

        "medical_history": {
            "symptoms": symptoms,
            "assessments": assessments,
            "prescriptions": prescriptions,
        },

        "appointments": {
            "count": len(appointments),
            "completed": completed_appointments,
            "upcoming": upcoming_appointments,
            "records": appointments,
        },

        "disclaimer": (
            "This report summarizes saved records and is not a "
            "medical diagnosis. Missing information means it was "
            "not recorded in the selected period."
        ),
    }


# ---------------------------------------------------------
# PDF GENERATION
# ---------------------------------------------------------

def _make_pdf(report):
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import (
            getSampleStyleSheet,
            ParagraphStyle,
        )
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            SimpleDocTemplate,
            Paragraph,
            Spacer,
            Table,
            TableStyle,
        )
    except ImportError as exc:
        raise RuntimeError(
            "PDF support is not installed. Run "
            "'python -m pip install reportlab'."
        ) from exc

    output = BytesIO()

    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=12 * mm,
        leftMargin=12 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title="Elder Sense Health Report",
        author="Elder Sense",
    )

    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        name="ReportTitle",
        parent=styles["Title"],
        alignment=TA_CENTER,
        textColor=colors.HexColor("#167D8D"),
        spaceAfter=8,
    ))

    styles.add(ParagraphStyle(
        name="SectionHeading",
        parent=styles["Heading2"],
        textColor=colors.HexColor("#167D8D"),
        spaceBefore=10,
        spaceAfter=5,
    ))

    styles.add(ParagraphStyle(
        name="ReportSmallText",
        parent=styles["BodyText"],
        fontSize=7,
        leading=9,
        wordWrap="CJK",
    ))

    story = []

    def para(value, style="BodyText"):
        safe = escape(
            str(value if value is not None else "Not recorded")
        )
        return Paragraph(
            safe.replace("\n", "<br/>"),
            styles[style],
        )

    def add_section(title, rows, headers=None):
        story.append(
            Paragraph(
                escape(title),
                styles["SectionHeading"],
            )
        )

        if not rows:
            story.append(
                para("No records available in the selected period.")
            )
            story.append(Spacer(1, 4))
            return

        data = []

        if headers:
            data.append([
                para(header, "ReportSmallText")
                for header in headers
            ])

        for row in rows:
            data.append([
                para(value, "ReportSmallText")
                for value in row
            ])

        table = Table(
            data,
            repeatRows=1 if headers else 0,
            hAlign="LEFT",
        )

        table.setStyle(TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.HexColor("#E5F4F5"),
            ),
            (
                "TEXTCOLOR",
                (0, 0),
                (-1, 0),
                colors.HexColor("#164E63"),
            ),
            (
                "GRID",
                (0, 0),
                (-1, -1),
                0.35,
                colors.HexColor("#D5E1E5"),
            ),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))

        story.append(table)
        story.append(Spacer(1, 5))

    profile = report["profile"]

    story.append(Paragraph(
        "Elder Sense — Health Report",
        styles["ReportTitle"],
    ))

    story.append(para(
        f"Report for: {profile['name']} | "
        f"Period: {profile['start_date']} to {profile['end_date']}"
    ))

    story.append(para(
        f"Generated: {profile['generated_at']} | "
        f"Elder ID: {profile['elder_id']}"
    ))

    story.append(Spacer(1, 8))

    add_section(
        "Elder Profile",
        [
            ["Name", profile["name"]],
            [
                "Age",
                (
                    str(profile["age"])
                    if profile["age"] is not None
                    else "Not recorded"
                ),
            ],
            [
                "Date of birth",
                profile["date_of_birth"] or "Not recorded",
            ],
            ["Gender", profile["gender"]],
            ["Blood group", profile["blood_group"]],
        ],
        ["Field", "Value"],
    )

    meds = report["medications"]

    adherence_text = (
        f"{meds['adherence_percentage']}%"
        if meds["adherence_percentage"] is not None
        else "Not available — no logged doses"
    )

    add_section(
        "Medication Adherence Summary",
        [
            ["Saved medication logs", meds["logged_doses"]],
            ["Taken", meds["taken"]],
            ["Missed", meds["missed"]],
            ["Skipped", meds["skipped"]],
            ["Adherence", adherence_text],
        ],
        ["Measure", "Value"],
    )

    add_section(
        "Active Medications",
        [
            [
                item["name"],
                item["dosage"],
                item["purpose"],
                ", ".join(
                    schedule["time"]
                    for schedule in item["schedules"]
                ) or "No active schedule recorded",
            ]
            for item in meds["active_medications"]
        ],
        ["Medication", "Dosage", "Purpose", "Schedule"],
    )

    add_section(
        "Medication History",
        [
            [
                item["scheduled_at"],
                item["medication"],
                item["dosage"],
                item["status"],
                item["missed_reason"] or item["notes"],
            ]
            for item in meds["history"]
        ],
        ["Scheduled", "Medication", "Dosage", "Status", "Notes"],
    )

    add_section(
        "Health & Vitals",
        [
            [
                item["recorded_at"],
                item["blood_pressure"],
                item["heart_rate"],
                item["blood_sugar"],
                item["temperature"],
                item["oxygen_level"],
                item["weight"],
            ]
            for item in report["vitals"]["history"]
        ],
        [
            "Recorded",
            "Blood pressure",
            "Heart rate",
            "Blood sugar",
            "Temperature",
            "Oxygen",
            "Weight",
        ],
    )

    nutrition = report["nutrition"]
    summary = nutrition["summary"]

    add_section(
        "Nutrition Summary",
        [
            ["Saved meal records", summary["meal_records"]],
            [
                "Calories total",
                summary["calories_total"]
                if summary["calories_total"] is not None
                else "Not recorded",
            ],
            [
                "Protein total (g)",
                summary["protein_total"]
                if summary["protein_total"] is not None
                else "Not recorded",
            ],
            [
                "Carbohydrates total (g)",
                summary["carbohydrates_total"]
                if summary["carbohydrates_total"] is not None
                else "Not recorded",
            ],
            [
                "Fats total (g)",
                summary["fats_total"]
                if summary["fats_total"] is not None
                else "Not recorded",
            ],
        ],
        ["Measure", "Value"],
    )

    add_section(
        "Nutrition Records",
        [
            [
                item["recorded_at"],
                item["meal_type"],
                item["food_items"],
                item["calories"],
                item["protein"],
                item["carbohydrates"],
                item["fats"],
            ]
            for item in nutrition["records"]
        ],
        [
            "Recorded",
            "Meal",
            "Food items",
            "Calories",
            "Protein",
            "Carbs",
            "Fats",
        ],
    )

    medical = report["medical_history"]

    add_section(
        "Symptoms",
        [
            [
                item["recorded_at"],
                item["symptom"],
                item["severity"],
                item["notes"],
            ]
            for item in medical["symptoms"]
        ],
        ["Recorded", "Symptom", "Severity", "Notes"],
    )

    add_section(
        "Health Assessments",
        [
            [
                item["created_at"],
                item["risk_level"],
                item["risk_score"],
                item["prediction"],
                item["recommendations"],
            ]
            for item in medical["assessments"]
        ],
        ["Date", "Risk level", "Score", "Assessment", "Recommendations"],
    )

    add_section(
        "Prescriptions",
        [
            [
                item["prescription_date"],
                item["doctor"],
                item["notes"],
            ]
            for item in medical["prescriptions"]
        ],
        ["Date", "Doctor", "Notes"],
    )

    add_section(
        "Appointments",
        [
            [
                item["date"],
                item["time"],
                item["status"],
                item["doctor"],
                item["hospital"],
                item["reason"],
            ]
            for item in report["appointments"]["records"]
        ],
        ["Date", "Time", "Status", "Doctor", "Hospital", "Reason"],
    )

    story.append(Spacer(1, 8))

    story.append(Paragraph(
        escape(report["disclaimer"]),
        styles["Italic"],
    ))

    document.build(story)
    output.seek(0)

    return output


# ---------------------------------------------------------
# GET HEALTH REPORT JSON
# ---------------------------------------------------------

@health_reports_bp.route("", methods=["GET"])
@health_reports_bp.route("/", methods=["GET"])
@jwt_required()
def get_health_report():
    try:
        user = _identity_user()

        if not user:
            return _safe_error_response(
                "Authenticated user not found.",
                401,
            )

        elder, error_response = _select_elder(user)

        if error_response:
            return error_response

        if not elder:
            return _safe_error_response(
                "Elder profile not found for this account.",
                404,
            )

        period, error_response = _resolve_period()

        if error_response:
            return error_response

        report = _build_report(elder, period)

        return jsonify(report), 200

    except Exception:
        db.session.rollback()
        _log_error("GET /api/health-reports failed")

        return jsonify({
            "error": (
                "The health report could not be generated. "
                "See the Flask backend terminal for the exact error."
            )
        }), 500


# ---------------------------------------------------------
# DOWNLOAD CONSOLIDATED PDF
# ---------------------------------------------------------

@health_reports_bp.route("/pdf", methods=["GET"])
@jwt_required()
def download_health_report_pdf():
    try:
        user = _identity_user()

        if not user:
            return _safe_error_response(
                "Authenticated user not found.",
                401,
            )

        elder, error_response = _select_elder(user)

        if error_response:
            return error_response

        if not elder:
            return _safe_error_response(
                "Elder profile not found for this account.",
                404,
            )

        period, error_response = _resolve_period()

        if error_response:
            return error_response

        report = _build_report(elder, period)
        pdf_file = _make_pdf(report)

        filename = (
            f"elder-sense-health-report-{date.today().isoformat()}.pdf"
        )

        return send_file(
            pdf_file,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=filename,
        )

    except RuntimeError as exc:
        db.session.rollback()
        _log_error("PDF support error")
        return jsonify({"error": str(exc)}), 500

    except Exception:
        db.session.rollback()
        _log_error("GET /api/health-reports/pdf failed")

        return jsonify({
            "error": (
                "The PDF could not be generated. "
                "See the Flask backend terminal for the exact error."
            )
        }), 500

