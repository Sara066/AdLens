"""
Train the three AdInsight prediction models (CTR, conversion rate, ROAS).

Run from the project root:
    python ml/train.py            # full tuning (a few minutes)
    python ml/train.py --fast     # quick run for testing

What it does
    1. Loads data/performance.csv and splits it CHRONOLOGICALLY:
       oldest 85% -> train (with cross-validated tuning), newest 15% -> test.
    2. Tunes an XGBoost pipeline (one-hot encoding + XGBRegressor) per target.
    3. Evaluates on the untouched future test set and compares to a baseline
       (platform average).
    4. Saves ml/models/{ctr,conversion_rate,roas}.joblib and ml/models/meta.json
       (metrics, dropdown options and platform CPMs used by the API).
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import joblib
import numpy as np
from sklearn.compose import TransformedTargetRegressor
from sklearn.model_selection import RandomizedSearchCV
from sklearn.pipeline import Pipeline
from xgboost import XGBRegressor

from ml.features import (
    FEATURES, MODELS_DIR, TARGETS, load_data, make_preprocessor,
    regression_metrics, time_split,
)

SEED = 42
LOG_TARGETS = {"roas"}   # ROAS is right-skewed: train on log1p(roas), predict back on the real scale

PARAM_GRID = {
    "n_estimators": [200, 400, 600],
    "max_depth": [3, 4, 5, 6],
    "learning_rate": [0.03, 0.05, 0.1],
    "subsample": [0.7, 0.85, 1.0],
    "colsample_bytree": [0.6, 0.8, 1.0],
    "min_child_weight": [1, 5, 10],
}


def build_pipeline(target: str, **xgb_params):
    pipe = Pipeline([
        ("prep", make_preprocessor()),
        ("model", XGBRegressor(tree_method="hist", random_state=SEED, n_jobs=-1, **xgb_params)),
    ])
    if target in LOG_TARGETS:
        return TransformedTargetRegressor(regressor=pipe, func=np.log1p, inverse_func=np.expm1)
    return pipe


def param_prefix(target: str) -> str:
    return "regressor__model__" if target in LOG_TARGETS else "model__"


def platform_baseline(train_df, test_df, target):
    """Naive baseline: predict the training mean of the target for each platform."""
    means = train_df.groupby("platform")[target].mean()
    return test_df["platform"].map(means).fillna(train_df[target].mean())


def build_meta(df, metrics, best_params, n_iter, train_size, test_size):
    g = df.groupby("platform")[["spend", "impressions"]].sum()
    platform_cpm = (g["spend"] / g["impressions"] * 1000).round(2).to_dict()
    return {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "features": FEATURES,
        "n_train_rows": train_size,
        "n_test_rows": test_size,
        "search_iterations": n_iter,
        "data_range": [str(df.start_date.min().date()), str(df.start_date.max().date())],
        "platform_cpm": platform_cpm,
        "options": {
            "platforms": sorted(df.platform.unique().tolist()),
            "age_groups": sorted(df.age_group.unique().tolist()),
            "genders": sorted(df.gender.unique().tolist()),
            "interests": sorted(df.interest.unique().tolist()),
            "devices": sorted(df.device.unique().tolist()),
            "location_tiers": sorted(df.location_tier.unique().tolist()),
            "ad_types": sorted(df.ad_type.unique().tolist()),
            "ad_categories": sorted(df.ad_category.unique().tolist()),
        },
        "budget_range": [float(df.budget.min()), float(df.budget.max())],
        "metrics": metrics,
        "best_params": best_params,
    }


def main(fast: bool = False):
    df = load_data()
    train, test = time_split(df, test_frac=0.15)
    print(f"Train rows: {len(train):,} ({train.start_date.min().date()} -> {train.start_date.max().date()})")
    print(f"Test rows : {len(test):,} ({test.start_date.min().date()} -> {test.start_date.max().date()})\n")

    n_iter = 3 if fast else 12
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    metrics, best_params = {}, {}

    for target in TARGETS:
        t0 = time.time()
        prefix = param_prefix(target)
        search = RandomizedSearchCV(
            build_pipeline(target),
            param_distributions={prefix + k: v for k, v in PARAM_GRID.items()},
            n_iter=n_iter, cv=3, scoring="neg_mean_absolute_error",
            random_state=SEED, n_jobs=1, refit=True, verbose=0,
        )
        search.fit(train[FEATURES], train[target])
        model = search.best_estimator_            # refit on the full training portion

        pred = model.predict(test[FEATURES])
        if target in ("ctr", "conversion_rate"):
            pred = np.clip(pred, 0, 1)
        base = platform_baseline(train, test, target)

        metrics[target] = {
            "xgboost": regression_metrics(test[target], pred),
            "baseline_platform_mean": regression_metrics(test[target], base),
        }
        best_params[target] = {k.replace(prefix, ""): v for k, v in search.best_params_.items()}
        joblib.dump(model, MODELS_DIR / f"{target}.joblib")

        x, b = metrics[target]["xgboost"], metrics[target]["baseline_platform_mean"]
        print(f"[{target}] R2 {x['r2']:.3f} (baseline {b['r2']:.3f}) | "
              f"MAE {x['mae']:.4f} (baseline {b['mae']:.4f}) | {time.time() - t0:.0f}s")

    meta = build_meta(df, metrics, best_params, n_iter, len(train), len(test))
    (MODELS_DIR / "meta.json").write_text(json.dumps(meta, indent=2, default=str))
    print(f"\nSaved models + meta.json to {MODELS_DIR}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--fast", action="store_true", help="3 search iterations instead of 12")
    main(ap.parse_args().fast)
