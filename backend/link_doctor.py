"""Link an existing doctor to an existing elder with explicit consent.
Run: python link_doctor.py
"""
from app import app
from extensions import db
from models import User, DoctorProfile, ElderProfile, DoctorElderLink

with app.app_context():
    doctor_email = input("Existing doctor account email: ").strip().lower()
    elder_email = input("Elder account email to authorize: ").strip().lower()
    doctor_user = User.query.filter_by(email=doctor_email, role="DOCTOR").first()
    elder_user = User.query.filter_by(email=elder_email, role="ELDER").first()
    if not doctor_user or not elder_user:
        raise SystemExit("Could not find both accounts with the requested roles. No changes made.")
    doctor = DoctorProfile.query.filter_by(user_id=doctor_user.id).first()
    elder = ElderProfile.query.filter_by(user_id=elder_user.id).first()
    if not doctor or not elder:
        raise SystemExit("Required profile is missing. No changes made.")
    link = DoctorElderLink.query.filter_by(doctor_id=doctor.id, elder_id=elder.id).first()
    if link:
        link.is_active = True
    else:
        db.session.add(DoctorElderLink(doctor_id=doctor.id, elder_id=elder.id, is_active=True))
    db.session.commit()
    print(f"Authorized doctor {doctor_user.full_name} for elder {elder_user.full_name}.")
