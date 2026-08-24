"""
Notification business logic.
Deadline notifications are generated lazily (no scheduler): whenever a student
reads their notifications or the unread count, we ensure a deadline row exists
for every opportunity closing within the next 7 days.
"""
import logging
from fastapi import HTTPException
from sqlalchemy import text, func
from sqlalchemy.orm import Session
from app.models.notification import Notification, NotificationBroadcast
from app.models.student import Student
from app.models.cluster import ClusterMember

logger = logging.getLogger(__name__)
DEADLINE_WINDOW_DAYS = 7


def _resolve_student(db: Session, current_user) -> Student:
    student = (
        db.query(Student)
        .filter(Student.user_id == current_user.user_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=403, detail="Only students have notifications.")
    return student


def _generate_deadline_notifications(db: Session, student_id: int) -> None:
    try:
        rows = db.execute(text(f"""
            SELECT id, company_name AS label, registration_link AS link,
                   last_date_to_apply AS ldate, 'on_campus' AS otype
            FROM on_campus_opportunities
            WHERE last_date_to_apply >= NOW()
              AND last_date_to_apply <= NOW() + INTERVAL {DEADLINE_WINDOW_DAYS} DAY
            UNION ALL
            SELECT id, title AS label, link AS link,
                   last_date_to_apply AS ldate, 'off_campus' AS otype
            FROM off_campus_opportunities
            WHERE last_date_to_apply >= NOW()
              AND last_date_to_apply <= NOW() + INTERVAL {DEADLINE_WINDOW_DAYS} DAY
        """)).fetchall()
    except Exception:
        logger.exception("Deadline scan failed; skipping deadline generation.")
        db.rollback()
        return

    created = False
    for r in rows:
        m = r._mapping
        otype = m["otype"]
        oid = m["id"]
        exists = (
            db.query(Notification.id)
            .filter(
                Notification.student_id == student_id,
                Notification.opportunity_type == otype,
                Notification.opportunity_id == oid,
            )
            .first()
        )
        if exists:
            continue
        label = m["label"] or "An opportunity"
        ldate = m["ldate"]
        try:
            date_str = ldate.strftime("%d %b %Y")
        except Exception:
            date_str = "soon"
        db.add(Notification(
            student_id=student_id,
            title="Deadline approaching",
            message=f"Applications for {label} close on {date_str}.",
            type="deadline",
            link=m["link"],
            opportunity_type=otype,
            opportunity_id=oid,
        ))
        created = True
    if created:
        try:
            db.commit()
        except Exception:
            logger.exception("Failed to commit deadline notifications.")
            db.rollback()


def list_notifications(db: Session, current_user) -> dict:
    student = _resolve_student(db, current_user)
    _generate_deadline_notifications(db, student.id)
    items = (
        db.query(Notification)
        .filter(Notification.student_id == student.id)
        .order_by(Notification.is_read.asc(), Notification.created_at.desc())
        .limit(50)
        .all()
    )
    unread = sum(1 for n in items if not n.is_read)
    return {"unread_count": unread, "items": items}


def unread_count(db: Session, current_user) -> dict:
    student = _resolve_student(db, current_user)
    _generate_deadline_notifications(db, student.id)
    count = (
        db.query(Notification)
        .filter(Notification.student_id == student.id, Notification.is_read.is_(False))
        .count()
    )
    return {"unread_count": count}


def mark_read(db: Session, current_user, notif_id: int) -> None:
    student = _resolve_student(db, current_user)
    n = (
        db.query(Notification)
        .filter(Notification.id == notif_id, Notification.student_id == student.id)
        .first()
    )
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()


def mark_all_read(db: Session, current_user) -> None:
    student = _resolve_student(db, current_user)
    db.query(Notification).filter(
        Notification.student_id == student.id,
        Notification.is_read.is_(False),
    ).update({Notification.is_read: True})
    db.commit()


def _recipient_query(db: Session, data):
    """Returns a list of student IDs matching the target criteria."""
    if data.target_type == "cluster":
        if not data.target_cluster_id:
            raise HTTPException(status_code=400, detail="Cluster ID is required.")
        rows = (
            db.query(ClusterMember.student_id)
            .filter(ClusterMember.cluster_id == data.target_cluster_id)
            .all()
        )
        return [row[0] for row in rows]

    q = db.query(Student.id)
    if data.target_type == "branch":
        if not data.target_branch:
            raise HTTPException(status_code=400, detail="Branch is required.")
        q = q.filter(func.lower(Student.branch) == data.target_branch.lower())
    elif data.target_type == "year":
        if not data.target_year:
            raise HTTPException(status_code=400, detail="Batch (graduation year) is required.")
        q = q.filter(Student.graduation_year == data.target_year)
    elif data.target_type == "year_branch":
        if not data.target_year or not data.target_branch:
            raise HTTPException(status_code=400, detail="Both batch and branch are required.")
        q = q.filter(
            Student.graduation_year == data.target_year,
            func.lower(Student.branch) == data.target_branch.lower(),
        )
    return [row[0] for row in q.all()]


def broadcast(db: Session, data, current_user=None) -> dict:
    student_ids = _recipient_query(db, data)
    if not student_ids:
        return {"recipients": 0, "message": "No matching students; nothing sent."}

    b = NotificationBroadcast(
        title=data.title.strip(),
        message=data.message.strip(),
        target_type=data.target_type,
        target_branch=data.target_branch,
        target_year=data.target_year,
        recipient_count=len(student_ids),
        created_by=getattr(current_user, "user_id", None),
    )
    db.add(b)
    db.flush()

    for sid in student_ids:
        db.add(Notification(
            student_id=sid,
            title=data.title.strip(),
            message=data.message.strip(),
            type="announcement",
            broadcast_id=b.id,
        ))
    db.commit()
    return {"recipients": len(student_ids),
            "message": f"Sent to {len(student_ids)} student(s)."}


def _audience_label(b: NotificationBroadcast) -> str:
    if b.target_type == "all":
        return "All students"
    if b.target_type == "branch":
        return f"{b.target_branch} (all batches)"
    if b.target_type == "year":
        return f"Batch {b.target_year}"
    if b.target_type == "year_branch":
        return f"{b.target_year} · {b.target_branch}"
    if b.target_type == "cluster":
        return f"Cluster #{b.target_cluster_id if hasattr(b, 'target_cluster_id') else '?'}"
    return b.target_type


def list_broadcasts(db: Session) -> list:
    return (
        db.query(NotificationBroadcast)
        .order_by(NotificationBroadcast.created_at.desc())
        .all()
    )


def broadcast_analytics(db: Session, broadcast_id: int) -> dict:
    b = db.query(NotificationBroadcast).filter(NotificationBroadcast.id == broadcast_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Broadcast not found.")
    delivered = (
        db.query(func.count(Notification.id))
        .filter(Notification.broadcast_id == b.id)
        .scalar()
    ) or 0
    read = (
        db.query(func.count(Notification.id))
        .filter(Notification.broadcast_id == b.id, Notification.is_read.is_(True))
        .scalar()
    ) or 0
    return {
        "id": b.id,
        "title": b.title,
        "message": b.message,
        "target_type": b.target_type,
        "target_branch": b.target_branch,
        "target_year": b.target_year,
        "audience": _audience_label(b),
        "delivered": delivered,
        "read": read,
        "unread": delivered - read,
        "created_at": b.created_at,
    }