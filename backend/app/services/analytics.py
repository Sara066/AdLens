"""Shared helpers: filtered performance query + spend-weighted aggregation."""
import json
import threading
from collections import OrderedDict
from datetime import date

import numpy as np
import pandas as pd
from fastapi import Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Ad, Performance, Platform, Segment


def records(df: pd.DataFrame) -> list[dict]:
    """DataFrame -> JSON-safe list of dicts (native types, NaN -> null)."""
    return json.loads(df.to_json(orient="records"))


def _csv(value: str | None):
    return [v.strip() for v in value.split(",") if v.strip()] if value else None


def filters(
    platform: str | None = Query(None, description="comma-separated platform names"),
    ad_id: str | None = Query(None, description="comma-separated ad ids"),
    campaign_id: str | None = None,
    ad_type: str | None = None,
    age_group: str | None = None,
    gender: str | None = None,
    interest: str | None = None,
    device: str | None = None,
    location_tier: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict:
    """FastAPI dependency used by every analytics endpoint (all filters optional)."""
    return {
        "platform": _csv(platform), "ad_id": _csv(ad_id), "campaign_id": _csv(campaign_id),
        "ad_type": _csv(ad_type), "age_group": _csv(age_group), "gender": _csv(gender),
        "interest": _csv(interest), "device": _csv(device), "location_tier": _csv(location_tier),
        "date_from": date_from, "date_to": date_to,
    }


def _query_performance(db: Session, f: dict) -> pd.DataFrame:
    cols = list(Performance.__table__.c) + [
        Platform.platform_name.label("platform"), Segment.segment.label("segment"),
        Ad.ad_type, Ad.ad_category, Ad.campaign_id, Ad.has_offer,
    ]
    stmt = (select(*cols)
            .join(Platform, Performance.platform_id == Platform.platform_id)
            .join(Segment, Performance.segment_id == Segment.segment_id)
            .join(Ad, Performance.ad_id == Ad.ad_id))
    if f.get("platform"):      stmt = stmt.where(Platform.platform_name.in_(f["platform"]))
    if f.get("ad_id"):         stmt = stmt.where(Performance.ad_id.in_(f["ad_id"]))
    if f.get("campaign_id"):   stmt = stmt.where(Ad.campaign_id.in_(f["campaign_id"]))
    if f.get("ad_type"):       stmt = stmt.where(Ad.ad_type.in_(f["ad_type"]))
    if f.get("age_group"):     stmt = stmt.where(Performance.age_group.in_(f["age_group"]))
    if f.get("gender"):        stmt = stmt.where(Performance.gender.in_(f["gender"]))
    if f.get("interest"):      stmt = stmt.where(Performance.interest.in_(f["interest"]))
    if f.get("device"):        stmt = stmt.where(Performance.device.in_(f["device"]))
    if f.get("location_tier"): stmt = stmt.where(Performance.location_tier.in_(f["location_tier"]))
    if f.get("date_from"):     stmt = stmt.where(Performance.start_date >= f["date_from"])
    if f.get("date_to"):       stmt = stmt.where(Performance.start_date <= f["date_to"])
    df = pd.read_sql(stmt, db.connection())
    df["start_date"] = pd.to_datetime(df["start_date"])
    return df


# ---- small in-memory cache: the dashboard fires ~6 requests with identical filters at once ----
_cache: "OrderedDict[str, pd.DataFrame]" = OrderedDict()
_cache_lock = threading.Lock()
MAX_CACHED = 6


def invalidate_cache():
    """Call after any admin change to ads / performance rows."""
    with _cache_lock:
        _cache.clear()


def load_performance(db: Session, f: dict | None = None) -> pd.DataFrame:
    """Filtered performance rows joined with ad / platform / segment info. Treat the result as read-only."""
    f = f or {}
    key = json.dumps({k: v for k, v in f.items() if v}, sort_keys=True, default=str)
    with _cache_lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]
        df = _query_performance(db, f)
        _cache[key] = df
        if len(_cache) > MAX_CACHED:
            _cache.popitem(last=False)
        return df


def _ratios(spend, revenue, impressions, clicks, conversions) -> dict:
    """Spend-weighted ratios (NOT averages of per-row ratios)."""
    div = lambda a, b: float(a / b) if b else 0.0   # noqa: E731
    return {
        "ctr": div(clicks, impressions),
        "conversion_rate": div(conversions, clicks),
        "roas": div(revenue, spend),
        "cpa": div(spend, conversions),
        "cpc": div(spend, clicks),
    }


def kpis(df: pd.DataFrame) -> dict:
    s = df[["spend", "revenue", "impressions", "clicks", "conversions"]].sum()
    return {
        "flights": int(len(df)),
        "campaigns": int(df["campaign_id"].nunique()) if len(df) else 0,
        "ads": int(df["ad_id"].nunique()) if len(df) else 0,
        "spend": float(s["spend"]), "revenue": float(s["revenue"]),
        "impressions": int(s["impressions"]), "clicks": int(s["clicks"]), "conversions": int(s["conversions"]),
        **_ratios(s["spend"], s["revenue"], s["impressions"], s["clicks"], s["conversions"]),
    }


def aggregate(df: pd.DataFrame, by: str | list[str]) -> pd.DataFrame:
    """Group and compute spend-weighted metrics; sorted by ROAS descending."""
    if df.empty:
        return pd.DataFrame()
    g = df.groupby(by).agg(
        flights=("performance_id", "count"), spend=("spend", "sum"), revenue=("revenue", "sum"),
        impressions=("impressions", "sum"), clicks=("clicks", "sum"), conversions=("conversions", "sum"),
    ).reset_index()
    g["ctr"] = np.where(g.impressions > 0, g.clicks / g.impressions.where(g.impressions > 0), 0)
    g["conversion_rate"] = np.where(g.clicks > 0, g.conversions / g.clicks.where(g.clicks > 0), 0)
    g["roas"] = np.where(g.spend > 0, g.revenue / g.spend.where(g.spend > 0), 0)
    g["cpa"] = np.where(g.conversions > 0, g.spend / g.conversions.where(g.conversions > 0), 0)
    return g.sort_values("roas", ascending=False).reset_index(drop=True)
