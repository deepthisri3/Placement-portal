from typing import Optional, List
from datetime import date
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, model_validator
from app.schemas.user import UserOut
from app.utils.validators import validate_register_number_format, validate_password_strength


class StudentLoginRequest(BaseModel):
    register_number: str
    password: str


class StudentSendOTPRequest(BaseModel):
    register_number: str
    alt_email: EmailStr

    @field_validator("register_number")
    @classmethod
    def normalize_register_number(cls, value: str) -> str:
        return validate_register_number_format(value)


class StudentOTPVerifyRequest(BaseModel):
    register_number: str
    otp: str

    @field_validator("register_number")
    @classmethod
    def normalize_register_number(cls, value: str) -> str:
        return validate_register_number_format(value)


class StudentResendOTPRequest(BaseModel):
    register_number: str

    @field_validator("register_number")
    @classmethod
    def normalize_register_number(cls, value: str) -> str:
        return validate_register_number_format(value)


class StudentRegisterRequest(BaseModel):
    register_number: str
    password: str
    confirm_password: str
    full_name: str
    phone: str
    alt_email: EmailStr
    last_name: Optional[str] = None
    branch: Optional[str] = None
    cgpa: Optional[float] = None
    skills: Optional[str] = None
    date_of_birth: Optional[date] = None
    category: Optional[str] = None
    course: Optional[str] = None
    batch: Optional[str] = None
    section: Optional[str] = None
    father_name: Optional[str] = None
    father_occupation: Optional[str] = None
    mother_name: Optional[str] = None
    mother_maiden_name: Optional[str] = None
    parent_mobile_no: Optional[str] = None
    address_for_communication: Optional[str] = None
    hometown: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    stay_type: Optional[str] = None
    aadhar_no: Optional[str] = None
    name_as_per_aadhar: Optional[str] = None
    pan_number: Optional[str] = None
    ssc_school_name: Optional[str] = None
    ssc_board: Optional[str] = None
    ssc_year_of_passing: Optional[int] = None
    ssc_marks_obtained: Optional[float] = None
    ssc_maximum_marks: Optional[float] = None
    ssc_percentage: Optional[float] = None
    intermediate_course_type: Optional[str] = None
    intermediate_college_name: Optional[str] = None
    intermediate_board: Optional[str] = None
    intermediate_year_of_passing: Optional[int] = None
    intermediate_marks_obtained: Optional[float] = None
    intermediate_maximum_marks: Optional[float] = None
    intermediate_percentage: Optional[float] = None
    entrance_exam: Optional[str] = None
    entrance_rank: Optional[int] = None
    seat_status: Optional[str] = None
    education_gap_years: Optional[int] = None
    education_gap_reason: Optional[str] = None
    foreign_languages_known: Optional[str] = None
    resume_filename: Optional[str] = None
    photo_filename: Optional[str] = None

    @field_validator("register_number")
    @classmethod
    def normalize_register_number(cls, value: str) -> str:
        return validate_register_number_format(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return validate_password_strength(value)

    @model_validator(mode="after")
    def validate_password_match(self) -> "StudentRegisterRequest":
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class StudentOut(BaseModel):
    id: int
    full_name: str
    register_number: str
    phone: str
    email: str
    role: str


class StudentProfileUpdate(BaseModel):
    branch: Optional[str] = None
    skills: Optional[str] = None


class StudentProfileOut(BaseModel):
    id: int
    full_name: str
    last_name: Optional[str] = None
    register_number: str
    phone: str
    email: str
    date_of_birth: Optional[date] = None
    alt_email: Optional[str] = None
    category: Optional[str] = None
    course: Optional[str] = None
    batch: Optional[str] = None
    branch: Optional[str] = None
    section: Optional[str] = None
    cgpa: Optional[float] = None
    skills: Optional[str] = None
    graduation_year: Optional[int] = None
    resume_filename: Optional[str] = None
    father_name: Optional[str] = None
    father_occupation: Optional[str] = None
    mother_name: Optional[str] = None
    mother_maiden_name: Optional[str] = None
    parent_mobile_no: Optional[str] = None
    address_for_communication: Optional[str] = None
    hometown: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    stay_type: Optional[str] = None
    aadhar_no: Optional[str] = None
    name_as_per_aadhar: Optional[str] = None
    pan_number: Optional[str] = None
    ssc_school_name: Optional[str] = None
    ssc_board: Optional[str] = None
    ssc_year_of_passing: Optional[int] = None
    ssc_marks_obtained: Optional[float] = None
    ssc_maximum_marks: Optional[float] = None
    ssc_percentage: Optional[float] = None
    intermediate_course_type: Optional[str] = None
    intermediate_college_name: Optional[str] = None
    intermediate_board: Optional[str] = None
    intermediate_year_of_passing: Optional[int] = None
    intermediate_marks_obtained: Optional[float] = None
    intermediate_maximum_marks: Optional[float] = None
    intermediate_percentage: Optional[float] = None
    entrance_exam: Optional[str] = None
    entrance_rank: Optional[int] = None
    seat_status: Optional[str] = None
    education_gap_years: Optional[int] = None
    education_gap_reason: Optional[str] = None
    foreign_languages_known: Optional[str] = None
    photo_filename: Optional[str] = None


class StudentPlacementStatusOut(BaseModel):
    is_placed: bool
    total_offers: int
    highest_package: Optional[float] = None


class StudentDetailsUpdate(BaseModel):
    full_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    alt_email: Optional[str] = None
    date_of_birth: Optional[date] = None
    category: Optional[str] = None
    course: Optional[str] = None
    batch: Optional[str] = None
    branch: Optional[str] = None
    section: Optional[str] = None
    father_name: Optional[str] = None
    father_occupation: Optional[str] = None
    mother_name: Optional[str] = None
    mother_maiden_name: Optional[str] = None
    parent_mobile_no: Optional[str] = None
    address_for_communication: Optional[str] = None
    hometown: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    stay_type: Optional[str] = None
    aadhar_no: Optional[str] = None
    name_as_per_aadhar: Optional[str] = None
    pan_number: Optional[str] = None
    ssc_school_name: Optional[str] = None
    ssc_board: Optional[str] = None
    ssc_year_of_passing: Optional[int] = None
    ssc_marks_obtained: Optional[float] = None
    ssc_maximum_marks: Optional[float] = None
    intermediate_course_type: Optional[str] = None
    intermediate_college_name: Optional[str] = None
    intermediate_board: Optional[str] = None
    intermediate_year_of_passing: Optional[int] = None
    intermediate_marks_obtained: Optional[float] = None
    intermediate_maximum_marks: Optional[float] = None
    entrance_exam: Optional[str] = None
    entrance_rank: Optional[int] = None
    seat_status: Optional[str] = None
    education_gap_years: Optional[int] = None
    education_gap_reason: Optional[str] = None
    foreign_languages_known: Optional[str] = None


class StudentDetailsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    last_name: Optional[str] = None
    register_number: str
    phone: Optional[str] = None
    email: Optional[str] = None
    date_of_birth: Optional[date] = None
    alt_email: Optional[str] = None
    category: Optional[str] = None
    course: Optional[str] = None
    batch: Optional[str] = None
    branch: Optional[str] = None
    section: Optional[str] = None
    cgpa: Optional[float] = None
    skills: Optional[str] = None
    graduation_year: Optional[int] = None
    resume_filename: Optional[str] = None
    photo_filename: Optional[str] = None
    father_name: Optional[str] = None
    father_occupation: Optional[str] = None
    mother_name: Optional[str] = None
    mother_maiden_name: Optional[str] = None
    parent_mobile_no: Optional[str] = None
    address_for_communication: Optional[str] = None
    hometown: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    stay_type: Optional[str] = None
    aadhar_no: Optional[str] = None
    name_as_per_aadhar: Optional[str] = None
    pan_number: Optional[str] = None
    ssc_school_name: Optional[str] = None
    ssc_board: Optional[str] = None
    ssc_year_of_passing: Optional[int] = None
    ssc_marks_obtained: Optional[float] = None
    ssc_maximum_marks: Optional[float] = None
    ssc_percentage: Optional[float] = None
    intermediate_course_type: Optional[str] = None
    intermediate_college_name: Optional[str] = None
    intermediate_board: Optional[str] = None
    intermediate_year_of_passing: Optional[int] = None
    intermediate_marks_obtained: Optional[float] = None
    intermediate_maximum_marks: Optional[float] = None
    intermediate_percentage: Optional[float] = None
    entrance_exam: Optional[str] = None
    entrance_rank: Optional[int] = None
    seat_status: Optional[str] = None
    education_gap_years: Optional[int] = None
    education_gap_reason: Optional[str] = None
    foreign_languages_known: Optional[str] = None


class StudentApplicationItem(BaseModel):
    """One application row shown on the admin's student profile view."""
    opportunity_type: str            # 'on_campus' | 'off_campus'
    opportunity_id: int
    company_or_title: Optional[str] = None


class AdminStudentProfileOut(BaseModel):
    """Summary student profile for admins (used by the existing search card)."""
    id: int
    full_name: str
    register_number: str
    phone: Optional[str] = None
    email: Optional[str] = None
    branch: Optional[str] = None
    cgpa: Optional[float] = None
    skills: Optional[str] = None
    has_resume: bool
    resume_filename: Optional[str] = None
    applications: List[StudentApplicationItem] = []


class AdminStudentPlacement(BaseModel):
    is_placed: bool
    total_offers: int
    highest_package: Optional[float] = None


class AdminStudentFullProfileOut(BaseModel):
    """Complete read-only student profile for the admin's dedicated view."""
    id: int
    full_name: str
    last_name: Optional[str] = None
    register_number: str
    phone: Optional[str] = None
    email: Optional[str] = None
    date_of_birth: Optional[date] = None
    alt_email: Optional[str] = None
    category: Optional[str] = None
    course: Optional[str] = None
    batch: Optional[str] = None
    branch: Optional[str] = None
    section: Optional[str] = None
    cgpa: Optional[float] = None
    skills: Optional[str] = None
    graduation_year: Optional[int] = None
    resume_filename: Optional[str] = None
    photo_filename: Optional[str] = None
    has_resume: bool = False

    father_name: Optional[str] = None
    father_occupation: Optional[str] = None
    mother_name: Optional[str] = None
    mother_maiden_name: Optional[str] = None
    parent_mobile_no: Optional[str] = None
    address_for_communication: Optional[str] = None
    hometown: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    stay_type: Optional[str] = None
    aadhar_no: Optional[str] = None
    name_as_per_aadhar: Optional[str] = None
    pan_number: Optional[str] = None

    ssc_school_name: Optional[str] = None
    ssc_board: Optional[str] = None
    ssc_year_of_passing: Optional[int] = None
    ssc_marks_obtained: Optional[float] = None
    ssc_maximum_marks: Optional[float] = None
    ssc_percentage: Optional[float] = None
    intermediate_course_type: Optional[str] = None
    intermediate_college_name: Optional[str] = None
    intermediate_board: Optional[str] = None
    intermediate_year_of_passing: Optional[int] = None
    intermediate_marks_obtained: Optional[float] = None
    intermediate_maximum_marks: Optional[float] = None
    intermediate_percentage: Optional[float] = None
    entrance_exam: Optional[str] = None
    entrance_rank: Optional[int] = None
    seat_status: Optional[str] = None
    education_gap_years: Optional[int] = None
    education_gap_reason: Optional[str] = None
    foreign_languages_known: Optional[str] = None

    placement: AdminStudentPlacement
    applications: List[StudentApplicationItem] = []