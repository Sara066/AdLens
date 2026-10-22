"""
Evaluate the AdInsight models properly (for your report and viva).

Run from the project root, AFTER python ml/train.py:
    python ml/evaluate.py

Part 1 - Model comparison on the future test set (newest 15% of data):
    Baseline (platform mean)  vs  Ridge regression  vs  Neural network (MLP)  vs  XGBoost
Part 2 - Does the recommender actually help?
    a) Quartile lift: rows the model ranks in the top 25% by predicted ROAS vs the bottom 25%
    b) Top-1 / Top-2 hit rate: per audience segment, does the model pick the platform / ad type
       that really performed best in the test data?  (random picking would hit 1/n, 2/n)
    c) Uplift: realised ROAS when following the model's pick vs an average (random) allocation

Output: printed tables + ml/models/evaluation.json
"""
from __future__ import annotations

import json
import sys
import warnings
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from sklearn.compose import TransformedTargetRegressor
from sklearn.linear_model import Ridge
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import Pipeline

from ml.features import FEATURES, MODELS_DIR, TARGETS, load_data, make_preprocessor, regression_metrics, time_split
from ml.recommend import load_models, predict_rows

SEED = 42
MIN_ROWS = 5   # minimum test rows in a (segment, option) group to be considered


def wrap(pipe, target):
    if target == "roas":
        return TransformedTargetRegressor(regressor=pipe, func=np.log1p, inverse_func=np.expm1)
    return pipe


def comparison_models(target):
    ridge = Pipeline([("prep", make_preprocessor(scale=True)), ("model", Ridge(alpha=1.0))])
    mlp = Pipeline([("prep", make_preprocessor(scale=True)),
                    ("model", MLPRegressor(hidden_layer_sizes=(128, 64), early_stopping=True,
                                           max_iter=200, random_state=SEED))])
    return {"Ridge regression": wrap(ridge, target), "Neural network (MLP)": wrap(mlp, target)}


def model_comparison(train, test, models):
    rows, results = [], {}
    for target in TARGETS:
        res = {}
        base = test["platform"].map(train.groupby("platform")[target].mean())
        res["Baseline (platform mean)"] = regression_metrics(test[target], base)
        for name, m in comparison_models(target).items():
            m.fit(train[FEATURES], train[target])
            p = m.predict(test[FEATURES])
            if target != "roas":
                p = np.clip(p, 0, 1)
            res[name] = regression_metrics(test[target], p)
        key = {"ctr": "ctr", "conversion_rate": "cvr", "roas": "roas"}[target]
        res["XGBoost (final)"] = regression_metrics(test[target], np.clip(models[key].predict(test[FEATURES]), 0, None))
        results[target] = res
        for name, r in res.items():
            rows.append({"target": target, "model": name, "MAE": r["mae"], "RMSE": r["rmse"], "R2": r["r2"]})
    return pd.DataFrame(rows), results


def realised_roas(g):
    return g["revenue"].sum() / g["spend"].sum()


def quartile_lift(scored):
    q = pd.qcut(scored["pred_roas"], 4, labels=["Q1 (lowest)", "Q2", "Q3", "Q4 (highest)"])
    out = scored.groupby(q, observed=True).apply(realised_roas).rename("realised_roas").to_frame()
    out["avg_pred_roas"] = scored.groupby(q, observed=True)["pred_roas"].mean()
    return out


def hit_rates(scored, dim):
    """Per segment: model's best option (highest mean predicted ROAS) vs truly best (highest realised ROAS)."""
    top1 = top2 = n = 0
    sel_rev = sel_spend = 0.0
    rand_rev = rand_spend = 0.0
    n_options = []
    for _, seg in scored.groupby("segment"):
        grp = seg.groupby(dim)
        counts = grp.size()
        ok = counts[counts >= MIN_ROWS].index
        if len(ok) < 2:
            continue
        seg = seg[seg[dim].isin(ok)]
        grp = seg.groupby(dim)
        pred = grp["pred_roas"].mean()
        real = grp.apply(realised_roas)
        model_pick = pred.idxmax()
        true_rank = real.sort_values(ascending=False).index.tolist()
        top1 += model_pick == true_rank[0]
        top2 += model_pick in true_rank[:2]
        n += 1
        n_options.append(len(ok))
        pick = seg[seg[dim] == model_pick]
        sel_rev += pick["revenue"].sum(); sel_spend += pick["spend"].sum()
        rand_rev += seg["revenue"].sum(); rand_spend += seg["spend"].sum()
    k = np.mean(n_options)
    return {
        "segments_evaluated": int(n),
        "top1_hit_rate": top1 / n,
        "top2_hit_rate": top2 / n,
        "random_top1": float(np.mean([1 / o for o in n_options])),
        "random_top2": float(np.mean([min(2 / o, 1) for o in n_options])),
        "avg_options_per_segment": float(k),
        "roas_following_model": sel_rev / sel_spend,
        "roas_average_allocation": rand_rev / rand_spend,
        "uplift_pct": (sel_rev / sel_spend) / (rand_rev / rand_spend) * 100 - 100,
    }


def main():
    df = load_data()
    train, test = time_split(df, 0.15)
    models, meta = load_models()

    print("=" * 70)
    print("PART 1 - MODEL COMPARISON (future test set, %d rows)" % len(test))
    print("=" * 70)
    table, results = model_comparison(train, test, models)
    for target in TARGETS:
        print(f"\n{target.upper()}")
        print(table[table.target == target].drop(columns="target").round(4).to_string(index=False))

    scored = predict_rows(models, meta, test)
    print("\n" + "=" * 70)
    print("PART 2 - DOES THE RECOMMENDER HELP?")
    print("=" * 70)
    ql = quartile_lift(scored)
    print("\nRealised ROAS by predicted-ROAS quartile (should rise from Q1 to Q4):")
    print(ql.round(3).to_string())

    rec = {}
    for dim, label in [("platform", "platform"), ("ad_type", "ad type")]:
        rec[dim] = hit_rates(scored, dim)
        r = rec[dim]
        print(f"\nBest-{label} recommendation per segment ({r['segments_evaluated']} segments, ~{r['avg_options_per_segment']:.1f} options each):")
        print(f"  top-1 hit rate : {r['top1_hit_rate']:.0%}   (random: {r['random_top1']:.0%})")
        print(f"  top-2 hit rate : {r['top2_hit_rate']:.0%}   (random: {r['random_top2']:.0%})")
        print(f"  realised ROAS following the model: {r['roas_following_model']:.2f} vs average allocation {r['roas_average_allocation']:.2f}  ->  uplift {r['uplift_pct']:+.1f}%")

    out = {
        "model_comparison": results,
        "quartile_lift": {str(k): float(v) for k, v in ql["realised_roas"].round(4).items()},
        "recommendation": rec,
    }
    (MODELS_DIR / "evaluation.json").write_text(json.dumps(out, indent=2, default=float))
    print(f"\nSaved {MODELS_DIR / 'evaluation.json'}")


if __name__ == "__main__":
    main()
