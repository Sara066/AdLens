"""Loads the trained models once and shares them across requests."""
import sys
import threading

from fastapi import HTTPException

from ..config import MODELS_DIR, ROOT

if str(ROOT) not in sys.path:           # so `import ml...` works when started from anywhere
    sys.path.insert(0, str(ROOT))

from ml.recommend import ModelsNotTrained, load_models   # noqa: E402

_lock = threading.Lock()
_state = {"models": None, "meta": None, "error": None}


def reload_models():
    with _lock:
        try:
            _state["models"], _state["meta"] = load_models(MODELS_DIR)
            _state["error"] = None
        except (ModelsNotTrained, FileNotFoundError) as e:
            _state.update(models=None, meta=None, error=str(e))
    return _state["models"] is not None


def get_ml():
    """FastAPI dependency -> (models, meta). 503 if python ml/train.py has not been run."""
    if _state["models"] is None:
        reload_models()
    if _state["models"] is None:
        raise HTTPException(503, "Prediction models are not trained yet. Run: python ml/train.py")
    return _state["models"], _state["meta"]


def models_loaded() -> bool:
    return _state["models"] is not None
