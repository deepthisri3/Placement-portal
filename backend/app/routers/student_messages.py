from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth_dependency import CurrentUser, require_role, require_roles
from app.schemas.student_message import AdminRecipient, MessageSend, MessageOut, AdminMessagesOut
from app.services import student_message_service as svc

router = APIRouter(prefix="/messages", tags=["Student Messages"])

STUDENT = require_role("student")
ADMIN   = require_roles("admin", "super_admin")


# ── Student endpoints ─────────────────────────────────────────────────────────

@router.get("/admins", response_model=List[AdminRecipient])
def list_admins(
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(STUDENT),
):
    """Returns all activated admin accounts a student can message."""
    return svc.list_admins(db)


@router.post("", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send_message(
    payload: MessageSend,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(STUDENT),
):
    return svc.send_message(db, current_user.user_id, payload)


@router.get("/sent", response_model=List[MessageOut])
def my_sent_messages(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(STUDENT),
):
    return svc.list_sent(db, current_user.user_id)


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.get("/admin/inbox", response_model=AdminMessagesOut)
def admin_inbox(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(ADMIN),
):
    return svc.admin_inbox(db, current_user.user_id)


@router.get("/admin/unread-count")
def admin_unread_count(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(ADMIN),
):
    return svc.admin_unread_count(db, current_user.user_id)


@router.post("/admin/{message_id}/read", response_model=MessageOut)
def admin_mark_read(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(ADMIN),
):
    return svc.admin_mark_read(db, current_user.user_id, message_id)


@router.post("/admin/read-all")
def admin_mark_all_read(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(ADMIN),
):
    return svc.admin_mark_all_read(db, current_user.user_id)