import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import User
from ..services.analytics import aggregate, filters, kpis, load_performance, records

router = APIRouter(prefix="/metrics", tags=["metrics"])

DIMENSIONS = {"segment", "age_group", "gender", "interest", "location_tier", "device",
              "ad_type", "ad_category", "platform", "campaign_id"}


@router.get("/summary")
def summary(f: dict = Depends(filters), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Dashboard KPI cards + the current best platform / ad / segment."""
    df = load_performance(db, f)
    out = {"kpis": kpis(df), "best": {}}
    if not df.empty:
        for key, col in [("platform", "platform"), ("ad", "ad_id"), ("segment", "segment")]:
            agg = aggregate(df, col)
            if key != "platform":
                agg = agg[agg.spend >= agg.spend.quantile(0.5)]      # ignore tiny-spend groups
            top = agg.iloc[0]
            out["best"][key] = {"name": top[col], "roas": float(top["roas"]), "ctr": float(top["ctr"])}
    return out


@router.get("/platforms")
def platforms(f: dict = Depends(filters), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return records(aggregate(load_performance(db, f), "platform"))


@router.get("/segments")
def segments(dimension: str = "segment", limit: int = Query(100, ge=1, le=500),
             f: dict = Depends(filters), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if dimension not in DIMENSIONS:
        raise HTTPException(422, f"dimension must be one of {sorted(DIMENSIONS)}")
    return records(aggregate(load_performance(db, f), dimension).head(limit))


@router.get("/top-ads")
def top_ads(limit: int = Query(10, ge=1, le=100), f: dict = Depends(filters),
            db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    df = load_performance(db, f)
    if df.empty:
        return []
    agg = aggregate(df, "ad_id")
    attrs = df[["ad_id", "ad_type", "ad_category", "campaign_id", "has_offer"]].drop_duplicates("ad_id")
    return records(agg.merge(attrs, on="ad_id").head(limit))


@router.get("/trend")
def trend(f: dict = Depends(filters), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Monthly spend / revenue / ROAS by launch month."""
    df = load_performance(db, f)
    if df.empty:
        return []
    df = df.assign(period=df["start_date"].dt.to_period("M").astype(str))
    out = aggregate(df, "period").sort_values("period")
    return records(out)


@router.get("/matrix")
def matrix(row: str = "age_group", col: str = "platform", metric: str = "roas",
           f: dict = Depends(filters), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Cross-tab for heatmaps, e.g. ROAS by age_group x platform."""
    if row not in DIMENSIONS or col not in DIMENSIONS or row == col:
        raise HTTPException(422, f"row/col must be different values of {sorted(DIMENSIONS)}")
    if metric not in {"roas", "ctr", "conversion_rate", "spend", "revenue", "cpa"}:
        raise HTTPException(422, "metric must be one of roas, ctr, conversion_rate, spend, revenue, cpa")
    df = load_performance(db, f)
    if df.empty:
        return {"rows": [], "cols": [], "values": []}
    agg = aggregate(df, [row, col])
    pt = agg.pivot(index=row, columns=col, values=metric).sort_index()
    pt = pt.reindex(sorted(pt.columns), axis=1).astype(object).where(pd.notna(pt), None)
    return {"rows": pt.index.tolist(), "cols": pt.columns.tolist(), "metric": metric,
            "values": [[None if v is None else float(v) for v in r] for r in pt.values.tolist()]}
