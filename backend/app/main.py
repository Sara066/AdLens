"""
AdInsight API.

Run from the project root:
    uvicorn backend.app.main:app --reload
Docs: http://127.0.0.1:8000/docs
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select

from . import models  # noqa: F401  (register tables)
from .config import CORS_ORIGINS
from .db import Base, SessionLocal, engine
from .models import Performance
from .routers import admin, auth, compare, meta, metrics, predict, recommend, reports
from .seed import seed_if_empty
from .services.ml_service import _state, models_loaded, reload_models


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_if_empty(db)
    if not reload_models():
        print("WARNING:", _state["error"])
    yield


app = FastAPI(title="AdInsight API", version="1.0.0",
              description="AI-powered advertisement performance analyzer", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

for r in (auth, meta, metrics, compare, predict, recommend, reports, admin):
    app.include_router(r.router)


@app.get("/health", tags=["health"])
def health():
    with SessionLocal() as db:
        rows = db.scalar(select(func.count()).select_from(Performance))
    return {"status": "ok", "performance_rows": rows, "models_loaded": models_loaded()}
