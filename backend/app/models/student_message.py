from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from app.database import Base


class StudentMessage(Base):
    """
    A message sent from a student to a specific admin.
    Deliberately separate from the Notification table — notifications flow
    admin → student (broadcast), messages flow student → admin (direct).
    """
    __tablename__ = "student_messages"

    id         = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    admin_id   = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"),
                        nullable=True, index=True)   # nullable so rows survive admin deletion
    subject    = Column(String(255), nullable=False)
    message    = Column(Text, nullable=False)
    # 'unread' | 'read'
    status     = Column(String(20), nullable=False, default="unread")
    created_at = Column(DateTime, server_default=func.now())
    read_at    = Column(DateTime, nullable=True)