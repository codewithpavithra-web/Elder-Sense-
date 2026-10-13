from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models import (
    User,
    ElderProfile,
    CaregiverProfile,
    DoctorProfile,
    CaregiverElderLink,
    DoctorElderLink,
    Notification,
    ConnectionRequest,
)

connections_bp = Blueprint(
    "connections",
    __name__,
    url_prefix="/api/connections",
)


def current_user():
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        return None
    return db.session.get(User, user_id)


def error(message, status=400):
    return jsonify({"success": False, "message": message}), status


def user_payload(user):
    return {
        "id": user.id,
        "name": user.full_name,
        "email": user.email,
        "role": user.role,
    }


def notify(user_id, title, message, kind):
    db.session.add(Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=kind,
        is_read=False,
    ))


def find_user_by_email(email, role):
    return User.query.filter(
        db.func.lower(User.email) == email,
        User.role == role,
    ).first()


def get_link_for(elder_profile, other_user):
    """Return the correct elder-caregiver or elder-doctor link."""
    if not elder_profile or not other_user:
        return None

    if other_user.role == "CAREGIVER":
        profile = CaregiverProfile.query.filter_by(
            user_id=other_user.id
        ).first()
        if not profile:
            return None
        return CaregiverElderLink.query.filter_by(
            caregiver_id=profile.id,
            elder_id=elder_profile.id,
        ).first()

    if other_user.role == "DOCTOR":
        profile = DoctorProfile.query.filter_by(
            user_id=other_user.id
        ).first()
        if not profile:
            return None
        return DoctorElderLink.query.filter_by(
            doctor_id=profile.id,
            elder_id=elder_profile.id,
        ).first()

    return None


def activate_link(elder_profile, other_user):
    """Create or reactivate the correct link after approval only."""
    if other_user.role == "CAREGIVER":
        profile = CaregiverProfile.query.filter_by(
            user_id=other_user.id
        ).first()
        if not profile:
            return False, "Caregiver profile not found."

        link = CaregiverElderLink.query.filter_by(
            caregiver_id=profile.id,
            elder_id=elder_profile.id,
        ).first()
        if link:
            link.is_active = True
        else:
            db.session.add(CaregiverElderLink(
                caregiver_id=profile.id,
                elder_id=elder_profile.id,
                relationship=None,
                is_active=True,
            ))
        return True, None

    if other_user.role == "DOCTOR":
        profile = DoctorProfile.query.filter_by(
            user_id=other_user.id
        ).first()
        if not profile:
            return False, "Doctor profile not found."

        link = DoctorElderLink.query.filter_by(
            doctor_id=profile.id,
            elder_id=elder_profile.id,
        ).first()
        if link:
            link.is_active = True
        else:
            db.session.add(DoctorElderLink(
                doctor_id=profile.id,
                elder_id=elder_profile.id,
                is_active=True,
            ))
        return True, None

    return False, "Only caregivers and doctors can connect to an elder."


def purge_links_between(user_a_id, user_b_id):
    """Hard-delete every caregiver/doctor-elder link row between two users."""
    pair = (user_a_id, user_b_id)
    elder_ids = [
        p.id for p in ElderProfile.query.filter(ElderProfile.user_id.in_(pair)).all()
    ]
    if not elder_ids:
        return

    caregiver_ids = [
        p.id for p in CaregiverProfile.query.filter(CaregiverProfile.user_id.in_(pair)).all()
    ]
    if caregiver_ids:
        for link in CaregiverElderLink.query.filter(
            CaregiverElderLink.elder_id.in_(elder_ids),
            CaregiverElderLink.caregiver_id.in_(caregiver_ids),
        ).all():
            db.session.delete(link)

    doctor_ids = [
        p.id for p in DoctorProfile.query.filter(DoctorProfile.user_id.in_(pair)).all()
    ]
    if doctor_ids:
        for link in DoctorElderLink.query.filter(
            DoctorElderLink.elder_id.in_(elder_ids),
            DoctorElderLink.doctor_id.in_(doctor_ids),
        ).all():
            db.session.delete(link)


def purge_requests_between(user_a_id, user_b_id):
    """Hard-delete every connection request between two users (either direction)."""
    for req in ConnectionRequest.query.filter(
        ((ConnectionRequest.requester_id == user_a_id) & (ConnectionRequest.elder_user_id == user_b_id))
        | ((ConnectionRequest.requester_id == user_b_id) & (ConnectionRequest.elder_user_id == user_a_id))
    ).all():
        db.session.delete(req)


