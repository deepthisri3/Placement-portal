"""
Change-request schemas.

The single source of truth for "what can a student ask to have corrected"
is FIELD_REGISTRY below. Each entry carries the column name, a human label,
a UI group, an input kind and (where relevant) the allowed choices.

Everything else — the /fields endpoint, submit-time validation, and the
type coercion applied when an admin accepts — is derived from this registry,
so adding a new reportable field is a one-line change here.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field as dc_field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, field_validator

# ── Option sets (mirrored from StudentRegister / StudentDetails) ─────────────

CATEGORY_OPTIONS = ["OC", "BC-A", "BC-B", "BC-C", "BC-D", "SC", "ST"]
STAY_TYPE_OPTIONS = ["Day Scholar", "Hosteler"]
SSC_BOARD_OPTIONS = ["State Board", "CBSE", "ICSE", "Other"]
INTER_BOARD_OPTIONS = ["Board of Intermediate Education, AP", "State Board", "CBSE", "Other"]
INTER_COURSE_TYPES = ["Intermediate", "Diploma"]
ENTRANCE_EXAMS = ["AP EAPCET", "AP ECET", "AP ICET", "JEE Main", "Other"]
SEAT_STATUS_OPTIONS = ["Management", "Counselling", "NRI", "Other"]


# ── Field registry ───────────────────────────────────────────────────────────

@dataclass(frozen=True)
class FieldSpec:
    name: str
    label: str
    group: str
    kind: str = "text"          # text | textarea | email | phone | date | int | decimal | select
    target: str = "student"     # which table the value ultimately lands on: student | user
    choices: List[str] = dc_field(default_factory=list)
    max_len: Optional[int] = None
    help: str = ""


_SPECS: List[FieldSpec] = [
    # Personal
    FieldSpec("full_name", "Full Name", "Personal", max_len=255),
    FieldSpec("last_name", "Last Name", "Personal", max_len=255),
    FieldSpec("date_of_birth", "Date of Birth", "Personal", kind="date"),
    FieldSpec("category", "Category", "Personal", kind="select", choices=CATEGORY_OPTIONS),
    FieldSpec("phone", "Mobile Number", "Personal", kind="phone", max_len=15),
    FieldSpec("email", "Login Email", "Personal", kind="email", target="user", max_len=255,
              help="This is the email you sign in with."),
    FieldSpec("alt_email", "Alternative Email", "Personal", kind="email", max_len=100),

    # Academic
    FieldSpec("course", "Course", "Academic", max_len=50, help="e.g. B.Tech"),
    FieldSpec("branch", "Branch", "Academic", max_len=100),
    FieldSpec("batch", "Batch", "Academic", max_len=20, help="e.g. 2024-2028"),
    FieldSpec("section", "Section", "Academic", max_len=20),

    # Family
    FieldSpec("father_name", "Father's Name", "Family", max_len=100),
    FieldSpec("father_occupation", "Father's Occupation", "Family", max_len=100),
    FieldSpec("mother_name", "Mother's Name", "Family", max_len=100),
    FieldSpec("mother_maiden_name", "Mother's Maiden Name", "Family", max_len=100),
    FieldSpec("parent_mobile_no", "Parent's Mobile Number", "Family", kind="phone", max_len=15),

    # Address
    FieldSpec("address_for_communication", "Address for Communication", "Address", kind="textarea"),
    FieldSpec("hometown", "Hometown", "Address", max_len=100),
    FieldSpec("district", "District", "Address", max_len=100),
    FieldSpec("state", "State", "Address", max_len=100),
    FieldSpec("pincode", "Pincode", "Address", max_len=10),
    FieldSpec("stay_type", "Hostel / Day Scholar", "Address", kind="select", choices=STAY_TYPE_OPTIONS),

    # Identity
    FieldSpec("aadhar_no", "Aadhar Number", "Identity", max_len=20),
    FieldSpec("name_as_per_aadhar", "Name as per Aadhar", "Identity", max_len=100),
    FieldSpec("pan_number", "PAN Number", "Identity", max_len=20),

    # SSC
    FieldSpec("ssc_school_name", "SSC School Name", "SSC", max_len=255),
    FieldSpec("ssc_board", "SSC Board", "SSC", kind="select", choices=SSC_BOARD_OPTIONS),
    FieldSpec("ssc_year_of_passing", "SSC Year of Passing", "SSC", kind="int"),
    FieldSpec("ssc_marks_obtained", "SSC Marks Obtained", "SSC", kind="decimal"),
    FieldSpec("ssc_maximum_marks", "SSC Maximum Marks", "SSC", kind="decimal"),

    # Intermediate / Diploma
    FieldSpec("intermediate_course_type", "Intermediate Course Type", "Intermediate",
              kind="select", choices=INTER_COURSE_TYPES),
    FieldSpec("intermediate_college_name", "Intermediate College Name", "Intermediate", max_len=255),
    FieldSpec("intermediate_board", "Intermediate Board", "Intermediate",
              kind="select", choices=INTER_BOARD_OPTIONS),
    FieldSpec("intermediate_year_of_passing", "Intermediate Year of Passing", "Intermediate", kind="int"),
    FieldSpec("intermediate_marks_obtained", "Intermediate Marks Obtained", "Intermediate", kind="decimal"),
    FieldSpec("intermediate_maximum_marks", "Intermediate Maximum Marks", "Intermediate", kind="decimal"),

    # Entrance & skills
    FieldSpec("entrance_exam", "Entrance Exam", "Entrance & Skills",
              kind="select", choices=ENTRANCE_EXAMS),
    FieldSpec("entrance_rank", "Entrance Rank", "Entrance & Skills", kind="int"),
    FieldSpec("seat_status", "Seat Status", "Entrance & Skills",
              kind="select", choices=SEAT_STATUS_OPTIONS),
    FieldSpec("foreign_languages_known", "Foreign Languages Known", "Entrance & Skills", kind="textarea"),
    FieldSpec("skills", "Skills", "Entrance & Skills", kind="textarea"),
]

FIELD_REGISTRY: dict[str, FieldSpec] = {s.name: s for s in _SPECS}

# Kept for backwards compatibility with any code still importing the old name.
EDITABLE_FIELDS: dict[str, str] = {s.name: s.label for s in _SPECS}

# Percentage columns are derived, never reported directly. When the marks or
# maximum-marks behind one of them changes, the service recomputes it.
DERIVED_PERCENTAGES: dict[str, tuple[str, str]] = {
    "ssc_percentage": ("ssc_marks_obtained", "ssc_maximum_marks"),
    "intermediate_percentage": ("intermediate_marks_obtained", "intermediate_maximum_marks"),
}


# ── Value parsing / coercion ─────────────────────────────────────────────────

class FieldValueError(ValueError):
    """Raised when a requested value can't be coerced into the column's type."""


_DATE_FORMATS = ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")


def parse_value(spec: FieldSpec, raw: str) -> tuple[Any, str]:
    """
    Validate + coerce a submitted string into the Python type the column wants.

    Returns (typed_value, canonical_string). The canonical string is what gets
    stored in requested_value so the admin sees exactly what will be written.
    """
    value = (raw or "").strip()
    if not value:
        raise FieldValueError(f"{spec.label} cannot be blank.")

    if spec.kind == "select":
        match = next((c for c in spec.choices if c.lower() == value.lower()), None)
        if match is None:
            raise FieldValueError(f"{spec.label} must be one of: {', '.join(spec.choices)}.")
        return match, match

    if spec.kind == "date":
        for fmt in _DATE_FORMATS:
            try:
                parsed: date = datetime.strptime(value, fmt).date()
                break
            except ValueError:
                continue
        else:
            raise FieldValueError(f"{spec.label} must be a valid date (YYYY-MM-DD).")
        if parsed > date.today():
            raise FieldValueError(f"{spec.label} cannot be in the future.")
        if parsed.year < 1950:
            raise FieldValueError(f"{spec.label} looks wrong — please check the year.")
        return parsed, parsed.isoformat()

    if spec.kind == "int":
        if not re.fullmatch(r"\d{1,9}", value):
            raise FieldValueError(f"{spec.label} must be a whole number.")
        n = int(value)
        if spec.name.endswith("year_of_passing") and not (1950 <= n <= date.today().year + 1):
            raise FieldValueError(f"{spec.label} must be a realistic year.")
        return n, str(n)

    if spec.kind == "decimal":
        try:
            d = Decimal(value)
        except (InvalidOperation, ValueError):
            raise FieldValueError(f"{spec.label} must be a number.")
        if d < 0:
            raise FieldValueError(f"{spec.label} cannot be negative.")
        if d >= Decimal("1000000"):
            raise FieldValueError(f"{spec.label} is unrealistically large.")
        d = d.quantize(Decimal("0.01"))
        return d, format(d, "f")

    if spec.kind == "phone":
        digits = re.sub(r"[^\d]", "", value)
        if len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]
        if not re.fullmatch(r"[6-9]\d{9}", digits):
            raise FieldValueError(f"{spec.label} must be a valid 10-digit Indian mobile number.")
        return digits, digits

    if spec.kind == "email":
        low = value.lower()
        if not _EMAIL_RE.fullmatch(low):
            raise FieldValueError(f"{spec.label} must be a valid email address.")
        if spec.max_len and len(low) > spec.max_len:
            raise FieldValueError(f"{spec.label} is too long.")
        return low, low

    # Free text / textarea
    if spec.name == "pincode":
        if not re.fullmatch(r"\d{6}", value):
            raise FieldValueError("Pincode must be exactly 6 digits.")
    if spec.name == "aadhar_no":
        digits = re.sub(r"\s", "", value)
        if not re.fullmatch(r"\d{12}", digits):
            raise FieldValueError("Aadhar Number must be exactly 12 digits.")
        return digits, digits
    if spec.name == "pan_number":
        up = value.upper().replace(" ", "")
        if not re.fullmatch(r"[A-Z]{5}\d{4}[A-Z]", up):
            raise FieldValueError("PAN Number must look like ABCDE1234F.")
        return up, up

    if spec.max_len and len(value) > spec.max_len:
        raise FieldValueError(f"{spec.label} must be {spec.max_len} characters or fewer.")
    if spec.kind == "textarea" and len(value) > 2000:
        raise FieldValueError(f"{spec.label} is too long.")

    return value, value


def format_current(spec: FieldSpec, value: Any) -> Optional[str]:
    """Render the student's existing value the same way parse_value renders new ones."""
    if value is None:
        return None
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return format(value.quantize(Decimal("0.01")), "f")
    text = str(value).strip()
    return text or None


