from __future__ import annotations
from datetime import datetime
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.student_message import StudentMessage
from app.models.student import Student
from app.models.user import User, RoleEnum
from app.schemas.student_message import MessageSend, MessageOut, AdminMessagesOut


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_student(db: Session, user_id: int) -> Student:
    s = db.query(Student).filter(Student.user_id == user_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Student profile not found.")
    return s


def _build_out(row: StudentMessage, student_name: Optional[str],
               register_number: Optional[str], admin_name: Optional[str]) -> MessageOut:
    return MessageOut(
        id=row.id,
        student_id=row.student_id,
        admin_id=row.admin_id,
        subject=row.subject,
        message=row.message,
        status=row.status,
        created_at=row.created_at,
        read_at=row.read_at,
        student_name=student_name,
        register_number=register_number,
        admin_name=admin_name,
    )


def _admin_name(db: Session, admin_id: Optional[int]) -> Optional[str]:
    if not admin_id:
        return None
    u = db.query(User).filter(User.id == admin_id).first()
    return u.full_name or u.email if u else None


# ── Student: list admins they can message ────────────────────────────────────

def list_admins(db: Session) -> list:
    """
    Returns all activated admin accounts a student can message.
    branch is included for future use — currently NULL for all admins
    since the User model doesn't store branch yet.
    """
    admins = (
        db.query(User)
        .filter(User.role.in_([RoleEnum.admin, RoleEnum.super_admin]))
        .filter(User.password_hash.isnot(None))  # only activated accounts
        .order_by(User.full_name)
        .all()
    )
    return [
        {
            "id": a.id,
            "full_name": a.full_name or a.email,
            "email": a.email,
            "role": a.role.value,
            "branch": getattr(a, "branch", None),   # future: branch assignment per admin
        }
        for a in admins
    ]


# ── Student: send a message ──────────────────────────────────────────────────

def send_message(db: Session, user_id: int, payload: MessageSend) -> MessageOut:
    student = _get_student(db, user_id)

    # Verify the target is actually an admin
    admin = db.query(User).filter(
        User.id == payload.admin_id,
        User.role.in_([RoleEnum.admin, RoleEnum.super_admin]),
    ).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found.")

    msg = StudentMessage(
        student_id=student.id,
        admin_id=payload.admin_id,
        subject=payload.subject.strip(),
        message=payload.message.strip(),
        status="unread",
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _build_out(msg, student.full_name, student.register_number,
                      admin.full_name or admin.email)


# ── Student: their own sent messages ────────────────────────────────────────

def list_sent(db: Session, user_id: int) -> list[MessageOut]:
    student = _get_student(db, user_id)
    rows = (
        db.query(StudentMessage)
        .filter(StudentMessage.student_id == student.id)
        .order_by(StudentMessage.created_at.desc())
        .all()
    )
    out = []
    for r in rows:
        out.append(_build_out(r, student.full_name, student.register_number,
                              _admin_name(db, r.admin_id)))
    return out


# ── Admin: inbox ─────────────────────────────────────────────────────────────

def admin_inbox(db: Session, admin_user_id: int) -> AdminMessagesOut:
    rows = (
        db.query(StudentMessage, Student.full_name, Student.register_number)
        .join(Student, Student.id == StudentMessage.student_id)
        .filter(StudentMessage.admin_id == admin_user_id)
        .order_by(StudentMessage.created_at.desc())
        .all()
    )
    admin_name = _admin_name(db, admin_user_id)
    messages = [
        _build_out(row, full_name, reg_num, admin_name)
        for row, full_name, reg_num in rows
    ]
    unread = sum(1 for m in messages if m.status == "unread")
    return AdminMessagesOut(unread_count=unread, messages=messages)


def admin_unread_count(db: Session, admin_user_id: int) -> dict:
    count = (
        db.query(StudentMessage)
        .filter(
            StudentMessage.admin_id == admin_user_id,
            StudentMessage.status == "unread",
        )
        .count()
    )
    return {"unread_count": count}


def admin_mark_read(db: Session, admin_user_id: int, message_id: int) -> MessageOut:
    msg = db.query(StudentMessage).filter(
        StudentMessage.id == message_id,
        StudentMessage.admin_id == admin_user_id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")
    if msg.status != "read":
        msg.status = "read"
        msg.read_at = datetime.utcnow()
        db.commit()
        db.refresh(msg)
    student = db.query(Student).filter(Student.id == msg.student_id).first()
    return _build_out(msg,
                      student.full_name if student else None,
                      student.register_number if student else None,
                      _admin_name(db, admin_user_id))


def admin_mark_all_read(db: Session, admin_user_id: int) -> dict:
    now = datetime.utcnow()
    updated = (
        db.query(StudentMessage)
        .filter(
            StudentMessage.admin_id == admin_user_id,
            StudentMessage.status == "unread",
        )
        .all()
    )
    for m in updated:
        m.status = "read"
        m.read_at = now
    db.commit()
    return {"marked_read": len(updated)}