@connections_bp.route("/search-elder", methods=["POST"])
@jwt_required()
def search_elder():
    """Legacy-compatible search route; elders can search care-team members too."""
    user = current_user()
    if not user:
        return error("User not found.", 404)

    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    if not email:
        return error("Enter the registered email address.")

    if user.role == "ELDER":
        recipient = User.query.filter(
            db.func.lower(User.email) == email,
            User.role.in_(("CAREGIVER", "DOCTOR")),
        ).first()
        if not recipient:
            return error(
                "No caregiver or doctor account was found with that email.",
                404,
            )
        if not recipient.caregiver_profile and recipient.role == "CAREGIVER":
            return error("Caregiver profile not found.", 404)
        if not recipient.doctor_profile and recipient.role == "DOCTOR":
            return error("Doctor profile not found.", 404)
        return jsonify({
            "success": True,
            "recipient": user_payload(recipient),
            "message": "Care-team account found. You can send an invitation.",
        })

    if user.role not in ("CAREGIVER", "DOCTOR"):
        return error("This role cannot search for connections.", 403)

    elder_user = find_user_by_email(email, "ELDER")
    if not elder_user or not elder_user.elder_profile:
        return error("No elder account was found with that email.", 404)

    return jsonify({
        "success": True,
        "elder": user_payload(elder_user),
        "recipient": user_payload(elder_user),
        "message": "Elder account found. You can send a connection request.",
    })


@connections_bp.route("/request", methods=["POST"])
@jwt_required()
def send_request():
    user = current_user()
    if not user:
        return error("User not found.", 404)

    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    if not email:
        return error("Enter the registered email address.")

    if user.role == "ELDER":
        recipient = User.query.filter(
            db.func.lower(User.email) == email,
            User.role.in_(("CAREGIVER", "DOCTOR")),
        ).first()
        elder_profile = ElderProfile.query.filter_by(user_id=user.id).first()

        if not recipient:
            return error(
                "No caregiver or doctor account was found with that email.",
                404,
            )
        if recipient.id == user.id:
            return error("You cannot connect an account to itself.")
        if not elder_profile:
            return error("Elder profile not found.", 404)

        if recipient.role == "CAREGIVER":
            recipient_profile = CaregiverProfile.query.filter_by(
                user_id=recipient.id
            ).first()
        else:
            recipient_profile = DoctorProfile.query.filter_by(
                user_id=recipient.id
            ).first()

        if not recipient_profile:
            return error(
                f"{recipient.role.title()} profile not found.",
                404,
            )

        link = get_link_for(elder_profile, recipient)
        if link and link.is_active:
            return error("You are already connected to this care-team member.", 409)

        existing = ConnectionRequest.query.filter_by(
            requester_id=user.id,
            elder_user_id=recipient.id,
            requester_role="ELDER",
            status="PENDING",
        ).first()
        if existing:
            return error("Your invitation is already pending.", 409)

        connection = ConnectionRequest(
            requester_id=user.id,
            elder_user_id=recipient.id,
            requester_role="ELDER",
            status="PENDING",
            created_at=datetime.utcnow(),
        )
        db.session.add(connection)
        notify(
            recipient.id,
            "Elder care-team invitation",
            f"{user.full_name} invited you to join their Elder Sense care team. Review the invitation in My Care Team.",
            "CONNECTION_REQUEST",
        )
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Invitation sent. Access remains restricted until the recipient accepts.",
            "request": {"id": connection.id, "status": connection.status},
        }), 201

    if user.role not in ("CAREGIVER", "DOCTOR"):
        return error("Only elders, caregivers, and doctors can send connection requests.", 403)

    elder_user = find_user_by_email(email, "ELDER")
    if not elder_user or not elder_user.elder_profile:
        return error("No elder account was found with that email.", 404)

    if user.role == "CAREGIVER":
        profile = CaregiverProfile.query.filter_by(user_id=user.id).first()
        if not profile:
            return error("Caregiver profile not found.", 404)
        link = CaregiverElderLink.query.filter_by(
            caregiver_id=profile.id,
            elder_id=elder_user.elder_profile.id,
        ).first()
    else:
        profile = DoctorProfile.query.filter_by(user_id=user.id).first()
        if not profile:
            return error("Doctor profile not found.", 404)
        link = DoctorElderLink.query.filter_by(
            doctor_id=profile.id,
            elder_id=elder_user.elder_profile.id,
        ).first()

    if link and link.is_active:
        return error("You are already connected to this elder.", 409)

    existing = ConnectionRequest.query.filter_by(
        requester_id=user.id,
        elder_user_id=elder_user.id,
        requester_role=user.role,
        status="PENDING",
    ).first()
    if existing:
        return error("Your connection request is already pending.", 409)

    connection = ConnectionRequest(
        requester_id=user.id,
        elder_user_id=elder_user.id,
        requester_role=user.role,
        status="PENDING",
        created_at=datetime.utcnow(),
    )
    db.session.add(connection)
    notify(
        elder_user.id,
        "Care team connection request",
        f"{user.full_name} ({user.role.lower()}) requested access to your care information. Review this request in My Care Team.",
        "CONNECTION_REQUEST",
    )
    db.session.commit()

    return jsonify({
        "success": True,
        "message": "Request sent. Access remains restricted until the elder approves it.",
        "request": {"id": connection.id, "status": connection.status},
    }), 201


