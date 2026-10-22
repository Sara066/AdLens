"""Dropdown options and lookup lists for the frontend."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import Ad, Platform, Segment, User
from ..services.ml_service import get_ml, models_loaded, _state

router = APIRouter(prefix="/meta", tags=["meta"])
DEFAULTS = {
    "platforms": ["Instagram", "Facebook", "YouTube", "Google"],
    "age_groups": ["18-24", "25-34", "35-44", "45+"],
    "genders": ["Female", "Male"],
    "interests": ["Beauty", "Fashion", "Fitness", "Home", "Tech", "Travel"],
    "devices": ["Desktop", "Mobile"],
    "location_tiers": ["Metro", "Tier-2", "Tier-3"],
    "ad_types": ["Carousel", "Image", "Text", "Video"],
    "ad_categories": ["Beauty", "Electronics", "Fashion", "Fitness", "Home"],
}


@router.get("/options")
def options(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    opts = dict(DEFAULTS)
    if models_loaded():
        opts.update(_state["meta"]["options"])
    opts["platforms"] = [p.platform_name for p in db.scalars(select(Platform).order_by(Platform.platform_id))] or opts["platforms"]
    ads = db.scalars(select(Ad).order_by(Ad.ad_id)).all()
    opts["ads"] = [{"ad_id": a.ad_id, "campaign_id": a.campaign_id, "ad_type": a.ad_type,
                    "ad_category": a.ad_category, "has_offer": a.has_offer} for a in ads]
    opts["campaigns"] = sorted({a.campaign_id for a in ads})
    opts["segments"] = [{"segment_id": s.segment_id, "segment": s.segment, "age_group": s.age_group,
                         "gender": s.gender, "interest": s.interest} for s in db.scalars(select(Segment))]
    opts["budget_range"] = _state["meta"]["budget_range"] if models_loaded() else [5000, 500000]
    return opts


@router.get("/model-status")
def model_status(_: User = Depends(get_current_user)):
    return {"models_loaded": models_loaded(), "error": _state["error"]}
