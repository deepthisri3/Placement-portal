from pydantic import BaseModel, field_validator
from typing import List, Optional
from datetime import datetime


class ClusterCreate(BaseModel):
    name: str
    student_ids: List[int]

    @field_validator("name")
    @classmethod
    def name_ok(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Cluster name must be at least 2 characters.")
        return v

    @field_validator("student_ids")
    @classmethod
    def ids_ok(cls, v: List[int]) -> List[int]:
        if len(v) == 0:
            raise ValueError("A cluster must have at least one student.")
        return v


class ClusterUpdate(BaseModel):
    name: str
    student_ids: List[int]

    @field_validator("name")
    @classmethod
    def name_ok(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Cluster name must be at least 2 characters.")
        return v


class ClusterMemberOut(BaseModel):
    id: int
    register_number: str
    full_name: Optional[str] = None
    branch: Optional[str] = None
    email: Optional[str] = None

    class Config:
        from_attributes = True


class ClusterOut(BaseModel):
    id: int
    name: str
    member_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class ClusterDetailOut(BaseModel):
    id: int
    name: str
    created_at: datetime
    members: List[ClusterMemberOut] = []

    class Config:
        from_attributes = True