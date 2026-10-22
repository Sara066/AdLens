# AdInsight - AI-Powered Advertisement Performance Analyzer

Predicts CTR, conversion rate and ROAS for an ad / platform / audience combination and
recommends the best ad and platform for a customer segment.
(`ml/` + `backend/` are complete; the React frontend goes in `frontend/`.)

## Setup (once)
```
python -m venv .venv
.venv\Scripts\activate          # Windows      |   source .venv/bin/activate   (Mac/Linux)
pip install -r requirements.txt
```

## Run order (always from the project root)
```
python ml/generate_data.py      # 1. creates data/*.csv   (synthetic, 60,000 ad flights)
python ml/eda.py                # 2. charts for the report -> docs/figures/
python ml/train.py              # 3. trains + saves models -> ml/models/   (add --fast for a quick test)
python ml/evaluate.py           # 4. comparison tables + recommender evaluation for the report
uvicorn backend.app.main:app --reload     # 5. API at http://127.0.0.1:8000/docs
```
The API creates the SQLite database (`adinsight.db`) and loads the CSVs automatically on first start.
To reload manually: `python -m backend.scripts.seed_db --reset`

Demo logins (created automatically):
| Role | Email | Password |
|---|---|---|
| Admin | admin@adinsight.com | admin123 |
| Manager | manager@adinsight.com | manager123 |
| Analyst | analyst@adinsight.com | analyst123 |

## Key endpoints
`POST /auth/login` | `GET /meta/options` | `GET /metrics/summary|platforms|segments|top-ads|trend|matrix`
| `GET /compare/platforms|ads` | `POST /predict` | `POST /recommend` | `POST /recommend/platform`
| `GET /reports/campaigns` (+ `.csv`) | `/admin/...` (Admin only)

All data endpoints accept optional filters: `platform, ad_id, campaign_id, ad_type, age_group, gender,
interest, device, location_tier, date_from, date_to` (comma-separate multiple values).
Send the login token as `Authorization: Bearer <token>`.

## Rules
- `ml/features.py` is the single source of truth for model inputs - training and the API both import it.
- Outcomes (impressions, clicks, conversions, spend, revenue) are never model inputs.
- MySQL instead of SQLite: `pip install pymysql` and set `DATABASE_URL=mysql+pymysql://user:pass@localhost/adinsight`.
- Data is synthetic: say so in the report. Metrics show the pipeline works, not real-world accuracy.
