"""Database tables (match the SRS: User, Advertisement, Platform, Customer segment,
Campaign performance, Prediction)."""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class User(Base):
    __tablename__ = "users"
    user_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(300))
    role: Mapped[str] = mapped_column(String(20), default="Analyst")   # Manager / Analyst / Admin
    token: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)


class Ad(Base):
    __tablename__ = "ads"
    ad_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    campaign_id: Mapped[str] = mapped_column(String(20), index=True)
    ad_type: Mapped[str] = mapped_column(String(20))
    ad_category: Mapped[str] = mapped_column(String(30))
    has_offer: Mapped[int] = mapped_column(Integer, default=0)


class Platform(Base):
    __tablename__ = "platforms"
    platform_id: Mapped[int] = mapped_column(primary_key=True)
    platform_name: Mapped[str] = mapped_column(String(30), unique=True)
    platform_type: Mapped[str] = mapped_column(String(20))


class Segment(Base):
    __tablename__ = "segments"
    segment_id: Mapped[int] = mapped_column(primary_key=True)
    segment: Mapped[str] = mapped_column(String(80), unique=True)
    age_group: Mapped[str] = mapped_column(String(10))
    gender: Mapped[str] = mapped_column(String(10))
    interest: Mapped[str] = mapped_column(String(20))


class Performance(Base):
    __tablename__ = "performance"
    performance_id: Mapped[int] = mapped_column(primary_key=True)
    ad_id: Mapped[str] = mapped_column(ForeignKey("ads.ad_id"), index=True)
    platform_id: Mapped[int] = mapped_column(ForeignKey("platforms.platform_id"), index=True)
    segment_id: Mapped[int] = mapped_column(ForeignKey("segments.segment_id"), index=True)
    age_group: Mapped[str] = mapped_column(String(10))
    gender: Mapped[str] = mapped_column(String(10))
    interest: Mapped[str] = mapped_column(String(20))
    device: Mapped[str] = mapped_column(String(10))
    location_tier: Mapped[str] = mapped_column(String(10))
    budget: Mapped[float] = mapped_column(Float)
    duration_days: Mapped[int] = mapped_column(Integer)
    start_date: Mapped[date] = mapped_column(Date, index=True)
    month: Mapped[int] = mapped_column(Integer)
    is_festive: Mapped[int] = mapped_column(Integer)
    impressions: Mapped[int] = mapped_column(Integer)
    clicks: Mapped[int] = mapped_column(Integer)
    conversions: Mapped[int] = mapped_column(Integer)
    spend: Mapped[float] = mapped_column(Float)
    revenue: Mapped[float] = mapped_column(Float)
    ctr: Mapped[float] = mapped_column(Float)
    conversion_rate: Mapped[float] = mapped_column(Float)
    roas: Mapped[float] = mapped_column(Float)


class Prediction(Base):
    __tablename__ = "predictions"
    prediction_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    ad_id: Mapped[str] = mapped_column(String(20))
    platform_id: Mapped[int] = mapped_column(Integer)
    segment_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    budget: Mapped[float] = mapped_column(Float)
    predicted_ctr: Mapped[float] = mapped_column(Float)
    predicted_conversion: Mapped[float] = mapped_column(Float)
    predicted_roas: Mapped[float] = mapped_column(Float)
    prediction_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
