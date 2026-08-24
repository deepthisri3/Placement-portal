from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth_dependency import require_roles
from app.services.report_service import (
    export_branch_placement_statistics_excel,
    get_branch_placement_statistics,
)

router = APIRouter(prefix="/admin/reports", tags=["Admin Reports"])
ADMIN = require_roles("admin", "super_admin")


@router.get("/branch-placement-statistics")
def get_branch_placement_statistics_report(
    branch: str | None = Query(None, description="Filter by branch code, e.g. CSE"),
    graduation_year: int | None = Query(None, description="Filter by graduation year"),
    db: Session = Depends(get_db),
    _user=Depends(ADMIN),
):
    return get_branch_placement_statistics(db, branch=branch, graduation_year=graduation_year)


@router.get("/branch-placement-statistics/export")
def export_branch_placement_statistics_report(
    branch: str | None = Query(None, description="Filter by branch code, e.g. CSE"),
    graduation_year: int | None = Query(None, description="Filter by graduation year"),
    db: Session = Depends(get_db),
    _user=Depends(ADMIN),
):
    return export_branch_placement_statistics_excel(db, branch=branch, graduation_year=graduation_year)
