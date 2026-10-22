import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import Ad, User
from ..schemas import RecommendIn, RecommendPlatformIn
from ..services.analytics import records
from ..services.ml_service import get_ml
from .predict import check_choice
from ml.recommend import recommend as run_recommend

router = APIRouter(prefix="/recommend", tags=["recommend"])


def _ads_df(db: Session, only: str | None = None) -> pd.DataFrame:
    q = select(Ad.ad_id, Ad.ad_type, Ad.ad_category, Ad.has_offer)
    if only:
        q = q.where(Ad.ad_id == only)
    df = pd.read_sql(q, db.connection())
    if df.empty:
        raise HTTPException(404, "No ads found")
    return df


def _validate(body, meta):
    o = meta["options"]
    check_choice(body.age_group, o["age_groups"], "age_group")
    check_choice(body.gender, o["genders"], "gender")
    check_choice(body.interest, o["interests"], "interest")
    check_choice(body.device, o["devices"], "device")
    check_choice(body.location_tier, o["location_tiers"], "location_tier")


def _run(body, ads, models, meta, top_n):
    return run_recommend(
        models, meta, ads, {"age_group": body.age_group, "gender": body.gender, "interest": body.interest},
        budget=body.budget, duration_days=body.duration_days, month=body.month,
        device=body.device, location_tier=body.location_tier,
        platforms=getattr(body, "platforms", None), top_n=top_n,
    )


@router.post("")
def recommend_ads(body: RecommendIn, db: Session = Depends(get_db), _: User = Depends(get_current_user),
                  ml=Depends(get_ml)):
    """Best ad (and platform) for a target audience: ranks every ad x platform by predicted ROAS."""
    models, meta = ml
    _validate(body, meta)
    res = _run(body, _ads_df(db), models, meta, body.top_n)
    return {
        "best": records(pd.DataFrame([res["best"]]))[0],
        "ranking": records(res["ranking"]),
        "best_by_platform": records(res["best_by_platform"]),
        "best_by_ad": records(res["best_by_ad"].head(body.top_n)),
    }


@router.post("/platform")
def recommend_platform(body: RecommendPlatformIn, db: Session = Depends(get_db),
                       _: User = Depends(get_current_user), ml=Depends(get_ml)):
    """Best platform for ONE chosen ad and audience."""
    models, meta = ml
    _validate(body, meta)
    res = _run(body, _ads_df(db, body.ad_id), models, meta, 10)
    plats = res["best_by_platform"]
    return {"ad_id": body.ad_id, "best_platform": plats.iloc[0]["platform"], "platforms": records(plats)}
