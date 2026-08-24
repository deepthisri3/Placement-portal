from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, field_validator


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    message: str
    type: str
    link: Optional[str] = None
    is_read: bool
    created_at: datetime


class NotificationListOut(BaseModel):
    unread_count: int
    items: List[NotificationOut]


class UnreadCountOut(BaseModel):
    unread_count: int


class BroadcastRequest(BaseModel):
    title: str
    message: str
    target_type: str   # all | branch | year | year_branch | cluster
    target_branch: Optional[str] = None
    target_year: Optional[int] = None
    target_cluster_id: Optional[int] = None  # ← add this line
    @field_validator("title")
    @classmethod
    def title_ok(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Title must be at least 3 characters")
        return v

    @field_validator("message")
    @classmethod
    def message_ok(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Message must be at least 3 characters")
        return v


class BroadcastResult(BaseModel):
    recipients: int
    message: str


class BroadcastHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    message: str
    target_type: str
    target_branch: Optional[str] = None
    target_year: Optional[int] = None
    recipient_count: int
    created_at: datetime


class BroadcastAnalytics(BaseModel):
    id: int
    title: str
    message: str
    target_type: str
    target_branch: Optional[str] = None
    target_year: Optional[int] = None
    audience: str          # human-readable target, e.g. "2028 · CSE"
    delivered: int
    read: int
    unread: int
    created_at: datetime