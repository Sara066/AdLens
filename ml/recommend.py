"""
Prediction + recommendation engine (used by evaluate.py and by the FastAPI backend).

    models, meta = load_models()
    predict_rows(models, meta, df)                     -> adds pred_ctr / pred_cvr / pred_roas ...
    recommend(models, meta, ads_df, segment, ...)      -> ranked ad x platform combinations
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import joblib
import numpy as np
import pandas as pd

from ml.features import BASE_INPUTS, FEATURES, MODELS_DIR, add_derived

DELIVERY_RATIO = 0.92   # average share of the budget that actually gets spent (from the data)


class ModelsNotTrained(RuntimeError):
    pass


def load_models(models_dir: Path | None = None):
    """Load the three saved pipelines and meta.json. Returns (models_dict, meta_dict)."""
    models_dir = Path(models_dir or MODELS_DIR)
    meta_path = models_dir / "meta.json"
    if not meta_path.exists():
        raise ModelsNotTrained("Models not found. Run: python ml/train.py")
    models = {
        "ctr": joblib.load(models_dir / "ctr.joblib"),
        "cvr": joblib.load(models_dir / "conversion_rate.joblib"),
        "roas": joblib.load(models_dir / "roas.joblib"),
    }
    return models, json.loads(meta_path.read_text())


def predict_rows(models: dict, meta: dict, df: pd.DataFrame) -> pd.DataFrame:
    """
    df must contain the BASE_INPUTS columns. Returns a copy with:
    pred_ctr, pred_cvr, pred_roas, expected_clicks, expected_conversions, expected_revenue.
    """
    missing = [c for c in BASE_INPUTS if c not in df.columns]
    if missing:
        raise ValueError(f"Missing input columns: {missing}")
    out = add_derived(df)
    X = out[FEATURES]
    out["pred_ctr"] = np.clip(models["ctr"].predict(X), 0, 1)
    out["pred_cvr"] = np.clip(models["cvr"].predict(X), 0, 1)
    out["pred_roas"] = np.clip(models["roas"].predict(X), 0, None)

    cpm = out["platform"].map(meta["platform_cpm"]).fillna(np.mean(list(meta["platform_cpm"].values())))
    impressions = out["budget"] * DELIVERY_RATIO / cpm * 1000
    out["expected_clicks"] = impressions * out["pred_ctr"]
    out["expected_conversions"] = out["expected_clicks"] * out["pred_cvr"]
    out["expected_revenue"] = out["budget"] * DELIVERY_RATIO * out["pred_roas"]
    return out


def build_candidates(ads: pd.DataFrame, platforms: list[str], segment: dict, *,
                     budget: float, duration_days: int, month: int,
                     device: str, location_tier: str) -> pd.DataFrame:
    """Cross every ad with every platform for one audience segment."""
    ads = ads[["ad_id", "ad_type", "ad_category", "has_offer"]].copy()
    cand = ads.merge(pd.DataFrame({"platform": platforms}), how="cross")
    cand["age_group"] = segment["age_group"]
    cand["gender"] = segment["gender"]
    cand["interest"] = segment["interest"]
    cand["device"] = device
    cand["location_tier"] = location_tier
    cand["budget"] = float(budget)
    cand["duration_days"] = int(duration_days)
    cand["month"] = int(month)
    return cand


def recommend(models, meta, ads: pd.DataFrame, segment: dict, *, budget=40_000,
              duration_days=14, month=None, device="Mobile", location_tier="Metro",
              platforms: list[str] | None = None, top_n: int = 10) -> dict:
    """
    Rank all (ad, platform) combinations for the segment by predicted ROAS.
    Returns {"ranking": DataFrame, "best": dict, "best_by_platform": DataFrame, "best_by_ad": DataFrame}
    """
    month = month or pd.Timestamp.today().month
    platforms = platforms or meta["options"]["platforms"]
    cand = build_candidates(ads, platforms, segment, budget=budget, duration_days=duration_days,
                            month=month, device=device, location_tier=location_tier)
    scored = predict_rows(models, meta, cand).sort_values("pred_roas", ascending=False).reset_index(drop=True)
    scored.insert(0, "rank", np.arange(1, len(scored) + 1))

    keep = ["rank", "ad_id", "ad_type", "ad_category", "platform", "pred_ctr", "pred_cvr",
            "pred_roas", "expected_conversions", "expected_revenue"]
    return {
        "ranking": scored[keep].head(top_n),
        "best": scored.iloc[0][keep].to_dict(),
        "best_by_platform": scored.sort_values("pred_roas", ascending=False)
                                  .drop_duplicates("platform")[keep].reset_index(drop=True),
        "best_by_ad": scored.drop_duplicates("ad_id")[keep].reset_index(drop=True),
    }


if __name__ == "__main__":
    # quick demo: python ml/recommend.py
    from ml.features import DATA_DIR
    m, meta = load_models()
    ads = pd.read_csv(DATA_DIR / "ads.csv")
    res = recommend(m, meta, ads, {"age_group": "18-24", "gender": "Female", "interest": "Beauty"}, month=11, top_n=5)
    pd.set_option("display.width", 200)
    print(res["ranking"].round(4).to_string(index=False))
    print("\nBest platform for this segment:\n", res["best_by_platform"].head(4)[["platform", "ad_id", "pred_roas"]].round(3).to_string(index=False))
