"""
Change-request business logic.

Flow: a student submits one or more field corrections -> a PENDING
StudentChangeRequest row per field -> an admin accepts (value is coerced and
written to the real record) or declines (nothing is written) -> either way the
student gets a Notification through the existing notification tables.
"""
from __future__ import annotations

import logging
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.change_request import StudentChangeRequest, ChangeRequestStatus
from app.models.notification import Notification
from app.models.student import Student
from app.models.user import User
from app.schemas.change_request import (
    FIELD_REGISTRY,
    DERIVED_PERCENTAGES,
    AdminChangeRequestOut,
    ChangeRequestSubmit,
    FieldSpec,
    FieldValueError,
    format_current,
    parse_value,
)

logger = logging.getLogger(__name__)

NOTIFICATION_TYPE = "change_request"
STUDENT_LINK = "/student/report-changes"


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_student(db: Session, student_id: int) -> Student:
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Student not found.")
    return s


def _get_request(db: Session, request_id: int) -> StudentChangeRequest:
    r = db.query(StudentChangeRequest).filter(StudentChangeRequest.id == request_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Change request not found.")
    return r


def _record_for(db: Session, student: Student, spec: FieldSpec):
    """Change requests target either the students row or the linked users row."""
    if spec.target == "user":
        user = db.query(User).filter(User.id == student.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="Linked user account not found.")
        return user
    return student


def _live_value(db: Session, student: Student, field_name: str) -> Optional[str]:
    spec = FIELD_REGISTRY.get(field_name)
    if not spec:
        return None
    record = _record_for(db, student, spec)
    return format_current(spec, getattr(record, field_name, None))


def _notify_student(db: Session, student_id: int, title: str, message: str) -> None:
    """
    Uses the existing per-student Notification table. broadcast_id stays NULL
    because this isn't an admin broadcast — it's a targeted, one-off message,
    so it never shows up in broadcast analytics.
    """
    db.add(Notification(
        student_id=student_id,
        title=title,
        message=message,
        type=NOTIFICATION_TYPE,
        link=STUDENT_LINK,
        broadcast_id=None,
    ))


def _recompute_percentages(student: Student, changed_field: str) -> None:
    """Keep the derived ssc_/intermediate_ percentage columns consistent."""
    for pct_col, (marks_col, max_col) in DERIVED_PERCENTAGES.items():
        if changed_field not in (marks_col, max_col):
            continue
        marks = getattr(student, marks_col, None)
        maximum = getattr(student, max_col, None)
        if marks is None or maximum in (None, 0):
            continue
        try:
            pct = (Decimal(str(marks)) / Decimal(str(maximum)) * Decimal(100))
            setattr(student, pct_col, pct.quantize(Decimal("0.01")))
        except Exception:
            logger.warning("Could not recompute %s for student %s", pct_col, student.id)


def _reviewer_names(db: Session, requests) -> dict[int, str]:
    ids = {r.reviewed_by for r in requests if r.reviewed_by}
    if not ids:
        return {}
    rows = db.query(User.id, User.full_name, User.email).filter(User.id.in_(ids)).all()
    return {uid: (name or email) for uid, name, email in rows}


# ── Student side ─────────────────────────────────────────────────────────────

def list_reportable_fields(db: Session, student_id: int) -> list[dict]:
    """
    The /fields payload: every reportable field with its current value and,
    if one exists, the value already awaiting review. Driven entirely by
    FIELD_REGISTRY so it can never drift from what submit accepts.
    """
    student = _get_student(db, student_id)
    user = db.query(User).filter(User.id == student.user_id).first()

    pending = {
        r.field_name: r.requested_value
        for r in db.query(StudentChangeRequest).filter(
            StudentChangeRequest.student_id == student_id,
            StudentChangeRequest.status == ChangeRequestStatus.PENDING,
        ).all()
    }

    out = []
    for spec in FIELD_REGISTRY.values():
        source = user if spec.target == "user" else student
        out.append({
            "field_name": spec.name,
            "field_label": spec.label,
            "group": spec.group,
            "kind": spec.kind,
            "choices": spec.choices,
            "help": spec.help or None,
            "current_value": format_current(spec, getattr(source, spec.name, None)),
            "pending_value": pending.get(spec.name),
        })
    return out


def submit_change_request(db: Session, student_id: int, payload: ChangeRequestSubmit) -> list:
    student = _get_student(db, student_id)

    # Validate everything up front so one bad field doesn't half-commit the batch.
    validated: list[tuple[FieldSpec, str, Optional[str]]] = []
    errors: list[str] = []

    for item in payload.changes:
        spec = FIELD_REGISTRY[item.field_name]
        try:
            _typed, canonical = parse_value(spec, item.requested_value)
        except FieldValueError as exc:
            errors.append(str(exc))
            continue

        current = _live_value(db, student, spec.name)
        if current is not None and canonical.lower() == current.lower():
            errors.append(f"{spec.label} already has that value — nothing to correct.")
            continue

        if spec.name == "email":
            clash = db.query(User.id).filter(
                User.email == canonical, User.id != student.user_id
            ).first()
            if clash:
                errors.append("That login email is already used by another account.")
                continue

        validated.append((spec, canonical, current))

    if errors:
        raise HTTPException(status_code=422, detail=" ".join(errors))

    created = []
    for spec, canonical, current in validated:
        existing = (
            db.query(StudentChangeRequest)
            .filter(
                StudentChangeRequest.student_id == student_id,
                StudentChangeRequest.field_name == spec.name,
                StudentChangeRequest.status == ChangeRequestStatus.PENDING,
            )
            .first()
        )
        if existing:
            # Re-reporting the same field replaces the open request rather
            # than stacking duplicates in the admin queue.
            existing.requested_value = canonical
            existing.current_value = current
            existing.field_label = spec.label
            created.append(existing)
            continue

        req = StudentChangeRequest(
            student_id=student_id,
            field_name=spec.name,
            field_label=spec.label,
            current_value=current,
            requested_value=canonical,
            status=ChangeRequestStatus.PENDING,
        )
        db.add(req)
        created.append(req)

    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to save change requests for student %s", student_id)
        raise HTTPException(status_code=500, detail="Could not save your request. Please try again.")

    for r in created:
        db.refresh(r)
    return created


def list_student_requests(db: Session, student_id: int) -> list:
    rows = (
        db.query(StudentChangeRequest)
        .filter(StudentChangeRequest.student_id == student_id)
        .order_by(StudentChangeRequest.created_at.desc())
        .all()
    )
    names = _reviewer_names(db, rows)
    for r in rows:
        # Transient attribute the router reads when building the response.
        r._reviewer_name = names.get(r.reviewed_by)
    return rows


def withdraw_request(db: Session, student_id: int, request_id: int) -> dict:
    """A student can cancel their own request while it's still PENDING."""
    req = _get_request(db, request_id)
    if req.student_id != student_id:
        raise HTTPException(status_code=403, detail="That request isn't yours.")
    if req.status != ChangeRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Request is already {req.status.value}.")
    label = req.field_label
    db.delete(req)
    db.commit()
    return {"message": f"Withdrew your request to change '{label}'."}


# ── Admin side ───────────────────────────────────────────────────────────────

def _build_admin_rows(db: Session, rows) -> list[AdminChangeRequestOut]:
    reviewer_ids = {req.reviewed_by for req, *_ in rows if req.reviewed_by}
    names: dict[int, str] = {}
    if reviewer_ids:
        for uid, full_name, email in db.query(User.id, User.full_name, User.email).filter(
            User.id.in_(reviewer_ids)
        ).all():
            names[uid] = full_name or email

    result = []
    for req, full_name, register_number, branch in rows:
        student = db.query(Student).filter(Student.id == req.student_id).first()
        live = _live_value(db, student, req.field_name) if student else None
        stale = (
            req.status == ChangeRequestStatus.PENDING
            and (live or "") != (req.current_value or "")
        )
        result.append(AdminChangeRequestOut(
            id=req.id,
            student_id=req.student_id,
            student_name=full_name,
            register_number=register_number,
            branch=branch,
            field_name=req.field_name,
            field_label=req.field_label,
            current_value=req.current_value,
            live_value=live,
            is_stale=stale,
            requested_value=req.requested_value,
            status=req.status.value if hasattr(req.status, "value") else str(req.status),
            admin_note=req.admin_note,
            created_at=req.created_at,
            reviewed_at=req.reviewed_at,
            reviewed_by=req.reviewed_by,
            reviewed_by_name=names.get(req.reviewed_by),
        ))
    return result


def _base_admin_query(db: Session):
    return (
        db.query(
            StudentChangeRequest,
            Student.full_name,
            Student.register_number,
            Student.branch,
        )
        .join(Student, Student.id == StudentChangeRequest.student_id)
    )


def list_pending_requests(db: Session, limit: Optional[int] = None) -> list[AdminChangeRequestOut]:
    q = (
        _base_admin_query(db)
        .filter(StudentChangeRequest.status == ChangeRequestStatus.PENDING)
        .order_by(StudentChangeRequest.created_at.desc())
    )
    if limit:
        q = q.limit(limit)
    return _build_admin_rows(db, q.all())


def list_all_requests(db: Session) -> list[AdminChangeRequestOut]:
    rows = _base_admin_query(db).order_by(StudentChangeRequest.created_at.desc()).all()
    return _build_admin_rows(db, rows)


def pending_summary(db: Session, recent_limit: int = 5) -> dict:
    """Feeds the Student Change Requests card on the admin dashboard."""
    pending = (
        db.query(StudentChangeRequest)
        .filter(StudentChangeRequest.status == ChangeRequestStatus.PENDING)
        .all()
    )
    return {
        "pending_count": len(pending),
        "student_count": len({p.student_id for p in pending}),
        "recent": list_pending_requests(db, limit=recent_limit),
    }


def accept_request(
    db: Session, request_id: int, admin_user_id: int, admin_note: Optional[str] = None
) -> StudentChangeRequest:
    req = _get_request(db, request_id)
    if req.status != ChangeRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Request is already {req.status.value}.")

    spec = FIELD_REGISTRY.get(req.field_name)
    if not spec:
        raise HTTPException(
            status_code=422,
            detail=f"'{req.field_name}' is no longer a reportable field; decline this request instead.",
        )

    student = _get_student(db, req.student_id)
    record = _record_for(db, student, spec)
    if not hasattr(record, spec.name):
        raise HTTPException(
            status_code=422,
            detail=f"Field '{spec.name}' no longer exists on the record.",
        )

    # Re-validate at accept time: the value was checked when submitted, but the
    # rules (or the registry) may have changed since.
    try:
        typed_value, canonical = parse_value(spec, req.requested_value)
    except FieldValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    if spec.name == "email":
        clash = db.query(User.id).filter(
            User.email == canonical, User.id != student.user_id
        ).first()
        if clash:
            raise HTTPException(
                status_code=409,
                detail="Another account already uses that email. Decline this request.",
            )

    setattr(record, spec.name, typed_value)
    if spec.target == "student":
        _recompute_percentages(student, spec.name)

    req.status = ChangeRequestStatus.ACCEPTED
    req.reviewed_at = datetime.utcnow()
    req.reviewed_by = admin_user_id
    req.requested_value = canonical
    if admin_note and admin_note.strip():
        req.admin_note = admin_note.strip()

    _notify_student(
        db, req.student_id,
        title="Profile change approved",
        message=(
            f"Your request to update '{req.field_label}' has been approved. "
            f"Your profile now shows: {canonical}."
            + (f"\n\nNote from the placement cell: {req.admin_note}" if req.admin_note else "")
        ),
    )

    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to accept change request %s", request_id)
        raise HTTPException(
            status_code=500,
            detail="Could not apply that change. The student's record was left unchanged.",
        )

    db.refresh(req)
    req._reviewer_name = _reviewer_names(db, [req]).get(admin_user_id)
    return req


def decline_request(
    db: Session, request_id: int, admin_user_id: int, admin_note: str
) -> StudentChangeRequest:
    req = _get_request(db, request_id)
    if req.status != ChangeRequestStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Request is already {req.status.value}.")

    req.status = ChangeRequestStatus.DECLINED
    req.reviewed_at = datetime.utcnow()
    req.reviewed_by = admin_user_id
    req.admin_note = admin_note.strip()

    _notify_student(
        db, req.student_id,
        title="Profile change declined",
        message=(
            f"Your request to update '{req.field_label}' to \"{req.requested_value}\" was declined. "
            f"Your existing value stays unchanged.\n\nReason: {req.admin_note}"
        ),
    )

    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to decline change request %s", request_id)
        raise HTTPException(status_code=500, detail="Could not record the decline. Please try again.")

    db.refresh(req)
    req._reviewer_name = _reviewer_names(db, [req]).get(admin_user_id)
    return req


def bulk_accept(db: Session, request_ids: list[int], admin_user_id: int) -> dict:
    """Accept several requests, reporting per-request failures instead of aborting."""
    accepted, failed = [], []
    for rid in request_ids:
        try:
            accept_request(db, rid, admin_user_id, None)
            accepted.append(rid)
        except HTTPException as exc:
            failed.append({"id": rid, "reason": exc.detail})
    return {
        "accepted": accepted,
        "failed": failed,
        "message": f"Accepted {len(accepted)} request(s)." + (
            f" {len(failed)} could not be applied." if failed else ""
        ),
    }


# ── Student deletion (kept here for backwards compatibility) ─────────────────
# NOTE: this belongs in a student/admin service, not in change requests. It is
# left in place so existing imports keep working; move it when convenient.

def delete_student(db: Session, student_id: int) -> dict:
    """
    Delete a student and every record that references them, in FK-safe order.

    Tables referencing students.id (in deletion order):
      blog_upvotes      -> blogs         -> (student_id NOT NULL, no cascade)
      blog_upvotes      -> student_id    -> NOT NULL
      blogs             -> student_id    -> NOT NULL
      placement_records -> student_id    -> nullable  (NULL it out, keep record)
      applications      -> student_id    -> NOT NULL
      cluster_members   -> student_id    -> NOT NULL
      notifications     -> student_id    -> NOT NULL
      student_change_requests -> student_id -> CASCADE (handled automatically)
    """
    import os
    from sqlalchemy import text

    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    student_name    = student.full_name
    register_number = student.register_number
    user_id         = student.user_id

    try:
        # 1. Blog upvotes by this student
        db.execute(text("DELETE FROM blog_upvotes WHERE student_id = :sid"), {"sid": student_id})
    except Exception:
        pass

    try:
        # 2. Upvotes ON this student's blogs (other students upvoting them)
        db.execute(text("""
            DELETE bv FROM blog_upvotes bv
            INNER JOIN blogs b ON bv.blog_id = b.id
            WHERE b.student_id = :sid
        """), {"sid": student_id})
    except Exception:
        pass

    try:
        # 3. Blogs written by this student
        db.execute(text("DELETE FROM blogs WHERE student_id = :sid"), {"sid": student_id})
    except Exception:
        pass

    try:
        # 4. Placement records — nullable FK, NULL it out to preserve the record
        db.execute(
            text("UPDATE placement_records SET student_id = NULL WHERE student_id = :sid"),
            {"sid": student_id},
        )
    except Exception:
        pass

    try:
        # 5. Applications
        db.execute(text("DELETE FROM applications WHERE student_id = :sid"), {"sid": student_id})
    except Exception:
        pass

    try:
        # 6. Cluster memberships
        db.execute(text("DELETE FROM cluster_members WHERE student_id = :sid"), {"sid": student_id})
    except Exception:
        pass

    # 7. Notifications (ORM — ensures broadcast analytics stay consistent)
    db.query(Notification).filter(Notification.student_id == student_id).delete(
        synchronize_session=False
    )

    # 8. Change requests (also has ondelete=CASCADE but explicit is safer)
    db.query(StudentChangeRequest).filter(
        StudentChangeRequest.student_id == student_id
    ).delete(synchronize_session=False)

    # 9. Resume file from disk
    if student.resume_filename:
        filepath = os.path.join("uploads/resumes", student.resume_filename)
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception:
            pass

    # 10. Student row
    db.delete(student)
    db.flush()

    # 11. User row (blogs.author_id already set to SET NULL via existing FK)
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        db.delete(user)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to delete student %s", student_id)
        raise HTTPException(
            status_code=500,
            detail=f"Deletion failed: {exc}. The student record was not deleted.",
        )

    return {
        "message": f"Student '{student_name}' ({register_number}) deleted successfully.",
        "deleted_student_id": student_id,
    }