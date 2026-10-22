"""Load the generated CSVs into the database and create demo users."""
import pandas as pd
from sqlalchemy import func, insert, select
from sqlalchemy.orm import Session

from .auth import hash_password
from .config import DATA_DIR
from .models import Ad, Performance, Platform, Segment, User

DEMO_USERS = [
    ("Admin", "admin@adinsight.com", "admin123", "Admin"),
    ("Priya Kulkarni", "manager@adinsight.com", "manager123", "Manager"),
    ("Arjun Mehta", "analyst@adinsight.com", "analyst123", "Analyst"),
]


def seed_users(db: Session):
    if db.scalar(select(func.count()).select_from(User)):
        return
    for name, email, pw, role in DEMO_USERS:
        db.add(User(name=name, email=email, password_hash=hash_password(pw), role=role))
    db.commit()


def seed_data(db: Session) -> bool:
    """Returns False if the CSVs have not been generated yet."""
    if not (DATA_DIR / "performance.csv").exists():
        return False
    ads = pd.read_csv(DATA_DIR / "ads.csv")
    platforms = pd.read_csv(DATA_DIR / "platforms.csv")
    segments = pd.read_csv(DATA_DIR / "segments.csv")
    perf = pd.read_csv(DATA_DIR / "performance.csv", parse_dates=["start_date"])

    db.execute(insert(Platform), platforms.to_dict("records"))
    db.execute(insert(Segment), segments.to_dict("records"))
    db.execute(insert(Ad), ads[["ad_id", "campaign_id", "ad_type", "ad_category", "has_offer"]].to_dict("records"))

    plat_id = dict(zip(platforms.platform_name, platforms.platform_id))
    seg_id = dict(zip(segments.segment, segments.segment_id))
    perf["platform_id"] = perf["platform"].map(plat_id)
    perf["segment_id"] = perf["segment"].map(seg_id)
    perf["start_date"] = perf["start_date"].dt.date
    cols = ["performance_id", "ad_id", "platform_id", "segment_id", "age_group", "gender", "interest",
            "device", "location_tier", "budget", "duration_days", "start_date", "month", "is_festive",
            "impressions", "clicks", "conversions", "spend", "revenue", "ctr", "conversion_rate", "roas"]
    records = perf[cols].to_dict("records")
    for i in range(0, len(records), 5000):
        db.execute(insert(Performance), records[i:i + 5000])
    db.commit()
    return True


def seed_if_empty(db: Session) -> dict:
    seed_users(db)
    loaded = False
    if not db.scalar(select(func.count()).select_from(Performance)):
        loaded = seed_data(db)
    return {"data_loaded": loaded}
