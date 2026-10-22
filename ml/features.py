"""
Shared feature definitions for AdInsight.

THIS FILE IS THE SINGLE SOURCE OF TRUTH for which columns the models use.
train.py, evaluate.py, recommend.py and the FastAPI backend all import from here,
so training and serving can never drift apart.

Rule: only columns that are known BEFORE a campaign runs may be features.
Outcomes (impressions, clicks, conversions, spend, revenue) and targets
(ctr, conversion_rate, roas) must never be features - this file asserts it.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
MODELS_DIR = Path(__file__).resolve().parent / "models"

# ---- Raw inputs known before launch -------------------------------------------
CATEGORICAL = [
    "ad_id", "ad_type", "ad_category", "platform",
    "age_group", "gender", "interest", "device", "location_tier",
]
NUMERIC_BASE = ["has_offer", "budget", "duration_days", "month", "is_festive"]

# ---- Engineered features (see add_derived) ------------------------------------
DERIVED = ["budget_per_day", "log_budget", "interest_match"]

NUMERIC = NUMERIC_BASE + DERIVED
FEATURES = CATEGORICAL + NUMERIC
# columns a caller must supply (derived ones are computed by add_derived)
BASE_INPUTS = CATEGORICAL + ["has_offer", "budget", "duration_days", "month"]

TARGETS = ["ctr", "conversion_rate", "roas"]
OUTCOMES = ["impressions", "clicks", "conversions", "spend", "revenue"]

assert not set(FEATURES) & set(OUTCOMES + TARGETS), "Leakage: outcome/target used as feature!"

# Domain knowledge: which audience interest matches which ad category
INTEREST_MATCH = {
    "Fashion": "Fashion", "Electronics": "Tech", "Beauty": "Beauty",
    "Fitness": "Fitness", "Home": "Home",
}
FESTIVE_MONTHS = [10, 11, 12]


def add_derived(df: pd.DataFrame) -> pd.DataFrame:
    """Add engineered features. Safe to call on training data and on API input."""
    df = df.copy()
    df["is_festive"] = df["month"].isin(FESTIVE_MONTHS).astype(int)
    df["budget_per_day"] = df["budget"] / df["duration_days"].clip(lower=1)
    df["log_budget"] = np.log(df["budget"].clip(lower=1))
    df["interest_match"] = (df["ad_category"].map(INTEREST_MATCH) == df["interest"]).astype(int)
    return df


def make_preprocessor(scale: bool = False) -> ColumnTransformer:
    """One-hot encode categoricals. scale=True standardises numerics (for Ridge / MLP)."""
    numeric = StandardScaler() if scale else "passthrough"
    return ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL),
        ("num", numeric, NUMERIC),
    ])


def load_data(path: Path | None = None) -> pd.DataFrame:
    path = path or DATA_DIR / "performance.csv"
    if not Path(path).exists():
        raise FileNotFoundError(f"{path} not found. Run: python ml/generate_data.py")
    df = pd.read_csv(path, parse_dates=["start_date"])
    return add_derived(df)


def time_split(df: pd.DataFrame, test_frac: float = 0.15):
    """Chronological split: older rows -> train/validation, newest rows -> test."""
    df = df.sort_values("start_date").reset_index(drop=True)
    cut = int(len(df) * (1 - test_frac))
    return df.iloc[:cut].copy(), df.iloc[cut:].copy()


def regression_metrics(y_true, y_pred) -> dict:
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
    }
