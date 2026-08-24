from sqlalchemy import Column, Integer, String, DateTime, func
from app.database import Base


class Branch(Base):
    __tablename__ = "branches"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True)
    code = Column(String(20), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())


class Batch(Base):
    __tablename__ = "batches"
    id = Column(Integer, primary_key=True, index=True)
    graduation_year = Column(Integer, nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())