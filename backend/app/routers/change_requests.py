from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth_dependency import CurrentUser, require_role, require_roles
from app.models.student import Student
from app.schemas.change_request import (
    AcceptRequest,
    AdminChangeRequestOut,
    BulkActionRequest,
    ChangeRequestOut,
    ChangeRequestSubmit,
    DeclineRequest,
    FieldOut,
    PendingSummaryOut,
)
from app.services import change_request_service

router = APIRouter(prefix="/change-requests", tags=["Change Requests"])

STUDENT = require_role("student")
ADMIN = require_roles("admin", "super_admin")


def _to_out(r) -> ChangeRequestOut:
    """
    Maps the ORM row onto the response schema. `reviewed_by` is the actual
    column name on StudentChangeRequest — reading a non-existent
    `reviewed_by_id` here raised AttributeError on every fetched row.
    """
    return ChangeRequestOut(
        id=r.id,
        student_id=r.student_id,
        field_name=r.field_name,
        field_label=r.field_label,
        current_value=r.current_value,
        requested_value=r.requested_value,
        status=r.status if isinstance(r.status, str) else r.status.value,
        admin_note=r.admin_note,
        created_at=r.created_at,
        reviewed_at=r.reviewed_at,
        reviewed_by=r.reviewed_by,
        reviewed_by_name=getattr(r, "_reviewer_name", None),
    )


def _current_student(db: Session, current_user: CurrentUser) -> Student:
    student = db.query(Student).filter(Student.user_id == current_user.user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found.")
    return student


# ── Student ──────────────────────────────────────────────────────────────────

@router.get("/fields", response_model=List[FieldOut])
def list_reportable_fields(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(STUDENT),
):
    """Every reportable field plus the student's current and pending values."""
    student = _current_student(db, current_user)
    return change_request_service.list_reportable_fields(db, student.id)


@router.post("/me", response_model=List[ChangeRequestOut], status_code=status.HTTP_201_CREATED)
def submit_my_change_request(
    payload: ChangeRequestSubmit,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(STUDENT),
):
    student = _current_student(db, current_user)
    rows = change_request_service.submit_change_request(db, student.id, payload)
    return [_to_out(r) for r in rows]


@router.get("/me", response_model=List[ChangeRequestOut])
def my_change_requests(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(STUDENT),
):
    student = _current_student(db, current_user)
    rows = change_request_service.list_student_requests(db, student.id)
    return [_to_out(r) for r in rows]


@router.delete("/me/{request_id}")
def withdraw_my_change_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(STUDENT),
):
    student = _current_student(db, current_user)
    return change_request_service.withdraw_request(db, student.id, request_id)


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/admin/summary", response_model=PendingSummaryOut)
def admin_pending_summary(
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(ADMIN),
):
    """Counts + the newest few pending requests, for the dashboard card."""
    return change_request_service.pending_summary(db)


@router.get("/admin/pending", response_model=List[AdminChangeRequestOut])
def admin_list_pending(
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(ADMIN),
):
    return change_request_service.list_pending_requests(db)


@router.get("/admin/all", response_model=List[AdminChangeRequestOut])
def admin_list_all(
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(ADMIN),
):
    return change_request_service.list_all_requests(db)


@router.post("/admin/{request_id}/accept", response_model=ChangeRequestOut)
def admin_accept(
    request_id: int,
    payload: AcceptRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(ADMIN),
):
    req = change_request_service.accept_request(
        db, request_id, current_user.user_id, payload.admin_note
    )
    return _to_out(req)


@router.post("/admin/{request_id}/decline", response_model=ChangeRequestOut)
def admin_decline(
    request_id: int,
    payload: DeclineRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(ADMIN),
):
    req = change_request_service.decline_request(
        db, request_id, current_user.user_id, payload.admin_note
    )
    return _to_out(req)


@router.post("/admin/bulk-accept")
def admin_bulk_accept(
    payload: BulkActionRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(ADMIN),
):
    return change_request_service.bulk_accept(db, payload.request_ids, current_user.user_id)


@router.delete("/admin/students/{student_id}")
def admin_delete_student(
    student_id: int,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(ADMIN),
):
    return change_request_service.delete_student(db, student_id)