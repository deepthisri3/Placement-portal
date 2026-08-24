import os
import mimetypes
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from fastapi import UploadFile, File
from app.services import cgpa_upload_service
from app.schemas.student import StudentPlacementStatusOut
from app.services import student_placement_service
from app.dependencies.auth_dependency import require_roles
from app.schemas.student import StudentDetailsUpdate, StudentDetailsOut
from app.database import get_db
from app.models.student import Student
from app.models.user import User
from app.schemas.student import StudentProfileUpdate, StudentProfileOut
from app.dependencies.auth_dependency import require_role, require_roles, CurrentUser
from sqlalchemy import text
from app.schemas.admin_student import AdminStudentProfileOut, StudentApplicationItem
from pydantic import BaseModel
from app.schemas.admin_student import AdminStudentProfileOut, StudentApplicationItem, AdminStudentFullProfileOut, AdminStudentPlacement

class AdminCgpaUpdate(BaseModel):
    cgpa: float
class StudentSearchResult(BaseModel):
    id: int
    register_number: str
    full_name: str | None = None
    email: str | None = None
    branch: str | None = None
    cgpa: float | None = None

router = APIRouter(prefix="/students", tags=["Student Profile"])

RESUME_DIR = "uploads/resumes"
MAX_RESUME_SIZE_MB = 2
PHOTO_DIR = "uploads/photos"
MAX_PHOTO_SIZE_MB = 5


def _get_student_and_user(db: Session, current_user: CurrentUser) -> tuple[Student, User]:
    """
    Same user_id -> Student mapping pattern used in opportunities.py —
    the JWT only carries user_id, but profile fields live on the Student
    row. Also fetches the User row since email lives there, not on Student.
    """
    student = db.query(Student).filter(Student.user_id == current_user.user_id).first()
    if student is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student profile not found.")
    user = db.query(User).filter(User.id == current_user.user_id).first()
    return student, user


def _build_profile_out(student: Student, user: User) -> StudentProfileOut:
    return StudentProfileOut(
        id=student.id,
        full_name=student.full_name,
        last_name=student.last_name,
        register_number=student.register_number,
        phone=student.phone,
        email=user.email,
        date_of_birth=student.date_of_birth,
        alt_email=student.alt_email,
        category=student.category,
        course=student.course,
        batch=student.batch,
        branch=student.branch,
        section=student.section,
        cgpa=float(student.cgpa) if student.cgpa is not None else None,
        skills=student.skills,
        graduation_year=student.graduation_year,
        resume_filename=student.resume_filename,
        father_name=student.father_name,
        father_occupation=student.father_occupation,
        mother_name=student.mother_name,
        mother_maiden_name=student.mother_maiden_name,
        parent_mobile_no=student.parent_mobile_no,
        address_for_communication=student.address_for_communication,
        hometown=student.hometown,
        district=student.district,
        state=student.state,
        pincode=student.pincode,
        stay_type=student.stay_type,
        aadhar_no=student.aadhar_no,
        name_as_per_aadhar=student.name_as_per_aadhar,
        pan_number=student.pan_number,
        ssc_school_name=student.ssc_school_name,
        ssc_board=student.ssc_board,
        ssc_year_of_passing=student.ssc_year_of_passing,
        ssc_marks_obtained=float(student.ssc_marks_obtained) if student.ssc_marks_obtained is not None else None,
        ssc_maximum_marks=float(student.ssc_maximum_marks) if student.ssc_maximum_marks is not None else None,
        ssc_percentage=float(student.ssc_percentage) if student.ssc_percentage is not None else None,
        intermediate_course_type=student.intermediate_course_type,
        intermediate_college_name=student.intermediate_college_name,
        intermediate_board=student.intermediate_board,
        intermediate_year_of_passing=student.intermediate_year_of_passing,
        intermediate_marks_obtained=float(student.intermediate_marks_obtained) if student.intermediate_marks_obtained is not None else None,
        intermediate_maximum_marks=float(student.intermediate_maximum_marks) if student.intermediate_maximum_marks is not None else None,
        intermediate_percentage=float(student.intermediate_percentage) if student.intermediate_percentage is not None else None,
        entrance_exam=student.entrance_exam,
        entrance_rank=student.entrance_rank,
        seat_status=student.seat_status,
        education_gap_years=student.education_gap_years,
        education_gap_reason=student.education_gap_reason,
        foreign_languages_known=student.foreign_languages_known,
        photo_filename=student.photo_filename,
    )


def _calc_percentage(marks, maximum_marks):
    if marks is None or maximum_marks in (None, 0):
        return None
    return round((float(marks) / float(maximum_marks)) * 100, 2)


