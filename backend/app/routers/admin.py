import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import hash_password, require_admin
from ..config import MODELS_DIR
from ..db import get_db
from ..models import Ad, Performance, User
from ..schemas import AdIn, AdUpdate, UserCreate
from ..services.analytics import invalidate_cache
from ..services.ml_service import reload_models
from .auth import user_out

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])
ROLES = {"Manager", "Analyst", "Admin"}


# ---- users --------------------------------------------------------------------
@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    return [user_out(u) for u in db.scalars(select(User).order_by(User.user_id))]


@router.post("/users", status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db)):
    if body.role not in ROLES:
        raise HTTPException(422, f"role must be one of {sorted(ROLES)}")
    email = body.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "Email already registered")
    u = User(name=body.name.strip(), email=email, password_hash=hash_password(body.password), role=body.role)
    db.add(u); db.commit(); db.refresh(u)
    return user_out(u)


@router.delete("/users/{user_id}")
def delete_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if user_id == admin.user_id:
        raise HTTPException(400, "You cannot delete your own account")
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    db.delete(u); db.commit()
    return {"deleted": user_id}


# ---- ads / campaign information ----------------------------------------------------
@router.post("/ads", status_code=201)
def add_ad(body: AdIn, db: Session = Depends(get_db)):
    if db.get(Ad, body.ad_id):
        raise HTTPException(409, "Ad id already exists")
    db.add(Ad(**body.model_dump())); db.commit(); invalidate_cache()
    return body


@router.put("/ads/{ad_id}")
def update_ad(ad_id: str, body: AdUpdate, db: Session = Depends(get_db)):
    ad = db.get(Ad, ad_id)
    if not ad:
        raise HTTPException(404, "Ad not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(ad, k, v)
    db.commit(); invalidate_cache()
    return {"ad_id": ad.ad_id, "campaign_id": ad.campaign_id, "ad_type": ad.ad_type,
            "ad_category": ad.ad_category, "has_offer": ad.has_offer}


@router.delete("/ads/{ad_id}")
def delete_ad(ad_id: str, db: Session = Depends(get_db)):
    ad = db.get(Ad, ad_id)
    if not ad:
        raise HTTPException(404, "Ad not found")
    n = db.scalar(select(func.count()).select_from(Performance).where(Performance.ad_id == ad_id))
    if n:
        raise HTTPException(409, f"Ad has {n} performance records. Remove them first.")
    db.delete(ad); db.commit(); invalidate_cache()
    return {"deleted": ad_id}


@router.delete("/performance/{performance_id}")
def delete_performance(performance_id: int, db: Session = Depends(get_db)):
    """Remove an incorrect record."""
    row = db.get(Performance, performance_id)
    if not row:
        raise HTTPException(404, "Record not found")
    db.delete(row); db.commit(); invalidate_cache()
    return {"deleted": performance_id}


# ---- models -------------------------------------------------------------------------
@router.get("/model-info")
def model_info():
    out = {}
    for name in ("meta", "evaluation"):
        p = MODELS_DIR / f"{name}.json"
        out[name] = json.loads(p.read_text()) if p.exists() else None
    return out


@router.post("/reload-models")
def reload():
    return {"models_loaded": reload_models()}
