from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, ForeignKey, func
from app.database import Base
import enum


class ChangeRequestStatus(str, enum.Enum):
    PENDING  = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"


class StudentChangeRequest(Base):
    __tablename__ = "student_change_requests"

    id              = Column(Integer, primary_key=True, index=True)
    student_id      = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    field_name      = Column(String(100), nullable=False)
    field_label     = Column(String(150), nullable=False)
    current_value   = Column(Text, nullable=True)
    requested_value = Column(Text, nullable=False)
    status          = Column(Enum(ChangeRequestStatus), nullable=False, default=ChangeRequestStatus.PENDING)
    admin_note      = Column(Text, nullable=True)
    created_at      = Column(DateTime, server_default=func.now())
    reviewed_at     = Column(DateTime, nullable=True)
    reviewed_by     = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)