@connections_bp.route("/requests", methods=["GET"])
@jwt_required()
def list_requests():
    user = current_user()
    if not user:
        return error("User not found.", 404)

    if user.role == "ELDER":
        incoming = ConnectionRequest.query.filter(
            ConnectionRequest.elder_user_id == user.id,
            ConnectionRequest.requester_role.in_(("CAREGIVER", "DOCTOR")),
            ConnectionRequest.status == "PENDING",
        ).all()
        outgoing = ConnectionRequest.query.filter_by(
            requester_id=user.id,
            requester_role="ELDER",
        ).all()
        records = incoming + outgoing
    elif user.role in ("CAREGIVER", "DOCTOR"):
        outgoing = ConnectionRequest.query.filter_by(
            requester_id=user.id,
            requester_role=user.role,
        ).all()
        incoming = ConnectionRequest.query.filter_by(
            elder_user_id=user.id,
            requester_role="ELDER",
        ).all()
        records = outgoing + incoming
    else:
        return error("Unsupported role.", 403)

    records.sort(
        key=lambda item: item.created_at or datetime.min,
        reverse=True,
    )

    items = []
    for item in records:
        requester = db.session.get(User, item.requester_id)
        target = db.session.get(User, item.elder_user_id)
        items.append({
            "id": item.id,
            "status": item.status,
            "requester_role": item.requester_role,
            "requester": user_payload(requester) if requester else None,
            "elder": user_payload(target) if target else None,
            "target": user_payload(target) if target else None,
            "direction": (
                "ELDER_TO_CARE_TEAM"
                if item.requester_role == "ELDER"
                else "CARE_TEAM_TO_ELDER"
            ),
            "created_at": item.created_at.isoformat() if item.created_at else None,
        })

    return jsonify({"success": True, "requests": items})


@connections_bp.route("/requests/<int:request_id>/decision", methods=["POST", "DELETE", "OPTIONS"])
@jwt_required()
def decide_request(request_id):
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    user = current_user()
    if not user:
        return error("User not found.", 404)

    item = db.session.get(ConnectionRequest, request_id)
    if not item:
        return error("Connection request not found.", 404)

    body = request.get_json(silent=True) or {}
    requested_decision = str(body.get("decision", "")).strip().upper()

    # Only the two people involved in a request may delete / reject it
    if user.id not in (item.requester_id, item.elder_user_id):
        return error("You are not allowed to modify this request.", 403)

    # Permanent hard deletion when DELETE or REJECT is requested
    if request.method == "DELETE" or requested_decision == "REJECT":
        try:
            purge_links_between(item.requester_id, item.elder_user_id)
            db.session.delete(item)
            db.session.commit()
        except Exception:
            db.session.rollback()
            return error("Could not delete this connection. Please try again.", 500)
        return jsonify({"success": True, "message": "Connection permanently deleted from database."}), 200

    data = request.get_json(silent=True) or {}
    decision = str(data.get("decision", "")).strip().upper()
    if decision != "APPROVE":
        return error("Decision must be APPROVE.")

    if item.status != "PENDING":
        return error("This request has already been decided.", 409)

    requester = db.session.get(User, item.requester_id)
    target_user = db.session.get(User, item.elder_user_id)
    if not requester or not target_user:
        return error("Required user account was not found.", 404)

    if item.requester_role == "ELDER":
        if target_user.id != user.id or user.role not in ("CAREGIVER", "DOCTOR"):
            return error("This invitation is not addressed to your account.", 403)
        elder_profile = ElderProfile.query.filter_by(user_id=requester.id).first()
        if not elder_profile:
            return error("Elder profile not found.", 404)

        ok, message = activate_link(elder_profile, user)
        if not ok:
            return error(message or "Could not activate this connection.", 404)

        item.status = "APPROVED"
        notify(
            requester.id,
            "Care-team invitation accepted",
            f"{user.full_name} accepted your care-team invitation.",
            "CONNECTION_APPROVED",
        )
        item.decided_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"success": True, "status": item.status, "message": "Invitation accepted."})

    if user.role != "ELDER" or item.elder_user_id != user.id:
        return error("Only the addressed elder can decide this request.", 403)

    elder_profile = ElderProfile.query.filter_by(user_id=user.id).first()
    if not elder_profile:
        return error("Elder profile not found.", 404)

    ok, message = activate_link(elder_profile, requester)
    if not ok:
        return error(message or "Could not activate this connection.", 404)

    item.status = "APPROVED"
    notify(
        requester.id,
        "Connection request approved",
        f"{user.full_name} approved your care-team connection request.",
        "CONNECTION_APPROVED",
    )
    item.decided_at = datetime.utcnow()
    db.session.commit()

    return jsonify({"success": True, "status": item.status, "message": "Request approved."})