# ── Pydantic models ──────────────────────────────────────────────────────────

class FieldOut(BaseModel):
    field_name: str
    field_label: str
    group: str
    kind: str
    choices: List[str] = []
    help: Optional[str] = None
    current_value: Optional[str] = None
    pending_value: Optional[str] = None   # set if a PENDING request already exists


class ChangeRequestItem(BaseModel):
    field_name: str
    requested_value: str

    @field_validator("field_name")
    @classmethod
    def must_be_editable(cls, v: str) -> str:
        if v not in FIELD_REGISTRY:
            raise ValueError(f"'{v}' is not a reportable field.")
        return v


class ChangeRequestSubmit(BaseModel):
    changes: List[ChangeRequestItem]

    @field_validator("changes")
    @classmethod
    def at_least_one(cls, v):
        if not v:
            raise ValueError("Select at least one field to report.")
        if len({c.field_name for c in v}) != len(v):
            raise ValueError("The same field was submitted more than once.")
        if len(v) > 15:
            raise ValueError("Please report at most 15 fields in one request.")
        return v


class ChangeRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: Optional[int] = None
    field_name: str
    field_label: str
    current_value: Optional[str] = None
    requested_value: str
    status: str
    admin_note: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None
    reviewed_by_name: Optional[str] = None


class AdminChangeRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    student_name: Optional[str] = None
    register_number: Optional[str] = None
    branch: Optional[str] = None
    field_name: str
    field_label: str
    current_value: Optional[str] = None
    live_value: Optional[str] = None   # value on the record right now
    is_stale: bool = False             # live_value drifted from current_value
    requested_value: str
    status: str
    admin_note: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None
    reviewed_by_name: Optional[str] = None


class PendingSummaryOut(BaseModel):
    pending_count: int
    student_count: int
    recent: List[AdminChangeRequestOut]


class DeclineRequest(BaseModel):
    admin_note: str

    @field_validator("admin_note")
    @classmethod
    def note_required(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) < 3:
            raise ValueError("Please provide a reason (at least 3 characters).")
        if len(v) > 1000:
            raise ValueError("Reason is too long (max 1000 characters).")
        return v


class AcceptRequest(BaseModel):
    admin_note: Optional[str] = None


class BulkActionRequest(BaseModel):
    request_ids: List[int]
    admin_note: Optional[str] = None

    @field_validator("request_ids")
    @classmethod
    def not_empty(cls, v):
        if not v:
            raise ValueError("Select at least one request.")
        return v