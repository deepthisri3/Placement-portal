# Campus Placement Portal

## Project Overview

This repository implements a campus placement portal with a React frontend and a FastAPI backend. It provides student self-service, admin management, company tracking, placement records, notifications, and reporting capabilities for a college placement office.

- What the project is: a placement portal for students, admins, and super admins.
- What problem it solves: centralizes registration, company/opportunity management, placement tracking, notifications, resume reminders, and placement analytics.
- Who the users are: students, admins, and a super admin.
- Why it was built: to provide a structured campus recruitment workflow with secure access control and data-driven placement reporting.

## Features

### Student Features

- OTP-backed student registration with alternative email verification
- Student login using register number + password
- Student profile viewing and update
- Resume upload and authenticated resume download
- Company search and company profile browsing
- On-campus and off-campus opportunity browsing
- Student opportunity application submission
- View own applications
- View notifications and unread notification count
- Password reset via OTP

### Admin Features

- Admin login with email + password
- Super Admin invites new admins by email
- Admin list with invitation status
- Company CRUD operations
- Create and update on-campus and off-campus opportunities
- View opportunity applicants
- Upload placement records via CSV/XLSX
- Export placement records
- Broadcast notifications to student groups
- View notification broadcast history and analytics
- Trigger resume update reminder emails
- Upload and update student CGPA data
- View branch placement statistics and export Excel reports
- Access student profiles and student resume files

### Authentication

- JWT-based authentication
- Role-based access control (`student`, `admin`, `super_admin`)
- Password hashing with bcrypt / passlib
- OTP verification for registration and password reset

### Company Management

- Company search
- Company details and analytics
- Analytics computed from placement records
- Company creation, update, and deletion

### Placement Management

- On-campus and off-campus opportunity management
- Application tracking
- Placement records upload, merge, and export
- Placement reports for branch-wise statistics

### Reports

- Branch placement statistics report
- Excel export of branch placement statistics

### Other Implemented Modules

- Blog posts for company experiences
- Blog upvoting
- Notification broadcast engine
- Lazy deadline notification generation
- Standalone resume reminder script (`send_resume_reminders.py`)

## Technology Stack

Frontend

- React
- Vite
- React Router
- Axios
- Recharts

Backend

- FastAPI
- SQLAlchemy
- Pydantic / pydantic-settings
- Uvicorn

Database

- MySQL (via `pymysql`)

Authentication

- JWT
- bcrypt / passlib

Other Libraries

- python-dotenv
- fastapi-mail
- python-multipart
- openpyxl

## System Architecture

```
Browser
  ↓
React + Vite frontend
  ↓
Axios HTTP client
  ↓
FastAPI backend
  ↓
Routers → Services → SQLAlchemy models
  ↓
MySQL database
```

Optional background workflow:

```
send_resume_reminders.py
  ↓
FastAPI services
  ↓
Database + email service
```

## Project Structure

- `backend/`
  - `app/`
    - `config.py` — environment and settings management
    - `database.py` — SQLAlchemy engine, session, and DB dependency
    - `auth/` — JWT creation/validation and password hashing
    - `dependencies/` — auth dependencies for protected routes and role checks
    - `models/` — SQLAlchemy table definitions
    - `routers/` — FastAPI route handlers for each feature area
    - `schemas/` — Pydantic request/response validation models
    - `services/` — business logic for invitations, OTPs, notifications, placement records, reports, and email
    - `utils/` — helpers and validators
  - `requirements.txt` — Python backend dependencies
  - `send_resume_reminders.py` — standalone reminder runner
  - `uploads/resumes/` — resume file storage

- `frontend/frontend/`
  - `src/`
    - `App.jsx` — route definitions and protected route setup
    - `context/AuthContext.jsx` — authentication state management
    - `routes/ProtectedRoute.jsx` — role-based route guarding
    - `pages/` — UI screens for auth, dashboards, companies, notifications, placement records, and admin tasks
    - `components/` — shared UI components like notification bell
    - `services/api.js` — Axios instance with auth header injection
  - `package.json` — frontend dependencies and scripts
  - `vite.config.js` — Vite configuration

## Installation Guide

### Prerequisites

- Python 3.x (recommended for FastAPI / SQLAlchemy)
- Node.js 16+ / 18+ for Vite
- MySQL database

### Backend installation

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Frontend installation

```bash
cd frontend/frontend
npm install
```

## Environment Variables

