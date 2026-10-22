"""
AdInsight - synthetic data generator
====================================
Each row = one ad flight: one ad, shown on one platform, to one audience
segment, for a given budget and duration.

INPUT features (known BEFORE the campaign runs - safe for ML):
    ad_id, ad_type, ad_category, has_offer, platform, age_group, gender,
    interest, device, location_tier, budget, duration_days, start_date,
    month, is_festive

OUTCOMES (known only AFTER - NEVER use as model inputs):
    impressions, clicks, conversions, spend, revenue

TARGETS (what the models predict):
    ctr, conversion_rate, roas

The "hidden rules" below are the ground truth the models must discover.
Document them in your report as the assumptions used to simulate data.

Usage (from project root):  python ml/generate_data.py   -> writes <root>/data/*.csv
"""
import os
from pathlib import Path
import numpy as np
import pandas as pd

SEED = 42
N_ROWS = 60_000
N_ADS = 30
rng = np.random.default_rng(SEED)

# ----------------------------------------------------------------------------
# Dimensions
# ----------------------------------------------------------------------------
PLATFORMS = ["Instagram", "Facebook", "YouTube", "Google"]
PLATFORM_TYPE = {"Instagram": "Social", "Facebook": "Social",
                 "YouTube": "Video", "Google": "Search"}
PLATFORM_P = [0.30, 0.25, 0.20, 0.25]          # share of flights

AGE_GROUPS = ["18-24", "25-34", "35-44", "45+"]
GENDERS = ["Male", "Female"]
INTERESTS = ["Fashion", "Tech", "Beauty", "Fitness", "Home", "Travel"]
DEVICES = ["Mobile", "Desktop"]
LOCATIONS = ["Metro", "Tier-2", "Tier-3"]
AD_TYPES = ["Image", "Video", "Carousel", "Text"]
CATEGORIES = ["Fashion", "Electronics", "Beauty", "Fitness", "Home"]

# ad category -> the audience interest that "matches" it
MATCH = {"Fashion": "Fashion", "Electronics": "Tech", "Beauty": "Beauty",
         "Fitness": "Fitness", "Home": "Home"}

# ----------------------------------------------------------------------------
# Hidden rules (log-odds effects; positive = better)
# ----------------------------------------------------------------------------
def logit(p): return np.log(p / (1 - p))
def sigmoid(x): return 1 / (1 + np.exp(-x))

BASE_CTR = {"Instagram": 0.013, "Facebook": 0.009, "YouTube": 0.005, "Google": 0.022}
BASE_CVR = {"Instagram": 0.022, "Facebook": 0.020, "YouTube": 0.024, "Google": 0.026}
CPM = {"Instagram": 180, "Facebook": 140, "YouTube": 120, "Google": 250}   # INR

# ad type x platform (CTR)
TYPE_PLAT_CTR = {
    ("Video", "Instagram"): .35, ("Video", "Facebook"): .10, ("Video", "YouTube"): .45, ("Video", "Google"): -.20,
    ("Text", "Instagram"): -.35, ("Text", "Facebook"): -.20, ("Text", "YouTube"): -.60, ("Text", "Google"): .40,
    ("Image", "Instagram"): .10, ("Image", "Facebook"): .20, ("Image", "YouTube"): -.30, ("Image", "Google"): 0.0,
    ("Carousel", "Instagram"): .30, ("Carousel", "Facebook"): .30, ("Carousel", "YouTube"): -.50, ("Carousel", "Google"): -.30,
}
# age x platform (CTR)
AGE_PLAT_CTR = {
    ("18-24", "Instagram"): .35, ("18-24", "Facebook"): -.35, ("18-24", "YouTube"): .30, ("18-24", "Google"): 0.0,
    ("25-34", "Instagram"): .10, ("25-34", "Facebook"): 0.0, ("25-34", "YouTube"): .10, ("25-34", "Google"): .10,
    ("35-44", "Instagram"): -.20, ("35-44", "Facebook"): .25, ("35-44", "YouTube"): -.05, ("35-44", "Google"): .10,
    ("45+", "Instagram"): -.50, ("45+", "Facebook"): .30, ("45+", "YouTube"): -.20, ("45+", "Google"): 0.0,
}
# gender x ad category (CTR)
GENDER_CAT_CTR = {("Female", "Beauty"): .30, ("Female", "Fashion"): .20,
                  ("Male", "Electronics"): .25, ("Male", "Fitness"): .15}
