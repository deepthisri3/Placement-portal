from sqlalchemy import Column, Integer, String, ForeignKey, Numeric, Text, Date
from sqlalchemy.orm import relationship
from ..database import Base

class Student(Base):
    """
    Extra profile fields for users with role == student.
    """
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    full_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=True)
    register_number = Column(String(20), unique=True, nullable=False, index=True)
    phone = Column(String(15), nullable=False)

    # Academic profile
    branch = Column(String(100), nullable=True)
    cgpa = Column(Numeric(3, 2), nullable=True)
    skills = Column(Text, nullable=True)
    graduation_year = Column(Integer, nullable=True)
    resume_filename = Column(String(255), nullable=True)
    photo_filename = Column(String(255), nullable=True)

    # --- Extended personal details ---
    date_of_birth = Column(Date, nullable=True)
    alt_email = Column(String(100), nullable=True)
    category = Column(String(10), nullable=True)

    # Academic (extended)
    course = Column(String(50), nullable=True)
    batch = Column(String(20), nullable=True)
    section = Column(String(20), nullable=True)

    # Family
    father_name = Column(String(100), nullable=True)
    father_occupation = Column(String(100), nullable=True)
    mother_name = Column(String(100), nullable=True)
    mother_maiden_name = Column(String(100), nullable=True)
    parent_mobile_no = Column(String(15), nullable=True)

    # Address
    address_for_communication = Column(Text, nullable=True)
    hometown = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    pincode = Column(String(10), nullable=True)
    stay_type = Column(String(20), nullable=True)   # 'Day Scholar' | 'Hosteler'

    # Identity
    aadhar_no = Column(String(20), nullable=True)
    name_as_per_aadhar = Column(String(100), nullable=True)
    pan_number = Column(String(20), nullable=True)

    # Educational details
    ssc_school_name = Column(String(255), nullable=True)
    ssc_board = Column(String(120), nullable=True)
    ssc_year_of_passing = Column(Integer, nullable=True)
    ssc_marks_obtained = Column(Numeric(8, 2), nullable=True)
    ssc_maximum_marks = Column(Numeric(8, 2), nullable=True)
    ssc_percentage = Column(Numeric(6, 2), nullable=True)

    intermediate_course_type = Column(String(50), nullable=True)
    intermediate_college_name = Column(String(255), nullable=True)
    intermediate_board = Column(String(120), nullable=True)
    intermediate_year_of_passing = Column(Integer, nullable=True)
    intermediate_marks_obtained = Column(Numeric(8, 2), nullable=True)
    intermediate_maximum_marks = Column(Numeric(8, 2), nullable=True)
    intermediate_percentage = Column(Numeric(6, 2), nullable=True)

    entrance_exam = Column(String(120), nullable=True)
    entrance_rank = Column(Integer, nullable=True)
    seat_status = Column(String(50), nullable=True)

    education_gap_years = Column(Integer, nullable=True)
    education_gap_reason = Column(Text, nullable=True)

    foreign_languages_known = Column(Text, nullable=True)

    user = relationship("User", back_populates="student")