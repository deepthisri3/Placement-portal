from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.utils.validators import (
    graduation_year_from_register_number,
    is_current_batch,
    validate_register_number_format,
    BRANCH_CODES,
)
from app.database import get_db
from app.schemas.student import (
    StudentRegisterRequest,
    StudentOTPVerifyRequest,
    StudentResendOTPRequest,
    StudentSendOTPRequest,
    StudentLoginRequest,
    StudentOut,
)
from app.schemas.user import Token
from app.models.user import User, RoleEnum
from app.models.student import Student
from app.models.academic import Branch, Batch
from app.utils.email_generator import generate_college_email
from app.auth.hashing import hash_password, verify_password
from app.auth.jwt_handler import create_access_token
from app.services.pending_registration_store import (
    save_pending_registration,
    get_pending_registration,
    mark_pending_verified,
    delete_pending_registration,
    can_request_new_otp,
)
from app.services.otp_service import create_and_store_otp, is_otp_valid
from app.services.email_service import send_otp_email

router = APIRouter(prefix="/auth/student", tags=["Student Auth"])


def _branch_code_from_register_number(register_number: str) -> str:
    import re as _re
    normalized = validate_register_number_format(register_number)
    m = _re.match(r'^(\d{2})B01A(\d{2})([A-Z0-9]{2})$', normalized)
    bb = m.group(2) if m else ""
    return BRANCH_CODES.get(bb, "")


def _validate_branch_and_batch_allowed(db: Session, register_number: str) -> None:
    branch_name = _branch_code_from_register_number(register_number)
    grad_year = graduation_year_from_register_number(register_number)

    branch_ok = (
        db.query(Branch)
        .filter(func.lower(Branch.code) == branch_name.lower())
        .first()
    )
    if not branch_ok:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your branch ({branch_name or 'unknown'}) is not open for registration yet. "
                   "Please contact the placement cell.",
        )

    batch_ok = db.query(Batch).filter(Batch.graduation_year == grad_year).first()
    if not batch_ok:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your batch ({grad_year}) is not open for registration yet. "
                   "Please contact the placement cell.",
        )


@router.post("/send-otp", status_code=status.HTTP_200_OK)
async def send_student_otp(payload: StudentSendOTPRequest, db: Session = Depends(get_db)):
    register_number = payload.register_number.strip().upper()
    if not is_current_batch(register_number):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This batch has already graduated. Registration is no longer available.",
        )

    _validate_branch_and_batch_allowed(db, register_number)

    email = generate_college_email(register_number)
    existing_user = (
        db.query(User)
        .join(Student, Student.user_id == User.id)
        .filter(or_(User.email == email, Student.register_number == register_number))
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this register number already exists.",
        )
    student_data = payload.model_dump(exclude_none=True)
    alt_email = student_data.get("alt_email")
    if not alt_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Alternative email is required.")
    can_send, cooldown_message = can_request_new_otp(register_number)
    if not can_send:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=cooldown_message)
    save_pending_registration(
        register_number=register_number,
        password_hash="",
        email=email,
        student_data=student_data,
        alt_email=alt_email,
    )
    otp = create_and_store_otp(register_number)
    await send_otp_email(alt_email, otp)
    return {
        "message": "OTP has been sent to your alternative email.",
        "email": alt_email,
    }


@router.post("/register", status_code=status.HTTP_200_OK)
async def register_student(payload: StudentRegisterRequest, db: Session = Depends(get_db)):
    register_number = payload.register_number

    if not is_current_batch(register_number):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This batch has already graduated. Registration is no longer available.",
        )

    _validate_branch_and_batch_allowed(db, register_number)

    email = generate_college_email(register_number)
    existing_user = (
        db.query(User)
        .join(Student, Student.user_id == User.id)
        .filter(
            or_(User.email == email, Student.register_number == register_number)
        )
        .first()
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this register number already exists.",
        )
    password_hash = hash_password(payload.password)
    student_data = payload.model_dump(exclude={"password", "confirm_password"})
    alt_email = student_data.get("alt_email")
    if not alt_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Alternative email is required.")
    existing_pending = get_pending_registration(register_number)
    if existing_pending is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please verify your alternative email before completing registration.",
        )
    if not existing_pending.get("verified"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alternative email not verified. Please verify the OTP sent to your alternative email.",
        )
    if existing_pending.get("alt_email") != alt_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alternative email does not match the verified email. Please reverify.",
        )
    existing_pending["password_hash"] = password_hash
    existing_pending["student_data"] = student_data
    existing_pending["alt_email"] = alt_email

    new_user = User(
        email=existing_pending["email"],
        password_hash=existing_pending["password_hash"],
        role=RoleEnum.student,
    )
    db.add(new_user)
    db.flush()

    student_data = dict(existing_pending["student_data"])
    student_data["graduation_year"] = graduation_year_from_register_number(register_number)
    student_data["alt_email"] = existing_pending.get("alt_email")

    new_student = Student(
        user_id=new_user.id,
        **student_data,
    )
    db.add(new_student)
    db.commit()
    db.refresh(new_user)
    db.refresh(new_student)

    delete_pending_registration(register_number)

    return StudentOut(
        id=new_student.id,
        full_name=new_student.full_name,
        register_number=new_student.register_number,
        phone=new_student.phone,
        email=new_user.email,
        role=new_user.role.value,
    )


@router.post("/resend-otp", status_code=status.HTTP_200_OK)
async def resend_student_otp(payload: StudentResendOTPRequest):
    register_number = payload.register_number.strip().upper()
    entry = get_pending_registration(register_number)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending registration found for this register number.",
        )
    can_send, cooldown_message = can_request_new_otp(register_number)
    if not can_send:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=cooldown_message)
    alt_email = entry.get("alt_email")
    if not alt_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Alternative email is required.")
    otp = create_and_store_otp(register_number)
    await send_otp_email(alt_email, otp)
    return {
        "message": "OTP resent to your alternative email.",
        "email": alt_email,
    }


@router.post("/verify-otp", status_code=status.HTTP_200_OK)
def verify_student_otp(payload: StudentOTPVerifyRequest):
    register_number = payload.register_number.strip().upper()
    valid, error_message = is_otp_valid(register_number, payload.otp)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message,
        )
    mark_pending_verified(register_number)
    entry = get_pending_registration(register_number)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pending registration not found. Please request a new OTP.",
        )
    return {"message": "Alternative email verified successfully."}


@router.post("/login", response_model=Token)
def login_student(payload: StudentLoginRequest, db: Session = Depends(get_db)):
    register_number = payload.register_number.strip().upper()
    student = (
        db.query(Student)
        .filter(Student.register_number == register_number)
        .first()
    )
    invalid_credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid register number or password.",
    )
    if student is None:
        raise invalid_credentials_error
    user = db.query(User).filter(User.id == student.user_id).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise invalid_credentials_error
    access_token = create_access_token(user_id=user.id, role=user.role.value)
    return Token(access_token=access_token, role=user.role.value)