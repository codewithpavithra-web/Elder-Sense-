import os

from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
from flask_jwt_extended import JWTManager
from sqlalchemy import text, inspect

from extensions import db

from routes.auth import auth_bp
from routes.pharmacy import pharmacy_bp
from routes.ai import ai_bp
from routes.health import health_bp
from routes.medications import medications_bp
from routes.nutrition import nutrition_bp
from routes.doctor import doctor_bp
from routes.caregiver import caregiver_bp
from routes.appointments import appointments_bp
from routes.doctor_finder import doctor_finder_bp
from routes.health_reports import health_reports_bp
from routes.connections import connections_bp

from medication_scheduler import start_medication_scheduler

import models


load_dotenv()


app = Flask(__name__)


# ---------------------------------------------------------
# CORS CONFIGURATION
# ---------------------------------------------------------
CORS(
    app,
    resources={
        r"/api/*": {
            # Allow localhost and private-LAN hosts so a caregiver can
            # open the Vite app from another device on the same network.
            "origins": [r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$"],
            "methods": [
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS"
            ],
            "allow_headers": [
                "Content-Type",
                "Authorization"
            ]
        }
    },
    supports_credentials=False
)


# ---------------------------------------------------------
# DATABASE CONFIGURATION
# ---------------------------------------------------------
app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL"
)

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False


# ---------------------------------------------------------
# JWT CONFIGURATION
# ---------------------------------------------------------
app.config["JWT_SECRET_KEY"] = os.getenv(
    "JWT_SECRET_KEY"
)

app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 86400


# ---------------------------------------------------------
# INITIALIZE EXTENSIONS
# ---------------------------------------------------------
db.init_app(app)

jwt = JWTManager(app)


# ---------------------------------------------------------
# REGISTER BLUEPRINTS
# ---------------------------------------------------------
app.register_blueprint(auth_bp)
app.register_blueprint(pharmacy_bp)
app.register_blueprint(ai_bp)
app.register_blueprint(health_bp)
app.register_blueprint(medications_bp)
app.register_blueprint(nutrition_bp)
app.register_blueprint(doctor_bp)
app.register_blueprint(caregiver_bp)
app.register_blueprint(appointments_bp)
app.register_blueprint(doctor_finder_bp)
app.register_blueprint(health_reports_bp)
app.register_blueprint(connections_bp)


# ---------------------------------------------------------
# HOME ROUTE
# ---------------------------------------------------------
@app.route("/")
def home():
    return {
        "message": "Elder Sense Backend is running!",
        "status": "success"
    }


# ---------------------------------------------------------
# DATABASE TEST ROUTE
# ---------------------------------------------------------
@app.route("/api/test-db")
def test_db():
    try:

        with db.engine.connect() as connection:

            result = connection.execute(
                text("SELECT current_database();")
            )

            database_name = result.scalar()

        return {
            "status": "success",
            "message": "PostgreSQL connection successful!",
            "database": database_name
        }

    except Exception:
        app.logger.exception("Database connectivity check failed")
        return {
            "status": "error",
            "message": "PostgreSQL connection failed. Check DATABASE_URL and database availability in the backend environment."
        }, 500


# ---------------------------------------------------------
# START APPLICATION
# ---------------------------------------------------------
def ensure_compatibility_columns():
    """Add non-destructive columns needed by current models to older databases.

    This only adds nullable columns; it never drops, truncates, or rewrites records.
    """
    additions = {
        "elder_profiles": {"preferred_language": "VARCHAR(20)"},
        "medications": {"photo_path": "VARCHAR(500)"},
        "medication_schedules": {"reminder_enabled": "BOOLEAN DEFAULT TRUE"},
        "medication_logs": {"missed_reason": "VARCHAR(100)"},
    }
    inspector = inspect(db.engine)
    tables = set(inspector.get_table_names())
    if db.engine.dialect.name != "postgresql":
        # create_all handles fresh local databases; don't guess at vendor-specific
        # ALTER syntax for an existing non-PostgreSQL database.
        return
    for table, columns in additions.items():
        if table not in tables:
            continue
        existing = {column["name"] for column in inspect(db.engine).get_columns(table)}
        for column, sql_type in columns.items():
            if column not in existing:
                db.session.execute(text(
                    f'ALTER TABLE "{table}" ADD COLUMN "{column}" {sql_type}'
                ))
    db.session.commit()


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        ensure_compatibility_columns()

    start_medication_scheduler(app)
    app.run(host="0.0.0.0", debug=False, port=5000)