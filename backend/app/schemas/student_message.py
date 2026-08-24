from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, field_validator


class AdminRecipient(BaseModel):
    """One entry in the 'To:' dropdown — admins the student can message."""
    id: int
    full_name: Optional[str] = None
    email: str
    role: str


class MessageSend(BaseModel):
    admin_id: int
    subject: str
    message: str

    @field_validator("subject")
    @classmethod
    def subject_ok(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Subject must be at least 3 characters.")
        if len(v) > 255:
            raise ValueError("Subject is too long (max 255 characters).")
        return v

    @field_validator("message")
    @classmethod
    def message_ok(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 5:
            raise ValueError("Message must be at least 5 characters.")
        if len(v) > 5000:
            raise ValueError("Message is too long (max 5000 characters).")
        return v


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:           int
    student_id:   int
    admin_id:     Optional[int] = None
    subject:      str
    message:      str
    status:       str
    created_at:   datetime
    read_at:      Optional[datetime] = None
    # Joined fields
    student_name:     Optional[str] = None
    register_number:  Optional[str] = None
    admin_name:       Optional[str] = None


class AdminMessagesOut(BaseModel):
    unread_count: int
    messages:     List[MessageOut]