@connections_bp.route("/team", methods=["GET"])
@jwt_required()
def care_team():
    user = current_user()
    if not user:
        return error("User not found.", 404)
    if user.role != "ELDER":
        return error("Only elders can view this care-team list.", 403)

    elder = ElderProfile.query.filter_by(user_id=user.id).first()
    if not elder:
        return error("Elder profile not found.", 404)

    members = []
    for link in CaregiverElderLink.query.filter_by(
        elder_id=elder.id, is_active=True
    ).all():
        profile = db.session.get(CaregiverProfile, link.caregiver_id)
        member = db.session.get(User, profile.user_id) if profile else None
        if member:
            members.append({
                **user_payload(member),
                "link_id": link.id,
                "link_type": "CAREGIVER",
                "relationship": link.relationship,
                "connected_at": link.created_at.isoformat() if link.created_at else None,
            })

    for link in DoctorElderLink.query.filter_by(
        elder_id=elder.id, is_active=True
    ).all():
        profile = db.session.get(DoctorProfile, link.doctor_id)
        member = db.session.get(User, profile.user_id) if profile else None
        if member:
            members.append({
                **user_payload(member),
                "link_id": link.id,
                "link_type": "DOCTOR",
                "specialization": profile.specialization,
                "hospital": profile.hospital,
                "connected_at": link.created_at.isoformat() if link.created_at else None,
            })

    return jsonify({"success": True, "members": members})


@connections_bp.route("/team/<string:link_type>/<int:link_id>", methods=["DELETE", "OPTIONS"])
@connections_bp.route("/team/<int:link_id>", methods=["DELETE", "OPTIONS"], defaults={"link_type": None})
@jwt_required()
def remove_team_member(link_id, link_type=None):
    """Permanently delete a CaregiverElderLink / DoctorElderLink row by its own primary key."""
    if request.method == "OPTIONS":
        return jsonify({"success": True}), 200

    user = current_user()
    if not user:
        return error("User not found.", 404)
    if user.role != "ELDER":
        return error("Only elders can remove care-team members.", 403)

    elder = ElderProfile.query.filter_by(user_id=user.id).first()
    if not elder:
        return error("Elder profile not found.", 404)

    kind = str(
        link_type
        or request.args.get("type")
        or (request.get_json(silent=True) or {}).get("type")
        or ""
    ).strip().upper()

    caregiver_link = doctor_link = None
    if kind in ("", "CAREGIVER"):
        found = db.session.get(CaregiverElderLink, link_id)
        if found and found.elder_id == elder.id:
            caregiver_link = found
    if kind in ("", "DOCTOR"):
        found = db.session.get(DoctorElderLink, link_id)
        if found and found.elder_id == elder.id:
            doctor_link = found

    if caregiver_link and doctor_link:
        return error("Ambiguous link id. Please specify the member type.", 400)

    link = caregiver_link or doctor_link
    if not link:
        return error("Care-team link not found.", 404)

    if caregiver_link:
        profile = db.session.get(CaregiverProfile, link.caregiver_id)
    else:
        profile = db.session.get(DoctorProfile, link.doctor_id)

    try:
        member_user_id = profile.user_id if profile else None
        db.session.delete(link)
        if member_user_id:
            purge_requests_between(user.id, member_user_id)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return error("Could not remove this care-team member. Please try again.", 500)

    return jsonify({
        "success": True,
        "message": "Care-team member permanently removed.",
    }), 200