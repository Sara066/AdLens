from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import User
from ..services.analytics import aggregate, filters, load_performance, records

router = APIRouter(prefix="/compare", tags=["compare"])


@router.get("/platforms")
def compare_platforms(f: dict = Depends(filters), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Platform comparison (CTR, conversions, ROAS...) for the current filters."""
    df = load_performance(db, f)
    plat = aggregate(df, "platform")
    out = {"platforms": records(plat), "best_platform": None}
    if not plat.empty:
        out["best_platform"] = plat.iloc[0]["platform"]
        out["by_ad_type"] = records(aggregate(df, ["platform", "ad_type"]))
    return out


@router.get("/ads")
def compare_ads(ad_ids: str, f: dict = Depends(filters), db: Session = Depends(get_db),
                _: User = Depends(get_current_user)):
    """Compare 2-6 ads side by side: overall metrics plus the per-platform breakdown."""
    ids = [a.strip() for a in ad_ids.split(",") if a.strip()]
    if not 2 <= len(ids) <= 6:
        raise HTTPException(422, "Provide between 2 and 6 ad ids, comma-separated")
    f = {**f, "ad_id": ids}
    df = load_performance(db, f)
    if df.empty:
        raise HTTPException(404, "No performance data for these ads with the current filters")
    return {"ads": records(aggregate(df, "ad_id")), "by_platform": records(aggregate(df, ["ad_id", "platform"]))}
