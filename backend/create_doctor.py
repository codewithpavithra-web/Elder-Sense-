"""Create a doctor account using real details supplied by the operator.
No demo credentials or fabricated professional details are prefilled.
"""
import getpass
import bcrypt
from app import app
from extensions import db
from models import User, DoctorProfile

with app.app_context():
    full_name = input("Doctor's full name: ").strip()
    email = input("Doctor's email: ").strip().lower()
    password = getpass.getpass("Set a password (minimum 8 characters): ")
    specialization = input("Specialization: ").strip() or None
    qualification = input("Qualification (as provided by the doctor): ").strip() or None
    hospital = input("Clinic/hospital (optional): ").strip() or None
    city = input("City: ").strip() or None
    license_number = input("Registration/licence number (optional): ").strip() or None
    phone = input("Phone (optional): ").strip() or None
    if not full_name or not email or len(password) < 8 or not city:
        raise SystemExit("Full name, email, city, and an 8+ character password are required.")
    if User.query.filter_by(email=email).first():
        raise SystemExit("That email already has an account. No changes made.")
    user = User(full_name=full_name, email=email, password_hash=bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(), role="DOCTOR", phone=phone)
    db.session.add(user)
    db.session.flush()
    profile = DoctorProfile(user_id=user.id, specialization=specialization, qualification=qualification, hospital=hospital, city=city, license_number=license_number, is_available=False)
    db.session.add(profile)
    db.session.commit()
    print("Doctor account created from operator-supplied details. Set the profile available only after the supplied professional details are verified by the institution.")
