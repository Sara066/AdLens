from datetime import date

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import Ad, Platform, Prediction, Segment, User
from ..schemas import PredictIn
from ..services.analytics import kpis, load_performance
from ..services.ml_service import get_ml
from ml.recommend import predict_rows

router = APIRouter(prefix="/predict", tags=["predict"])


def check_choice(value: str, allowed: list[str], field: str):
    if value not in allowed:
        raise HTTPException(422, f"Invalid {field} '{value}'. Allowed: {allowed}")


@router.post("")
def predict(body: PredictIn, db: Session = Depends(get_db), user: User = Depends(get_current_user),
            ml=Depends(get_ml)):
    models, meta = ml
    o = meta["options"]
    ad = db.get(Ad, body.ad_id)
    if ad is None:
        raise HTTPException(404, f"Unknown ad '{body.ad_id}'")
    platform = db.scalar(select(Platform).where(Platform.platform_name == body.platform))
    if platform is None:
        raise HTTPException(404, f"Unknown platform '{body.platform}'")
    check_choice(body.age_group, o["age_groups"], "age_group")
    check_choice(body.gender, o["genders"], "gender")
    check_choice(body.interest, o["interests"], "interest")
    check_choice(body.device, o["devices"], "device")
    check_choice(body.location_tier, o["location_tiers"], "location_tier")

    month = body.month or date.today().month
    row = pd.DataFrame([{
        "ad_id": ad.ad_id, "ad_type": ad.ad_type, "ad_category": ad.ad_category, "has_offer": ad.has_offer,
        "platform": body.platform, "age_group": body.age_group, "gender": body.gender,
        "interest": body.interest, "device": body.device, "location_tier": body.location_tier,
        "budget": body.budget, "duration_days": body.duration_days, "month": month,
    }])
    p = predict_rows(models, meta, row).iloc[0]

    seg = db.scalar(select(Segment).where(Segment.age_group == body.age_group, Segment.gender == body.gender,
                                          Segment.interest == body.interest))
    db.add(Prediction(user_id=user.user_id, ad_id=ad.ad_id, platform_id=platform.platform_id,
                      segment_id=seg.segment_id if seg else None, budget=body.budget,
                      predicted_ctr=float(p.pred_ctr), predicted_conversion=float(p.pred_cvr),
                      predicted_roas=float(p.pred_roas)))
    db.commit()

    # historical benchmarks so the UI can say "better / worse than average"
    allrows = load_performance(db)
    k_all, k_plat = kpis(allrows), kpis(allrows[allrows["platform"] == body.platform])
    return {
        "prediction": {
            "ctr": float(p.pred_ctr), "conversion_rate": float(p.pred_cvr), "roas": float(p.pred_roas),
            "expected_clicks": float(p.expected_clicks), "expected_conversions": float(p.expected_conversions),
            "expected_revenue": float(p.expected_revenue),
        },
        "benchmark": {
            "platform_average": {k: k_plat[k] for k in ("ctr", "conversion_rate", "roas")},
            "overall_average": {k: k_all[k] for k in ("ctr", "conversion_rate", "roas")},
        },
        "input": {**body.model_dump(), "month": month, "ad_type": ad.ad_type, "ad_category": ad.ad_category,
                  "has_offer": ad.has_offer},
        "note": "Estimates from a model trained on historical data; actual results may differ.",
    }


@router.get("/history")
def history(limit: int = 20, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.scalars(select(Prediction).where(Prediction.user_id == user.user_id)
                      .order_by(Prediction.prediction_date.desc()).limit(min(limit, 100))).all()
    names = {p.platform_id: p.platform_name for p in db.scalars(select(Platform))}
    return [{"prediction_id": r.prediction_id, "ad_id": r.ad_id, "platform": names.get(r.platform_id),
             "budget": r.budget, "ctr": r.predicted_ctr, "conversion_rate": r.predicted_conversion,
             "roas": r.predicted_roas, "date": r.prediction_date.isoformat()} for r in rows]
