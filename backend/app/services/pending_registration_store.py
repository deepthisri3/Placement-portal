from typing import Any, Optional
from datetime import datetime, timedelta

# In-memory store for registrations that have submitted the form but not
# yet verified their OTP. Key = register_number (uppercased), Value = dict
# of the data needed to actually create the User+Student rows once verified.
#
# LIMITATION (intentional, for this stage of the project): this dict lives
# only in server memory. Restarting the server clears all pending
# registrations, and this won't work if you ever run multiple server
# processes (they'd each have their own separate copy of this dict).
# Fine for local dev / single-process learning project; swap for Redis or
# a DB table with an expiry column before deploying for real use.
_pending_registrations: dict[str, dict] = {}

PENDING_EXPIRY_MINUTES = 10
OTP_COOLDOWN_SECONDS = 60


def save_pending_registration(
    register_number: str,
    password_hash: str,
    email: str,
    student_data: dict[str, Any],
    alt_email: str,
) -> None:
    _pending_registrations[register_number] = {
        "password_hash": password_hash,
        "email": email,
        "student_data": student_data,
        "alt_email": alt_email,
        "otp": None,          # set in Step 7 (OTP generation)
        "otp_expires_at": None,
        "otp_sent_at": None,
        "verified": False,    # set True in Step 8, once OTP is confirmed
        "created_at": datetime.utcnow(),
    }


def get_pending_registration(register_number: str) -> Optional[dict]:
    return _pending_registrations.get(register_number)


def update_pending_registration_otp(register_number: str, otp: str) -> None:
    """Used in Step 7 to attach a freshly generated OTP to a pending entry."""
    entry = _pending_registrations.get(register_number)
    if entry is not None:
        entry["otp"] = otp
        entry["otp_expires_at"] = datetime.utcnow() + timedelta(minutes=PENDING_EXPIRY_MINUTES)
        entry["otp_sent_at"] = datetime.utcnow()


def can_request_new_otp(register_number: str) -> tuple[bool, str]:
    entry = _pending_registrations.get(register_number)
    if entry is None:
        return True, ""

    otp_sent_at = entry.get("otp_sent_at")
    if otp_sent_at is None:
        return True, ""

    elapsed = datetime.utcnow() - otp_sent_at
    if elapsed < timedelta(seconds=OTP_COOLDOWN_SECONDS):
        remaining = int((timedelta(seconds=OTP_COOLDOWN_SECONDS) - elapsed).total_seconds())
        return False, f"Please wait {remaining} seconds before requesting another OTP."

    return True, ""


def mark_pending_verified(register_number: str) -> None:
    """Called once OTP verification succeeds. Later registration will only
    complete if this flag is True."""
    entry = _pending_registrations.get(register_number)
    if entry is not None:
        entry["verified"] = True
        entry["otp"] = None
        entry["otp_expires_at"] = None


def delete_pending_registration(register_number: str) -> None:
    """Used in Step 9, after the student is successfully saved to MySQL."""
    _pending_registrations.pop(register_number, None)