def _calc_education_gap_years(ssc_year_of_passing, intermediate_year_of_passing):
    if ssc_year_of_passing is None or intermediate_year_of_passing is None:
        return None
    gap = int(intermediate_year_of_passing) - int(ssc_year_of_passing) - 2
    return max(gap, 0)


@router.get("/me/profile", response_model=StudentProfileOut)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("student")),
):
    student, user = _get_student_and_user(db, current_user)
    return _build_profile_out(student, user)


@router.put("/me/profile", response_model=StudentProfileOut)
def update_my_profile(
    payload: StudentProfileUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("student")),
):
    """
    Partial update — only fields the student actually submitted get
    changed. Using `is not None` (not just checking truthiness) means a
    student can't accidentally wipe their branch by submitting an empty
    string; they'd need to explicitly send null for that, which the
    frontend form never does.
    """
    student, user = _get_student_and_user(db, current_user)

    if payload.branch is not None:
        student.branch = payload.branch
    
    if payload.skills is not None:
        student.skills = payload.skills

    db.commit()
    db.refresh(student)
    return _build_profile_out(student, user)


@router.post("/me/resume", response_model=StudentProfileOut)
async def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("student")),
):
    student, user = _get_student_and_user(db, current_user)

    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resume must be a PDF file.",
        )

    contents = await file.read()
    if len(contents) > MAX_RESUME_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Resume must be smaller than {MAX_RESUME_SIZE_MB}MB.",
        )

    os.makedirs(RESUME_DIR, exist_ok=True)
    # Fixed filename per student (not the original uploaded filename) —
    # this is exactly what makes a new upload overwrite the old resume
    # instead of accumulating multiple versions on disk.
    filename = f"resume_{student.id}.pdf"
    filepath = os.path.join(RESUME_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    student.resume_filename = filename
    db.commit()
    db.refresh(student)
    return _build_profile_out(student, user)


@router.get("/me/resume")
def download_my_resume(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("student")),
):
    """
    Authenticated download — deliberately not a public static file URL.
    Only the logged-in student (via their own JWT) can ever reach their
    own resume; there's no guessable /uploads/resumes/resume_7.pdf path
    exposed to the outside world.
    """
    student, _ = _get_student_and_user(db, current_user)
    if not student.resume_filename:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No resume uploaded yet.")

    filepath = os.path.join(RESUME_DIR, student.resume_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume file not found on server.")

    return FileResponse(filepath, media_type="application/pdf", filename=student.resume_filename)


@router.post("/me/photo", response_model=StudentProfileOut)
async def upload_photo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("student")),
):
    student, user = _get_student_and_user(db, current_user)

    allowed = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Photo must be a JPG/PNG/WEBP image.")

    contents = await file.read()
    if len(contents) > MAX_PHOTO_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Photo must be smaller than {MAX_PHOTO_SIZE_MB}MB.")

    os.makedirs(PHOTO_DIR, exist_ok=True)
    # Preserve extension if given, otherwise derive from content_type
    _, ext = os.path.splitext(file.filename or "")
    if not ext:
        ext = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
        }.get(file.content_type, "")
    filename = f"photo_{student.id}{ext}"
    filepath = os.path.join(PHOTO_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    student.photo_filename = filename
    db.commit()
    db.refresh(student)
    return _build_profile_out(student, user)


@router.get("/me/photo")
def download_my_photo(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("student")),
):
    student, _ = _get_student_and_user(db, current_user)
    if not student.photo_filename:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile photo uploaded yet.")

    filepath = os.path.join(PHOTO_DIR, student.photo_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Photo file not found on server.")

    mime, _ = mimetypes.guess_type(filepath)
    return FileResponse(filepath, media_type=mime or "application/octet-stream", filename=student.photo_filename)
# ---------------------------------------------------------------------------
# Admin: student lookup + resume access (admin / super_admin only)
# ---------------------------------------------------------------------------
ADMIN = require_roles("admin", "super_admin")
@router.get("/search", response_model=list[StudentSearchResult])
def admin_search_students(
    q: str,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(ADMIN),
):
    """
    One intelligent type-ahead search. Matches q (case-insensitive,
    partial) across: full_name, register_number, email, phone, cgpa,
    and placed-company name (via placement_records). De-duplicated,
    capped at 10 results.
    """
    from sqlalchemy import func, or_, cast, String
    from app.models.placement_record import PlacementRecord
    from app.models.company import Company

    term = (q or "").strip()
    if len(term) < 1:
        return []
    like = f"%{term.lower()}%"

    # Register numbers of students placed at a company matching the term.
    placed_rolls = (
        db.query(PlacementRecord.roll_number)
        .join(Company, Company.id == PlacementRecord.company_id)
        .filter(func.lower(Company.name).like(like))
        .distinct()
        .all()
    )
    placed_roll_set = [r[0] for r in placed_rolls]

    query = (
        db.query(Student, User.email)
        .outerjoin(User, User.id == Student.user_id)
    )

    conditions = [
        func.lower(Student.full_name).like(like),
        func.lower(Student.register_number).like(like),
        func.lower(User.email).like(like),
        Student.phone.like(f"%{term}%"),
        cast(Student.cgpa, String).like(f"%{term}%"),
    ]
    if placed_roll_set:
        conditions.append(Student.register_number.in_(placed_roll_set))

    rows = (
        query.filter(or_(*conditions))
        .order_by(Student.full_name.asc())
        .limit(10)
        .all()
    )

    results = []
    seen = set()
    for student, email in rows:
        if student.id in seen:
            continue
        seen.add(student.id)
        results.append(StudentSearchResult(
            id=student.id,
            register_number=student.register_number,
            full_name=student.full_name,
            email=email,
            branch=student.branch,
            cgpa=float(student.cgpa) if student.cgpa is not None else None,
        ))
    return results

def _admin_get_student(db: Session, register_number: str) -> Student:
    rn = register_number.strip()
    student = (
        db.query(Student)
        .filter(Student.register_number == rn)
        .first()
    )
    if student is None:
        # fall back to case-insensitive match
        from sqlalchemy import func
        student = (
            db.query(Student)
            .filter(func.lower(Student.register_number) == rn.lower())
            .first()
        )
    if student is None:
        raise HTTPException(status_code=404, detail="No student found with that register number.")
    return student


def _student_applications(db: Session, student_id: int) -> list:
    """Read the student's applications defensively (schema-name tolerant)."""
    items = []
    try:
        rows = db.execute(text("""
            SELECT a.on_campus_opportunity_id  AS on_id,
                   a.off_campus_opportunity_id AS off_id,
                   onc.company_name            AS on_label,
                   offc.title                  AS off_label
            FROM applications a
            LEFT JOIN on_campus_opportunities  onc  ON onc.id  = a.on_campus_opportunity_id
            LEFT JOIN off_campus_opportunities offc ON offc.id = a.off_campus_opportunity_id
            WHERE a.student_id = :sid
        """), {"sid": student_id}).fetchall()
        for r in rows:
            m = r._mapping
            if m["on_id"] is not None:
                items.append({"opportunity_type": "on_campus",
                              "opportunity_id": m["on_id"],
                              "company_or_title": m["on_label"]})
            elif m["off_id"] is not None:
                items.append({"opportunity_type": "off_campus",
                              "opportunity_id": m["off_id"],
                              "company_or_title": m["off_label"]})
    except Exception:
        pass  # if the applications schema differs, just return an empty list
    return items


@router.get("/by-register/{register_number}/profile", response_model=AdminStudentProfileOut)
def admin_get_student_profile(
    register_number: str,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(ADMIN),
):
    student = _admin_get_student(db, register_number)
    user = db.query(User).filter(User.id == student.user_id).first()
    return AdminStudentProfileOut(
        id=student.id,
        full_name=student.full_name,
        register_number=student.register_number,
        phone=student.phone,
        email=user.email if user else None,
        branch=student.branch,
        cgpa=float(student.cgpa) if student.cgpa is not None else None,
        skills=student.skills,
        has_resume=bool(student.resume_filename),
        resume_filename=student.resume_filename,
        applications=[StudentApplicationItem(**a) for a in _student_applications(db, student.id)],
    )
@router.get("/by-register/{register_number}/full-profile", response_model=AdminStudentFullProfileOut)
def admin_get_student_full_profile(
    register_number: str,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(ADMIN),
):
    """Complete read-only student profile for the admin's dedicated view."""
    student = _admin_get_student(db, register_number)
    user = db.query(User).filter(User.id == student.user_id).first()

    # Placement status via the same service the student uses.
    status_data = student_placement_service.get_placement_status(db, student.register_number)
    placement = AdminStudentPlacement(
        is_placed=status_data.is_placed if hasattr(status_data, "is_placed") else status_data["is_placed"],
        total_offers=status_data.total_offers if hasattr(status_data, "total_offers") else status_data["total_offers"],
        highest_package=(status_data.highest_package if hasattr(status_data, "highest_package") else status_data.get("highest_package")),
    )

    def num(v):
        return float(v) if v is not None else None

    return AdminStudentFullProfileOut(
        id=student.id,
        full_name=student.full_name,
        last_name=student.last_name,
        register_number=student.register_number,
        phone=student.phone,
        email=user.email if user else None,
        date_of_birth=student.date_of_birth,
        alt_email=student.alt_email,
        category=student.category,
        course=student.course,
        batch=student.batch,
        branch=student.branch,
        section=student.section,
        cgpa=num(student.cgpa),
        skills=student.skills,
        graduation_year=student.graduation_year,
        resume_filename=student.resume_filename,
        photo_filename=student.photo_filename,
        has_resume=bool(student.resume_filename),
        father_name=student.father_name,
        father_occupation=student.father_occupation,
        mother_name=student.mother_name,
        mother_maiden_name=student.mother_maiden_name,
        parent_mobile_no=student.parent_mobile_no,
        address_for_communication=student.address_for_communication,
        hometown=student.hometown,
        district=student.district,
        state=student.state,
        pincode=student.pincode,
        stay_type=student.stay_type,
        aadhar_no=student.aadhar_no,
        name_as_per_aadhar=student.name_as_per_aadhar,
        pan_number=student.pan_number,
        ssc_school_name=student.ssc_school_name,
        ssc_board=student.ssc_board,
        ssc_year_of_passing=student.ssc_year_of_passing,
        ssc_marks_obtained=num(student.ssc_marks_obtained),
        ssc_maximum_marks=num(student.ssc_maximum_marks),
        ssc_percentage=num(student.ssc_percentage),
        intermediate_course_type=student.intermediate_course_type,
        intermediate_college_name=student.intermediate_college_name,
        intermediate_board=student.intermediate_board,
        intermediate_year_of_passing=student.intermediate_year_of_passing,
        intermediate_marks_obtained=num(student.intermediate_marks_obtained),
        intermediate_maximum_marks=num(student.intermediate_maximum_marks),
        intermediate_percentage=num(student.intermediate_percentage),
        entrance_exam=student.entrance_exam,
        entrance_rank=student.entrance_rank,
        seat_status=student.seat_status,
        education_gap_years=student.education_gap_years,
        education_gap_reason=student.education_gap_reason,
        foreign_languages_known=student.foreign_languages_known,
        placement=placement,
        applications=[StudentApplicationItem(**a) for a in _student_applications(db, student.id)],
    )

def _admin_resume_path(db: Session, student_id: int) -> tuple[Student, str]:
    student = db.query(Student).filter(Student.id == student_id).first()
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found.")
    if not student.resume_filename:
        raise HTTPException(status_code=404, detail="This student has no resume uploaded.")
    filepath = os.path.join(RESUME_DIR, student.resume_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Resume file not found on server.")
    return student, filepath


@router.get("/{student_id}/resume/view")
def admin_view_resume(
    student_id: int,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(ADMIN),
):
    """Open the resume inline in the browser."""
    student, filepath = _admin_resume_path(db, student_id)
    from fastapi.responses import Response
    with open(filepath, "rb") as f:
        data = f.read()
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{student.register_number}-RESUME.pdf"'},
    )


@router.get("/{student_id}/resume/download")
def admin_download_resume(
    student_id: int,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(ADMIN),
):
    """Force download named {register_number}-RESUME.pdf."""
    student, filepath = _admin_resume_path(db, student_id)
    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=f"{student.register_number}-RESUME.pdf",
    )
