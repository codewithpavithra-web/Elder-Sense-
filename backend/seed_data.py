"""Idempotently add general medicine reference information.

This script intentionally does not seed pharmacies, phone numbers, doctors,
or medicine stock. Those must come from verified, maintained sources.
It never deletes or resets existing records.
"""
from app import app
from extensions import db
from models import MedicineInformation

MEDICINES = [
    {"medicine_name": "Paracetamol", "generic_name": "Paracetamol", "uses": "Used to relieve mild to moderate pain and reduce fever.", "dosage_information": "Follow the product label and your clinician's instructions. Dose depends on formulation and individual factors.", "side_effects": "Possible effects include nausea or allergic reactions.", "precautions": "Do not exceed the recommended dose. Seek professional advice if you have liver disease or take other medicines.", "food_interactions": "Often taken with or without food; follow the product label."},
    {"medicine_name": "Metformin", "generic_name": "Metformin hydrochloride", "uses": "Used with a care plan to help manage type 2 diabetes.", "dosage_information": "Take only as prescribed. Do not change the dose without professional advice.", "side_effects": "Possible effects include nausea, diarrhoea, and stomach discomfort.", "precautions": "Tell your clinician about kidney problems and other medicines.", "food_interactions": "Often taken with meals according to the prescription."},
    {"medicine_name": "Amlodipine", "generic_name": "Amlodipine", "uses": "Used to treat high blood pressure and some types of chest pain.", "dosage_information": "Take only as prescribed. Do not change the dose without professional advice.", "side_effects": "Possible effects include headache, dizziness, flushing, and ankle swelling.", "precautions": "Discuss dizziness, swelling, or other concerns with a clinician.", "food_interactions": "Follow the prescription and product information."},
    {"medicine_name": "Vitamin D3", "generic_name": "Cholecalciferol", "uses": "Supports vitamin D levels and bone health when indicated.", "dosage_information": "Dose depends on individual needs and clinical advice.", "side_effects": "Excess intake can cause harm, including high calcium levels.", "precautions": "Avoid high-dose use unless advised by a qualified healthcare professional.", "food_interactions": "Follow the product label or clinician's advice."},
]

with app.app_context():
    db.create_all()
    for data in MEDICINES:
        existing = MedicineInformation.query.filter(
            db.func.lower(MedicineInformation.name) == data["medicine_name"].lower()
        ).first()
        if existing:
            continue
        payload = dict(data)
        payload["name"] = payload.pop("medicine_name")
        db.session.add(MedicineInformation(**payload))
    db.session.commit()
    print("Medicine reference information checked; no existing records were deleted.")
