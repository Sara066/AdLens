from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import User
from ..services.analytics import aggregate, filters, kpis, load_performance, records

router = APIRouter(prefix="/reports", tags=["reports"])


def _report(db, f):
    df = load_performance(db, f)
    camp = aggregate(df, "campaign_id").sort_values("campaign_id") if not df.empty else df
    return df, camp


@router.get("/campaigns")
def campaign_report(f: dict = Depends(filters), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    """Per-campaign performance report for the selected filters / date range."""
    df, camp = _report(db, f)
    return {"totals": kpis(df), "campaigns": records(camp),
            "by_platform": records(aggregate(df, "platform")) if not df.empty else [],
            "top_ads": records(aggregate(df, "ad_id").head(5)) if not df.empty else []}


@router.get("/campaigns.csv")
def campaign_report_csv(f: dict = Depends(filters), db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    _, camp = _report(db, f)
    csv = camp.round(4).to_csv(index=False) if not camp.empty else "campaign_id\n"
    return Response(csv, media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=campaign_report.csv"})