@router.put("/{student_id}/admin-edit", response_model=StudentProfileOut)
def admin_edit_student(
    student_id: int,
    payload: StudentDetailsUpdate,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(ADMIN),
):
    """Admin edits any student's profile. All same fields as student self-edit."""
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    data = payload.model_dump(exclude_unset=True)

    if "full_name" in data or "last_name" in data:
        first_name = data.get("full_name", student.full_name or "")
        last_name  = data.get("last_name",  student.last_name  or "")
        student.full_name = " ".join(p for p in [first_name, last_name] if p).strip()
    if "last_name" in data:
        student.last_name = data["last_name"]

    ssc_marks = data.get("ssc_marks_obtained", student.ssc_marks_obtained)
    ssc_max   = data.get("ssc_maximum_marks",  student.ssc_maximum_marks)
    if ssc_marks is not None and ssc_max is not None:
        data["ssc_percentage"] = _calc_percentage(ssc_marks, ssc_max)

    inter_marks = data.get("intermediate_marks_obtained", student.intermediate_marks_obtained)
    inter_max   = data.get("intermediate_maximum_marks",  student.intermediate_maximum_marks)
    if inter_marks is not None and inter_max is not None:
        data["intermediate_percentage"] = _calc_percentage(inter_marks, inter_max)

    if "ssc_year_of_passing" in data or "intermediate_year_of_passing" in data:
        data["education_gap_years"] = _calc_education_gap_years(
            data.get("ssc_year_of_passing",         student.ssc_year_of_passing),
            data.get("intermediate_year_of_passing", student.intermediate_year_of_passing),
        )

    for field, value in data.items():
        if field in {"full_name", "last_name"}:
            continue
        if hasattr(student, field):
            setattr(student, field, value)

    db.commit()
    db.refresh(student)
    user = db.query(User).filter(User.id == student.user_id).first()
    return _build_profile_out(student, user)
