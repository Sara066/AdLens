from pydantic import BaseModel, Field


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(min_length=5, max_length=150)
    password: str = Field(min_length=6, max_length=100)
    role: str = "Analyst"            # self-registration allows Manager / Analyst only


class LoginIn(BaseModel):
    email: str
    password: str


class UserCreate(RegisterIn):
    role: str = "Analyst"            # Admin may create any role


class AudienceIn(BaseModel):
    age_group: str
    gender: str
    interest: str
    device: str = "Mobile"
    location_tier: str = "Metro"
    budget: float = Field(40_000, ge=1_000, le=5_000_000)
    duration_days: int = Field(14, ge=1, le=90)
    month: int | None = Field(None, ge=1, le=12)     # planned launch month; defaults to current month


class PredictIn(AudienceIn):
    ad_id: str
    platform: str


class RecommendIn(AudienceIn):
    top_n: int = Field(10, ge=1, le=50)
    platforms: list[str] | None = None


class RecommendPlatformIn(AudienceIn):
    ad_id: str


class AdIn(BaseModel):
    ad_id: str = Field(min_length=3, max_length=20)
    campaign_id: str
    ad_type: str
    ad_category: str
    has_offer: int = Field(0, ge=0, le=1)


class AdUpdate(BaseModel):
    campaign_id: str | None = None
    ad_type: str | None = None
    ad_category: str | None = None
    has_offer: int | None = Field(None, ge=0, le=1)
