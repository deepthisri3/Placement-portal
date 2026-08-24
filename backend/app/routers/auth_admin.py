

from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.models.user import User, RoleEnum
from app.auth.hashing import verify_password
from app.auth.jwt_handler import create_access_token
from app.schemas.user import Token

router = APIRouter(prefix="/auth/admin", tags=["Admin Auth"])


class AdminLoginRequest(BaseModel):
    """
    Admin-specific login schema — deliberately separate from
    StudentLoginRequest since admins log in with email, not a register
    number, and there's no admin registration flow to share fields with.
    """
    email: EmailStr
    password: str


@router.post("/login", response_model=Token)
def login_admin(payload: AdminLoginRequest, db: Session = Depends(get_db)):
    """
    Admin (and Super Admin) logs in with email + password here — both
    roles share this one endpoint since they authenticate the same way.
    There's still no /register endpoint: regular admins only ever reach
    the system via a Super Admin's invitation (see admin_management.py);
    the Super Admin account itself is inserted directly into MySQL.
    """
    user = db.query(User).filter(User.email == payload.email).first()

    invalid_credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
    )

    if user is None or user.role not in (RoleEnum.admin, RoleEnum.super_admin):
        # Same vague message even if the email belongs to a *student*
        # account — we don't want this endpoint leaking who has which role.
        raise invalid_credentials_error

    if user.password_hash is None:
        # A genuinely invited-but-not-yet-activated account. Safe to be
        # specific here (unlike the generic message above) since this
        # only happens for an account that provably exists and was
        # legitimately invited — there's no enumeration risk in telling
        # them what to do next.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please set your password using the invitation link sent to your email before logging in.",
        )

    if not verify_password(payload.password, user.password_hash):
        raise invalid_credentials_error

    access_token = create_access_token(user_id=user.id, role=user.role.value)
    return Token(access_token=access_token, role=user.role.value)