From `backend/.env.example`:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `EMAIL_ENABLED`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `SMTP_TLS`
- `FRONTEND_BASE_URL`
- `SECRET_KEY`
- `ALGORITHM`
- `ACCESS_TOKEN_EXPIRE_MINUTES`

## Running the Project

### Backend

```bash
cd backend
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd frontend/frontend
npm run dev
```

### Database

- Start MySQL
- Create a database, for example:
  ```sql
  CREATE DATABASE campus_placement_portal;
  ```
- Update `backend/.env` with your DB credentials

### Resume reminder script

```bash
cd backend
.venv\Scripts\Activate.ps1
python send_resume_reminders.py
```

## API Documentation

FastAPI generates Swagger and ReDoc automatically:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

## Authentication Flow

Student Login:

1. Student submits register number and password.
2. Frontend calls `POST /auth/student/login`.
3. Backend looks up `Student` by `register_number`.
4. Backend loads associated `User` and verifies password via bcrypt.
5. Backend issues a JWT containing `user_id` and `role`.
6. Frontend stores `token` and `role` in `localStorage`.
7. Future requests send `Authorization: Bearer <token>`.
8. Protected backend routes validate the token and enforce role access.

Admin Login:

- Admins authenticate with email + password at `POST /auth/admin/login`.
- Super Admin and admin roles share the same login path.
- Role-based dependencies enforce admin-only or super-admin-only access.

## Database Overview

Tables and relationships are based on SQLAlchemy models:

- `users`
  - Primary key: `id`
  - Fields: `email`, `password_hash`, `role`, `full_name`, invitation fields
  - Relationship: one-to-one with `students`

- `students`
  - Primary key: `id`
  - Foreign key: `user_id` → `users.id`
  - Fields: register number, profile, academic info, resume filename

- `companies`
  - Primary key: `id`
  - Fields: `name`, `description`, `website`, `logo_url`, `created_by`

- `on_campus_opportunities`
  - Primary key: `id`
  - Foreign keys: `created_by` → `users.id`, `company_id` → `companies.id`
  - Fields: company name, deadline, eligibility, target branches/years

- `off_campus_opportunities`
  - Primary key: `id`
  - Foreign key: `created_by` → `users.id`

- `applications`
  - Primary key: `id`
  - Foreign keys: `student_id` → `students.id`
  - `on_campus_opportunity_id` or `off_campus_opportunity_id`

- `placement_records`
  - Primary key: `id`
  - Foreign keys: `company_id` → `companies.id`, `student_id` → `students.id` (nullable)
  - Unique constraint on `(roll_number, company_id)`

- `notifications`
  - Primary key: `id`
  - Foreign key: `student_id` → `students.id`
  - Optional `broadcast_id` → `notification_broadcasts.id`

- `notification_broadcasts`
  - Primary key: `id`
  - Fields: broadcast metadata and target audience

- `blogs`
  - Primary key: `id`
  - Foreign keys: `student_id` → `students.id`, `company_id` → `companies.id`

- `blog_upvotes`
  - Primary key: `id`
  - Foreign keys: `blog_id` → `blogs.id`, `student_id` → `students.id`
  - Unique constraint on `(blog_id, student_id)`

## Request Flow

Example: Student Login request flow

1. Student enters register number and password on the React login page.
2. Frontend sends `POST /auth/student/login` to FastAPI via `axios`.
3. FastAPI route `auth_student.login_student` receives the payload.
4. Backend finds `Student` by `register_number`.
5. Backend loads the linked `User` row.
6. Password is verified using `passlib` bcrypt.
7. If valid, backend creates a JWT with `user_id` and `role`.
8. Frontend stores the JWT and role in `localStorage`.
9. Subsequent protected requests include the token in `Authorization` header.
10. Backend auth dependencies decode the token and enforce access control.

## Security

- JWT authentication for protected API routes
- Password hashing using bcrypt via `passlib`
- Role-based authorization for admin and student actions
- Environment variables for database credentials, secrets, and SMTP settings
- CORS policy configured for frontend origin
- Input validation and serialization with Pydantic
- Upload limits for resumes and placement records
- Authenticated resume downloads, not public static URLs
- OTP verification for student registration and password reset

## Future Enhancements

- Add formal admin dashboard analytics pages
- Add role-specific audit logging
- Add support for actual company user accounts
- Add pagination and filtering for blog posts and notifications
- Add automated deadline notification scheduler
- Add test coverage and CI workflows
- Add Docker / container deployment support

## Contributors

- Repository maintainer / project author

## License

This project is available under the MIT License.
