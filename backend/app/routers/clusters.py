from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.dependencies.auth_dependency import require_roles
from app.models.cluster import StudentCluster, ClusterMember
from app.models.student import Student
from app.models.user import User
from app.schemas.cluster import ClusterCreate, ClusterUpdate, ClusterOut, ClusterDetailOut, ClusterMemberOut

router = APIRouter(prefix="/clusters", tags=["Clusters"])
ADMIN = require_roles("admin", "super_admin")


@router.get("", response_model=List[ClusterOut])
def list_clusters(db: Session = Depends(get_db), _user=Depends(ADMIN)):
    clusters = db.query(StudentCluster).order_by(StudentCluster.created_at.desc()).all()
    return [
        ClusterOut(
            id=c.id,
            name=c.name,
            member_count=len(c.members),
            created_at=c.created_at,
        )
        for c in clusters
    ]


@router.post("", response_model=ClusterDetailOut, status_code=status.HTTP_201_CREATED)
def create_cluster(payload: ClusterCreate, db: Session = Depends(get_db), user=Depends(ADMIN)):
    existing = db.query(StudentCluster).filter(StudentCluster.name == payload.name.strip()).first()
    if existing:
        raise HTTPException(status_code=409, detail="A cluster with this name already exists.")

    # Validate all student IDs exist.
    valid_ids = {s.id for s in db.query(Student.id).filter(Student.id.in_(payload.student_ids)).all()}
    invalid = set(payload.student_ids) - valid_ids
    if invalid:
        raise HTTPException(status_code=400, detail=f"Student IDs not found: {sorted(invalid)}")

    cluster = StudentCluster(
        name=payload.name.strip(),
        created_by=getattr(user, "user_id", None),
    )
    db.add(cluster)
    db.flush()

    for sid in set(payload.student_ids):
        db.add(ClusterMember(cluster_id=cluster.id, student_id=sid))

    db.commit()
    db.refresh(cluster)
    return _cluster_detail(db, cluster)


@router.get("/{cluster_id}", response_model=ClusterDetailOut)
def get_cluster(cluster_id: int, db: Session = Depends(get_db), _user=Depends(ADMIN)):
    cluster = _get_or_404(db, cluster_id)
    return _cluster_detail(db, cluster)


@router.put("/{cluster_id}", response_model=ClusterDetailOut)
def update_cluster(cluster_id: int, payload: ClusterUpdate, db: Session = Depends(get_db), _user=Depends(ADMIN)):
    cluster = _get_or_404(db, cluster_id)

    # Check name uniqueness (allow same name on same cluster).
    dup = (
        db.query(StudentCluster)
        .filter(StudentCluster.name == payload.name.strip(), StudentCluster.id != cluster_id)
        .first()
    )
    if dup:
        raise HTTPException(status_code=409, detail="A cluster with this name already exists.")

    cluster.name = payload.name.strip()

    # Replace members.
    db.query(ClusterMember).filter(ClusterMember.cluster_id == cluster_id).delete()
    valid_ids = {s.id for s in db.query(Student.id).filter(Student.id.in_(payload.student_ids)).all()}
    for sid in set(payload.student_ids):
        if sid in valid_ids:
            db.add(ClusterMember(cluster_id=cluster_id, student_id=sid))

    db.commit()
    db.refresh(cluster)
    return _cluster_detail(db, cluster)


@router.delete("/{cluster_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cluster(cluster_id: int, db: Session = Depends(get_db), _user=Depends(ADMIN)):
    cluster = _get_or_404(db, cluster_id)
    db.delete(cluster)
    db.commit()
    return None


def _get_or_404(db: Session, cluster_id: int) -> StudentCluster:
    cluster = db.query(StudentCluster).filter(StudentCluster.id == cluster_id).first()
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found.")
    return cluster


def _cluster_detail(db: Session, cluster: StudentCluster) -> ClusterDetailOut:
    members = []
    for m in cluster.members:
        student = db.query(Student).filter(Student.id == m.student_id).first()
        if not student:
            continue
        user = db.query(User).filter(User.id == student.user_id).first()
        members.append(ClusterMemberOut(
            id=student.id,
            register_number=student.register_number,
            full_name=student.full_name,
            branch=student.branch,
            email=user.email if user else None,
        ))
    return ClusterDetailOut(
        id=cluster.id,
        name=cluster.name,
        created_at=cluster.created_at,
        members=members,
    )