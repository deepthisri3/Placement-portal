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