# conversion: category (pricey items convert less), device x platform, location
CAT_CVR = {"Fashion": 0.0, "Electronics": -0.7, "Beauty": 0.2, "Fitness": -0.1, "Home": -0.3}
DEV_PLAT_CVR = {("Desktop", "Google"): .25, ("Desktop", "Facebook"): .25,
                ("Mobile", "Instagram"): .10, ("Mobile", "YouTube"): .05}
LOC_CTR = {"Metro": -0.05, "Tier-2": 0.0, "Tier-3": 0.10}
LOC_CVR = {"Metro": 0.15, "Tier-2": 0.0, "Tier-3": -0.20}
LOC_AOV = {"Metro": 1.2, "Tier-2": 1.0, "Tier-3": 0.8}
AOV_BASE = {"Fashion": 1200, "Electronics": 3300, "Beauty": 800, "Fitness": 1400, "Home": 2100}

# ----------------------------------------------------------------------------
# Ad master table (hidden creative quality per ad)
# ----------------------------------------------------------------------------
ads = pd.DataFrame({
    "ad_id": [f"AD_{101 + i}" for i in range(N_ADS)],
    "ad_type": rng.choice(AD_TYPES, N_ADS),
    "ad_category": rng.choice(CATEGORIES, N_ADS),
    "has_offer": rng.choice([0, 1], N_ADS, p=[0.55, 0.45]),
})
ads["campaign_id"] = [f"CMP_{(i // 3) + 1:02d}" for i in range(N_ADS)]
quality_ctr = dict(zip(ads.ad_id, rng.normal(0, 0.30, N_ADS)))   # hidden
quality_cvr = dict(zip(ads.ad_id, rng.normal(0, 0.25, N_ADS)))   # hidden

# ----------------------------------------------------------------------------
# Sample flights
# ----------------------------------------------------------------------------
df = pd.DataFrame({
    "ad_id": rng.choice(ads.ad_id, N_ROWS),
    "platform": rng.choice(PLATFORMS, N_ROWS, p=PLATFORM_P),
    "age_group": rng.choice(AGE_GROUPS, N_ROWS, p=[.28, .34, .24, .14]),
    "gender": rng.choice(GENDERS, N_ROWS),
    "interest": rng.choice(INTERESTS, N_ROWS),
    "device": rng.choice(DEVICES, N_ROWS, p=[.72, .28]),
    "location_tier": rng.choice(LOCATIONS, N_ROWS, p=[.40, .35, .25]),
})
df = df.merge(ads, on="ad_id", how="left")

df["budget"] = np.clip(rng.lognormal(np.log(40_000), 0.9, N_ROWS), 5_000, 500_000).round(-2)
df["duration_days"] = rng.integers(3, 31, N_ROWS)
start = pd.Timestamp("2025-01-01")
df["start_date"] = start + pd.to_timedelta(rng.integers(0, 640, N_ROWS), unit="D")   # to ~Sep 2026
df["month"] = df.start_date.dt.month
df["is_festive"] = df.month.isin([10, 11, 12]).astype(int)

# ----------------------------------------------------------------------------
# Ground-truth CTR and conversion rate
# ----------------------------------------------------------------------------
match = (df.ad_category.map(MATCH) == df.interest).astype(int)
lb = np.log(df.budget / 40_000)

z_ctr = (
    df.platform.map(lambda p: logit(BASE_CTR[p]))
    + [TYPE_PLAT_CTR[(t, p)] for t, p in zip(df.ad_type, df.platform)]
    + [AGE_PLAT_CTR[(a, p)] for a, p in zip(df.age_group, df.platform)]
    + [GENDER_CAT_CTR.get((g, c), 0.0) for g, c in zip(df.gender, df.ad_category)]
    + 0.5 * match
    + 0.2 * df.has_offer
    + 0.10 * df.is_festive
    + df.location_tier.map(LOC_CTR)
    + df.ad_id.map(quality_ctr)
    - 0.08 * lb
    + rng.normal(0, 0.15, N_ROWS)
)
true_ctr = sigmoid(z_ctr)

