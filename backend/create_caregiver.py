"""Link an existing caregiver account to an existing elder account.
Run only with the elder's and caregiver's consent: python create_caregiver.py
This script does not create demo accounts or modify passwords.
"""
from app import app
from extensions import db
from models import User, CaregiverProfile, ElderProfile, CaregiverElderLink

with app.app_context():
    caregiver_email = input("Existing caregiver account email: ").strip().lower()
    elder_email = input("Elder account email to link (with consent): ").strip().lower()
    caregiver_user = User.query.filter_by(email=caregiver_email, role="CAREGIVER").first()
    elder_user = User.query.filter_by(email=elder_email, role="ELDER").first()
    if not caregiver_user or not elder_user:
        raise SystemExit("Could not find both accounts with the requested roles. No changes made.")
    caregiver = CaregiverProfile.query.filter_by(user_id=caregiver_user.id).first()
    elder = ElderProfile.query.filter_by(user_id=elder_user.id).first()
    if not caregiver or not elder:
        raise SystemExit("Required profile is missing. No changes made.")
    link = CaregiverElderLink.query.filter_by(caregiver_id=caregiver.id, elder_id=elder.id).first()
    if link:
        link.is_active = True
    else:
        db.session.add(CaregiverElderLink(caregiver_id=caregiver.id, elder_id=elder.id, is_active=True))
    db.session.commit()
    print(f"Linked caregiver {caregiver_user.full_name} to elder {elder_user.full_name}.")
