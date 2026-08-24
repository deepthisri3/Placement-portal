from typing import Optional, List
from datetime import date
from pydantic import BaseModel


class StudentApplicationItem(BaseModel):
    """One application row shown on the admin's student profile view."""
    opportunity_type: str            # 'on_campus' | 'off_campus'
    opportunity_id: int
    company_or_title: Optional[str] = None


class AdminStudentPlacement(BaseModel):
    is_placed: bool
    total_offers: int
    highest_package: Optional[float] = None


class AdminStudentProfileOut(BaseModel):
    """Full student profile for admins, including applications + resume status."""
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