from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.database import get_db
from app.dependencies.auth_dependency import require_roles, get_current_user, CurrentUser
from app.models.academic import Branch, Batch
from app.schemas.academic import BranchCreate, BranchOut, BatchCreate, BatchOut

router = APIRouter(prefix="/academic", tags=["Branches & Batches"])

ADMIN = require_roles("admin", "super_admin")


# ---------- Branches ----------
@router.get("/branches", response_model=List[BranchOut])
def list_branches(db: Session = Depends(get_db)):
    """Read-only access to branches is allowed without login for registration validation."""
    return db.query(Branch).order_by(Branch.name.asc()).all()


@router.post("/branches", response_model=BranchOut, status_code=status.HTTP_201_CREATED)
def add_branch(payload: BranchCreate, db: Session = Depends(get_db), _user: CurrentUser = Depends(ADMIN)):
    # Duplicate check (case-insensitive) on both name and code.
    existing = (
        db.query(Branch)
        .filter(or_ci(Branch.name, payload.name) | or_ci(Branch.code, payload.code))
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="A branch with this name or code already exists.")
    branch = Branch(name=payload.name, code=payload.code)
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


@router.delete("/branches/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_branch(branch_id: int, db: Session = Depends(get_db), _user: CurrentUser = Depends(ADMIN)):
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found.")
    db.delete(branch)
    db.commit()
    return None


# ---------- Batches ----------
@router.get("/batches", response_model=List[BatchOut])
def list_batches(db: Session = Depends(get_db)):
    return db.query(Batch).order_by(Batch.graduation_year.desc()).all()


@router.post("/batches", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
def add_batch(payload: BatchCreate, db: Session = Depends(get_db), _user: CurrentUser = Depends(ADMIN)):
    existing = db.query(Batch).filter(Batch.graduation_year == payload.graduation_year).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="This batch already exists.")
    batch = Batch(graduation_year=payload.graduation_year)
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


@router.delete("/batches/{batch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_batch(batch_id: int, db: Session = Depends(get_db), _user: CurrentUser = Depends(ADMIN)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")
    db.delete(batch)
    db.commit()
    return None


def or_ci(column, value):
    """Case-insensitive equality helper for the duplicate check."""
    return func.lower(column) == str(value).strip().lower()