@router.put("/by-register/{register_number}/cgpa", response_model=AdminStudentProfileOut)
def admin_update_cgpa(
    register_number: str,
    payload: AdminCgpaUpdate,
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(ADMIN),
):
    if payload.cgpa < 0 or payload.cgpa > 10:
        raise HTTPException(status_code=400, detail="CGPA must be between 0 and 10.")

    student = _admin_get_student(db, register_number)
    student.cgpa = payload.cgpa
    db.commit()

    # return the refreshed admin profile (reuses the search endpoint's builder)
    return admin_get_student_profile(register_number, db, _user)
@router.post("/cgpa/upload")
async def admin_upload_cgpa(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(ADMIN),
):
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB).")
    rows = cgpa_upload_service.parse_file(file.filename, content)
    return cgpa_upload_service.bulk_update_cgpa(db, rows)
@router.get("/me/placement-status", response_model=StudentPlacementStatusOut)
def my_placement_status(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("student")),
):
    student = db.query(Student).filter(Student.user_id == current_user.user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    return student_placement_service.get_placement_status(db, student.register_number)

@router.get("/graduation-years")
def list_graduation_years(
    db: Session = Depends(get_db),
    _user: CurrentUser = Depends(require_roles("admin", "super_admin")),
):
    """Distinct graduation years present among current students, newest first."""
    rows = (
        db.query(Student.graduation_year)
        .filter(Student.graduation_year.isnot(None))
        .distinct()
        .order_by(Student.graduation_year.desc())
        .all()
    )
    return [r[0] for r in rows]
@router.get("/me/details", response_model=StudentDetailsOut)
def get_my_details(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("student")),
):
    student = db.query(Student).filter(Student.user_id == current_user.user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")
    user = db.query(User).filter(User.id == student.user_id).first()
    data = StudentDetailsOut.model_validate(student).model_dump()
    data["email"] = user.email if user else None
    return data


@router.put("/me/details", response_model=StudentDetailsOut)
def update_my_details(
    payload: StudentDetailsUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_role("student")),
):
    student = db.query(Student).filter(Student.user_id == current_user.user_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    data = payload.model_dump(exclude_unset=True)

    if "full_name" in data or "last_name" in data:
        first_name = data.get("full_name", student.full_name or "")
        last_name = data.get("last_name", student.last_name or "")
        student.full_name = " ".join(part for part in [first_name, last_name] if part).strip()

    student.last_name = data.get("last_name", student.last_name)

    ssc_marks = data.get("ssc_marks_obtained", student.ssc_marks_obtained)
    ssc_maximum = data.get("ssc_maximum_marks", student.ssc_maximum_marks)
    if ssc_marks is not None and ssc_maximum is not None:
        data["ssc_percentage"] = _calc_percentage(ssc_marks, ssc_maximum)

    inter_marks = data.get("intermediate_marks_obtained", student.intermediate_marks_obtained)
    inter_maximum = data.get("intermediate_maximum_marks", student.intermediate_maximum_marks)
    if inter_marks is not None and inter_maximum is not None:
        data["intermediate_percentage"] = _calc_percentage(inter_marks, inter_maximum)

    if "ssc_year_of_passing" in data or "intermediate_year_of_passing" in data:
        data["education_gap_years"] = _calc_education_gap_years(
            data.get("ssc_year_of_passing", student.ssc_year_of_passing),
            data.get("intermediate_year_of_passing", student.intermediate_year_of_passing),
        )

    # Apply only the fields the student actually sent.
    for field, value in data.items():
        if field in {"full_name", "last_name"}:
            continue
        setattr(student, field, value)
    db.commit()
    db.refresh(student)

    user = db.query(User).filter(User.id == student.user_id).first()
    data = StudentDetailsOut.model_validate(student).model_dump()
    data["email"] = user.email if user else None
    return data