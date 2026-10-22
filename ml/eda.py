"""
Exploratory data analysis. Saves charts to docs/figures/ for your report.

Run from the project root:   python ml/eda.py
(The '# %%' markers also let you open this file as a notebook in VS Code / Kiro.)
"""
# %% imports
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

from ml.features import ROOT, load_data

FIG = ROOT / "docs" / "figures"
FIG.mkdir(parents=True, exist_ok=True)
sns.set_theme(style="whitegrid")
df = load_data()


def roas_of(g):
    return g["revenue"].sum() / g["spend"].sum()


def save(name):
    plt.tight_layout()
    plt.savefig(FIG / name, dpi=150)
    plt.close()
    print("saved", name)


# %% 1. dataset overview
print(df.shape)
print(df[["budget", "impressions", "clicks", "conversions", "spend", "revenue", "ctr", "conversion_rate", "roas"]].describe().round(3))
print("Missing values:", int(df.isna().sum().sum()))

# %% 2. ROAS by platform (spend-weighted)
plat = df.groupby("platform").apply(roas_of).sort_values(ascending=False)
plt.figure(figsize=(6, 4)); sns.barplot(x=plat.index, y=plat.values, palette="viridis")
plt.title("ROAS by platform (spend-weighted)"); plt.ylabel("ROAS"); save("01_roas_by_platform.png")

# %% 3. Target distributions
fig, ax = plt.subplots(1, 3, figsize=(14, 4))
for a, c in zip(ax, ["ctr", "conversion_rate", "roas"]):
    sns.histplot(df[c], bins=50, ax=a, kde=True); a.set_title(f"Distribution of {c}")
save("02_target_distributions.png")

# %% 4. Ad type x platform CTR heatmap
pt = df.pivot_table(index="ad_type", columns="platform", values="ctr", aggfunc="mean") * 100
plt.figure(figsize=(7, 4)); sns.heatmap(pt, annot=True, fmt=".2f", cmap="YlGnBu")
plt.title("Average CTR (%) - ad type x platform"); save("03_ctr_adtype_platform.png")

# %% 5. Age group x platform ROAS heatmap
pt = df.groupby(["age_group", "platform"]).apply(roas_of).unstack()
plt.figure(figsize=(7, 4)); sns.heatmap(pt, annot=True, fmt=".2f", cmap="YlOrRd")
plt.title("ROAS - age group x platform"); save("04_roas_age_platform.png")

# %% 6. Does interest-category match matter?
m = df.groupby("interest_match")[["ctr", "conversion_rate"]].mean() * 100
m.index = ["No match", "Interest matches ad category"]
m.plot(kind="bar", figsize=(7, 4), rot=0); plt.title("Interest match effect (avg %)"); save("05_interest_match.png")

# %% 7. Monthly trend + festive season
mt = df.groupby(df.start_date.dt.to_period("M")).apply(roas_of)
plt.figure(figsize=(9, 4)); mt.index = mt.index.astype(str); mt.plot(marker="o")
plt.title("ROAS by launch month"); plt.xticks(rotation=60); plt.ylabel("ROAS"); save("06_monthly_roas.png")

# %% 8. Budget vs ROAS (diminishing returns)
b = df.assign(bucket=__import__("pandas").qcut(df.budget, 8)).groupby("bucket", observed=True).apply(roas_of)
plt.figure(figsize=(8, 4)); plt.plot(range(len(b)), b.values, marker="o")
plt.xticks(range(len(b)), [f"{int(i.left/1000)}k-{int(i.right/1000)}k" for i in b.index], rotation=45)
plt.title("ROAS by budget bucket"); plt.ylabel("ROAS"); save("07_budget_vs_roas.png")

# %% 9. Correlation of numeric inputs with targets
corr = df[["budget", "duration_days", "has_offer", "is_festive", "interest_match", "ctr", "conversion_rate", "roas"]].corr()
plt.figure(figsize=(8, 6)); sns.heatmap(corr, annot=True, fmt=".2f", cmap="coolwarm", center=0)
plt.title("Correlation matrix"); save("08_correlation.png")
