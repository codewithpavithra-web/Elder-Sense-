
from datetime import datetime

from extensions import db
from sqlalchemy.orm import synonym


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    role = db.Column(db.String(20), default="ELDER", nullable=False)

    phone = db.Column(db.String(30))
    profile_image = db.Column(db.String(500))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    elder_profile = db.relationship(
        "ElderProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    caregiver_profile = db.relationship(
        "CaregiverProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    doctor_profile = db.relationship(
        "DoctorProfile",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )


class ElderProfile(db.Model):
    __tablename__ = "elder_profiles"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        unique=True,
        nullable=False
    )

    date_of_birth = db.Column(db.Date)
    gender = db.Column(db.String(20))
    blood_group = db.Column(db.String(10))

    address = db.Column(db.Text)

    emergency_contact = db.Column(db.String(120))
    emergency_phone = db.Column(db.String(30))

    preferred_language = db.Column(
        db.String(20),
        default="English"
    )

    user = db.relationship(
        "User",
        back_populates="elder_profile"
    )


class CaregiverProfile(db.Model):
    __tablename__ = "caregiver_profiles"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        unique=True,
        nullable=False
    )

    relationship_to_elder = db.Column(db.String(100))

    user = db.relationship(
        "User",
        back_populates="caregiver_profile"
    )


class DoctorProfile(db.Model):
    __tablename__ = "doctor_profiles"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        unique=True,
        nullable=False
    )

    specialization = db.Column(db.String(150))
    qualification = db.Column(db.String(150))
    experience_years = db.Column(db.Integer)

    hospital = db.Column(db.String(200))
    city = db.Column(db.String(100))

    license_number = db.Column(db.String(100))

    bio = db.Column(db.Text)

    is_available = db.Column(
        db.Boolean,
        default=True
    )

    user = db.relationship(
        "User",
        back_populates="doctor_profile"
    )


