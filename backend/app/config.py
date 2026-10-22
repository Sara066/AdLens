import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
MODELS_DIR = ROOT / "ml" / "models"

# SQLite by default (zero setup). For MySQL set e.g.
#   DATABASE_URL=mysql+pymysql://user:password@localhost:3306/adinsight   (pip install pymysql)
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{ROOT / 'adinsight.db'}")

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