z_cvr = (
    df.platform.map(lambda p: logit(BASE_CVR[p]))
    + df.ad_category.map(CAT_CVR)
    + [DEV_PLAT_CVR.get((d, p), 0.0) for d, p in zip(df.device, df.platform)]
    + df.location_tier.map(LOC_CVR)
    + 0.3 * match
    + 0.3 * df.has_offer
    + 0.25 * df.is_festive
    + df.ad_id.map(quality_cvr)
    - 0.05 * lb
    + rng.normal(0, 0.20, N_ROWS)
)
true_cvr = sigmoid(z_cvr)

# ----------------------------------------------------------------------------
# Simulate outcomes
# ----------------------------------------------------------------------------
cpm = df.platform.map(CPM) * np.where(df.is_festive == 1, 1.3, 1.0) * rng.normal(1, 0.08, N_ROWS)
df["spend"] = (df.budget * rng.uniform(0.85, 1.0, N_ROWS)).round(2)
df["impressions"] = (df.spend / cpm * 1000).astype(int)
df["clicks"] = rng.binomial(df.impressions, true_ctr)
df["conversions"] = rng.binomial(df.clicks, true_cvr)

aov = (df.ad_category.map(AOV_BASE) * df.location_tier.map(LOC_AOV)
       * np.where(df.has_offer == 1, 0.85, 1.0) * rng.lognormal(0, 0.10, N_ROWS))
noise = np.exp(rng.normal(0, 0.25 / np.sqrt(np.maximum(df.conversions, 1))))
df["revenue"] = (df.conversions * aov * noise).round(2)

# Targets
df["ctr"] = df.clicks / df.impressions
df["conversion_rate"] = np.where(df.clicks > 0, df.conversions / df.clicks.clip(lower=1), 0.0)
df["roas"] = df.revenue / df.spend

df["segment"] = df.age_group + " | " + df.gender + " | " + df.interest
df = df.sort_values("start_date").reset_index(drop=True)
df.insert(0, "performance_id", np.arange(1, len(df) + 1))

# ----------------------------------------------------------------------------
# Write CSVs (match the SRS database tables)
# ----------------------------------------------------------------------------
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
os.makedirs(DATA_DIR, exist_ok=True)

platform_tbl = pd.DataFrame({
    "platform_id": range(1, len(PLATFORMS) + 1),
    "platform_name": PLATFORMS,
    "platform_type": [PLATFORM_TYPE[p] for p in PLATFORMS],
})
segments = (df[["segment", "age_group", "gender", "interest"]]
            .drop_duplicates().sort_values("segment").reset_index(drop=True))
segments.insert(0, "segment_id", range(1, len(segments) + 1))

ads.to_csv(DATA_DIR / "ads.csv", index=False)
platform_tbl.to_csv(DATA_DIR / "platforms.csv", index=False)
segments.to_csv(DATA_DIR / "segments.csv", index=False)
df.to_csv(DATA_DIR / "performance.csv", index=False)

# ----------------------------------------------------------------------------
# Sanity summary
# ----------------------------------------------------------------------------
tot = df[["spend", "revenue", "clicks", "impressions", "conversions"]].sum()
print(f"Rows: {len(df):,} | Ads: {N_ADS} | Segments: {len(segments)}")
print(f"Overall CTR {tot.clicks / tot.impressions:.2%} | "
      f"Conv rate {tot.conversions / tot.clicks:.2%} | ROAS {tot.revenue / tot.spend:.2f}")
print("\nROAS by platform (spend-weighted):")
g = df.groupby("platform")[["spend", "revenue"]].sum()
print((g.revenue / g.spend).round(2).to_string())
print("\nRows with zero conversions: "
      f"{(df.conversions == 0).mean():.1%}  (ROAS is noisy for small flights - expected)")
