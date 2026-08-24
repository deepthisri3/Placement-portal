from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
# --- add near your other model imports so create_all sees the table ---
from app.models import company  # noqa: F401
from app.models import placement_record  # noqa: F401
from app.models import blog  # noqa: F401
# --- add near your other router imports ---
from app.routers import companies
from app.routers import placement_records
from app.routers import blogs
from app.routers import password_reset
from app.models import notification  # noqa: F401
from app.routers import notifications
from app.routers import admin_tasks
from app.routers import reports
from app.models import academic  # noqa: F401
from app.routers import academic as academic_router
# Import (add near other "from app.routers import ..." lines)
from app.routers import change_requests as change_requests_router
from app.models.student_message import StudentMessage   # with other model imports
from app.routers import student_messages as student_messages_router  # with other router imports

# Model import so the table is created (add near other model imports)
from app.models.change_request import StudentChangeRequest  # noqa: F401

# Register (add near other app.include_router lines)


# --- add near your other app.include_router(...) calls ---


from app.routers import auth_student, auth_admin, admin_management, opportunities, students
from app.database import Base, engine
from app.models import cluster  # noqa: F401
from app.routers import clusters as clusters_router
# ...


app = FastAPI(
    title="Campus Placement Portal API",
    description="Authentication service for the Campus Placement Portal",
    version="0.1.0",
)


def _sync_student_education_columns() -> None:
    inspector = inspect(engine)
    try:
        existing = {column["name"] for column in inspector.get_columns("students")}
    except Exception:
        return

    columns_to_add = {
        "last_name": "VARCHAR(255) NULL",
        "personal_email": "VARCHAR(255) NULL",
        "ssc_school_name": "VARCHAR(255) NULL",
        "ssc_board": "VARCHAR(120) NULL",
        "ssc_year_of_passing": "INT NULL",
        "ssc_marks_obtained": "DECIMAL(8,2) NULL",
        "ssc_maximum_marks": "DECIMAL(8,2) NULL",
        "ssc_percentage": "DECIMAL(6,2) NULL",
        "intermediate_course_type": "VARCHAR(50) NULL",
        "intermediate_college_name": "VARCHAR(255) NULL",
        "intermediate_board": "VARCHAR(120) NULL",
        "intermediate_year_of_passing": "INT NULL",
        "intermediate_marks_obtained": "DECIMAL(8,2) NULL",
        "intermediate_maximum_marks": "DECIMAL(8,2) NULL",
        "intermediate_percentage": "DECIMAL(6,2) NULL",
        "entrance_exam": "VARCHAR(120) NULL",
        "entrance_rank": "INT NULL",
        "seat_status": "VARCHAR(50) NULL",
        "education_gap_years": "INT NULL",
        "education_gap_reason": "TEXT NULL",
        "foreign_languages_known": "TEXT NULL",
    }

    with engine.begin() as connection:
        for column_name, ddl in columns_to_add.items():
            if column_name not in existing:
                connection.execute(text(f"ALTER TABLE students ADD COLUMN {column_name} {ddl}"))


Base.metadata.create_all(bind=engine)
_sync_student_education_columns()


# Allows the React dev server (different origin: localhost:5173 vs
# localhost:8000) to call this API from the browser. Without this,
# every request would be blocked by the browser's CORS policy before
# it even reaches our routes.
app.add_middleware(
    CORSMiddleware,
    # Both localhost (for testing on this same machine) and the LAN IP
    # (for testing from a phone/other device on the same WiFi) need to
    # be allowed — the browser sends whichever origin it's actually
    # running from, and it must exactly match one of these.
    allow_origins=["http://localhost:5173", "http://192.168.1.5:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Each router owns one feature area's endpoints. As we build
# protected routes, they'll be included here the same way.
app.include_router(auth_student.router)
app.include_router(auth_admin.router)
app.include_router(admin_management.router)
app.include_router(opportunities.router)
app.include_router(students.router)
app.include_router(companies.router)
app.include_router(placement_records.router)
app.include_router(blogs.router)
app.include_router(password_reset.router)
app.include_router(notifications.router)
app.include_router(admin_tasks.router)
app.include_router(reports.router)
app.include_router(academic_router.router)
app.include_router(clusters_router.router)
app.include_router(change_requests_router.router)
app.include_router(student_messages_router.router)



@app.get("/health")
def health_check():
    """Simple endpoint to confirm the server is up and reachable."""
    return {"status": "ok"}