class Medication(db.Model):
    __tablename__ = "medications"

    id = db.Column(db.Integer, primary_key=True)

    elder_id = db.Column(
        db.Integer,
        db.ForeignKey("elder_profiles.id"),
        nullable=False
    )

    name = db.Column(
        db.String(150),
        nullable=False
    )

    dosage = db.Column(db.String(100))
    form = db.Column(db.String(100))

    instructions = db.Column(db.Text)
    purpose = db.Column(db.Text)

    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)

    is_active = db.Column(
        db.Boolean,
        default=True
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    photo_path = db.Column(
        db.String(500)
    )

    schedules = db.relationship(
        "MedicationSchedule",
        back_populates="medication",
        cascade="all, delete-orphan",
        lazy=True
    )


class MedicationSchedule(db.Model):
    __tablename__ = "medication_schedules"

    id = db.Column(db.Integer, primary_key=True)

    medication_id = db.Column(
        db.Integer,
        db.ForeignKey("medications.id"),
        nullable=False
    )

    time = db.Column(
        db.Time,
        nullable=False
    )

    dose_amount = db.Column(
        db.String(100)
    )

    instructions = db.Column(
        db.String(255)
    )

    is_active = db.Column(
        db.Boolean,
        default=True
    )

    reminder_enabled = db.Column(
        db.Boolean,
        default=True
    )

    medication = db.relationship(
        "Medication",
        back_populates="schedules"
    )


class MedicationLog(db.Model):
    __tablename__ = "medication_logs"

    id = db.Column(db.Integer, primary_key=True)

    medication_id = db.Column(
        db.Integer,
        db.ForeignKey("medications.id"),
        nullable=False
    )

    schedule_id = db.Column(
        db.Integer,
        db.ForeignKey("medication_schedules.id"),
        nullable=False
    )

    scheduled_at = db.Column(
        db.DateTime,
        nullable=False
    )

    taken_at = db.Column(
        db.DateTime
    )

    status = db.Column(
        db.String(20),
        default="PENDING",
        nullable=False
    )

    notes = db.Column(
        db.Text
    )

    missed_reason = db.Column(
        db.String(100)
    )

    __table_args__ = (
        db.UniqueConstraint(
            "schedule_id",
            "scheduled_at",
            name="uq_medication_log_schedule_time"
        ),
    )


class CaregiverElderLink(db.Model):
    __tablename__ = "caregiver_elder_links"

    id = db.Column(db.Integer, primary_key=True)

    caregiver_id = db.Column(
        db.Integer,
        db.ForeignKey("caregiver_profiles.id"),
        nullable=False
    )

    elder_id = db.Column(
        db.Integer,
        db.ForeignKey("elder_profiles.id"),
        nullable=False
    )

    relationship = db.Column(db.String(50))
    is_active = db.Column(db.Boolean, default=True)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    __table_args__ = (
        db.UniqueConstraint(
            "caregiver_id",
            "elder_id",
            name="uq_caregiver_elder"
        ),
    )


class DoctorElderLink(db.Model):
    __tablename__ = "doctor_elder_links"

    id = db.Column(db.Integer, primary_key=True)

    doctor_id = db.Column(
        db.Integer,
        db.ForeignKey("doctor_profiles.id"),
        nullable=False
    )

    elder_id = db.Column(
        db.Integer,
        db.ForeignKey("elder_profiles.id"),
        nullable=False
    )

    is_active = db.Column(db.Boolean, default=True)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


class Vital(db.Model):
    __tablename__ = "vitals"

    id = db.Column(db.Integer, primary_key=True)

    elder_id = db.Column(
        db.Integer,
        db.ForeignKey("elder_profiles.id"),
        nullable=False
    )

    blood_pressure = db.Column(db.String(20))
    heart_rate = db.Column(db.Float)
    blood_sugar = db.Column(db.Float)
    temperature = db.Column(db.Float)
    oxygen_level = db.Column(db.Float)
    weight = db.Column(db.Float)
    notes = db.Column(db.Text)

    recorded_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


class Symptom(db.Model):
    __tablename__ = "symptoms"

    id = db.Column(db.Integer, primary_key=True)

    elder_id = db.Column(
        db.Integer,
        db.ForeignKey("elder_profiles.id"),
        nullable=False
    )

    symptom = db.Column(db.String(255))
    severity = db.Column(db.String(50))
    notes = db.Column(db.Text)

    recorded_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


class HealthAssessment(db.Model):
    __tablename__ = "health_assessments"

    id = db.Column(db.Integer, primary_key=True)

    elder_id = db.Column(
        db.Integer,
        db.ForeignKey("elder_profiles.id"),
        nullable=False
    )

    risk_level = db.Column(db.String(50))
    risk_score = db.Column(db.Float)

    prediction = db.Column(db.Text)
    recommendations = db.Column(db.Text)
    model_name = db.Column(db.String(100))

    summary = synonym("prediction")

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


class Prescription(db.Model):
    __tablename__ = "prescriptions"

    id = db.Column(db.Integer, primary_key=True)

    elder_id = db.Column(
        db.Integer,
        db.ForeignKey("elder_profiles.id"),
        nullable=False
    )

    doctor_id = db.Column(
        db.Integer,
        db.ForeignKey("doctor_profiles.id")
    )

    prescription_date = db.Column(db.Date)
    notes = db.Column(db.Text)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


class Clinic(db.Model):
    __tablename__ = "clinics"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(
        db.String(200),
        nullable=False
    )

    address = db.Column(db.Text)
    phone = db.Column(db.String(20))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    specialization = db.Column(db.String(150))

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


class Appointment(db.Model):
    __tablename__ = "appointments"

    id = db.Column(db.Integer, primary_key=True)

    elder_id = db.Column(
        db.Integer,
        db.ForeignKey("elder_profiles.id"),
        nullable=False
    )

    doctor_id = db.Column(
        db.Integer,
        db.ForeignKey("doctor_profiles.id"),
        nullable=False
    )

    appointment_date = db.Column(db.Date)
    appointment_time = db.Column(db.Time)

    status = db.Column(
        db.String(30),
        default="PENDING"
    )

    reason = db.Column(db.Text)
    notes = db.Column(db.Text)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


class NutritionRecord(db.Model):
    __tablename__ = "nutrition_records"

    id = db.Column(db.Integer, primary_key=True)

    elder_id = db.Column(
        db.Integer,
        db.ForeignKey("elder_profiles.id"),
        nullable=False
    )

    meal_type = db.Column(db.String(50))
    food_items = db.Column(db.Text)

    calories = db.Column(db.Float)
    protein = db.Column(db.Float)
    carbohydrates = db.Column(db.Float)
    fats = db.Column(db.Float)

    nutrition_score = db.Column(db.Float)

    notes = db.Column(db.Text)

    recorded_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


class MedicineInformation(db.Model):
    __tablename__ = "medicine_information"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(
        db.String(150),
        nullable=False
    )

    medicine_name = synonym("name")

    generic_name = db.Column(db.String(150))
    uses = db.Column(db.Text)
    dosage_information = db.Column(db.Text)
    side_effects = db.Column(db.Text)
    precautions = db.Column(db.Text)

    warnings = synonym("precautions")

    food_interactions = db.Column(db.Text)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


# Corrected to match the existing PostgreSQL table.
# The database has user_id, question, and answer columns.
class AIConversation(db.Model):
    __tablename__ = "ai_conversations"

    id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    question = db.Column(db.Text)
    answer = db.Column(db.Text)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


class HealthReport(db.Model):
    __tablename__ = "health_reports"

    id = db.Column(db.Integer, primary_key=True)

    elder_id = db.Column(
        db.Integer,
        db.ForeignKey("elder_profiles.id"),
        nullable=False
    )

    report_type = db.Column(db.String(100))
    report_data = db.Column(db.Text)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


class Notification(db.Model):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False
    )

    title = db.Column(
        db.String(255),
        nullable=False
    )

    message = db.Column(
        db.Text,
        nullable=False
    )

    notification_type = db.Column(
        db.String(100)
    )

    is_read = db.Column(
        db.Boolean,
        default=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


class Pharmacy(db.Model):
    __tablename__ = "pharmacies"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(
        db.String(200),
        nullable=False
    )

    address = db.Column(db.Text)
    city = db.Column(db.String(100), index=True)
    state = db.Column(db.String(100))
    pincode = db.Column(db.String(12), index=True)
    phone = db.Column(db.String(30))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    is_open = db.Column(db.Boolean)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )


class PharmacyInventory(db.Model):
    __tablename__ = "pharmacy_inventory"

    id = db.Column(db.Integer, primary_key=True)

    pharmacy_id = db.Column(
        db.Integer,
        db.ForeignKey("pharmacies.id"),
        nullable=False
    )

    medicine_id = db.Column(
        db.Integer,
        db.ForeignKey("medicine_information.id"),
        nullable=False
    )

    quantity = db.Column(db.Integer, default=0)
    price = db.Column(db.Float)

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    availability_status = db.Column(db.String(30))
    data_source = db.Column(db.String(255))

    pharmacy = db.relationship(
        "Pharmacy",
        lazy="joined"
    )

    medicine = db.relationship(
        "MedicineInformation",
        lazy="joined"
    )


class ConnectionRequest(db.Model):
    __tablename__ = "connection_requests"

    id = db.Column(db.Integer, primary_key=True)
    requester_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    elder_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    requester_role = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="PENDING")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    decided_at = db.Column(db.DateTime)
