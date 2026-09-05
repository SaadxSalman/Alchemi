"""Alchemi model package: GATv2 graph neural network + runtime predictor."""
from __future__ import annotations

import logging
import threading

from config import settings
from models.gatv2 import PropertyModel, TORCH_AVAILABLE

_predictor: PropertyModel | None = None
_init_lock = threading.Lock()


def get_predictor() -> PropertyModel | None:
    """Lazily load the trained GATv2 checkpoint (process-wide singleton)."""
    global _predictor
    if _predictor is None:
        with _init_lock:
            if _predictor is None:
                _predictor = PropertyModel.load(settings.checkpoint_path)
    return _predictor


def runtime_info() -> dict:
    predictor = get_predictor()
    return {
        "torch_available": TORCH_AVAILABLE,
        "gatv2_loaded": predictor is not None,
        "gatv2_checkpoint": str(predictor.checkpoint) if predictor else None,
    }


__all__ = ["get_predictor", "runtime_info", "PropertyModel", "TORCH_AVAILABLE", "logging"]
