"""Alchemi AI Engine — configuration & secret loading.

Secrets are loaded from (first match wins):
  1. ``ALCHEMI_ENV_FILE`` (explicit override)
  2. ``<repo>/venv/.env``   ← recommended home for API keys (git-ignored)
  3. ``<ai-engine>/.env``
  4. ``<repo>/.env``
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
SERVICE_ROOT = Path(__file__).resolve().parent


def _candidate_env_files() -> list[Path]:
    candidates: list[Path] = []
    override = os.getenv("ALCHEMI_ENV_FILE")
    if override:
        candidates.append(Path(override))
    candidates += [
        REPO_ROOT / "venv" / ".env",
        SERVICE_ROOT / ".env",
        REPO_ROOT / ".env",
    ]
    return candidates


def load_env() -> Path | None:
    """Load the first available .env file. Returns the path loaded."""
    for candidate in _candidate_env_files():
        if candidate.is_file():
            load_dotenv(candidate, override=False)
            return candidate
    return None


ENV_FILE_LOADED = load_env()


def _bool(key: str, default: bool = False) -> bool:
    return os.getenv(key, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    """Runtime settings resolved from environment variables."""

    def __init__(self) -> None:
        self.env_file: Path | None = ENV_FILE_LOADED
        # LLM / chemical intelligence
        self.openai_api_key: str = os.getenv("OPENAI_API_KEY", "").strip()
        self.openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
        self.openai_base_url: str | None = os.getenv("OPENAI_BASE_URL", "").strip() or None
        self.llm_temperature: float = float(os.getenv("LLM_TEMPERATURE", "0.7"))
        # Server
        self.host: str = os.getenv("AI_ENGINE_HOST", "0.0.0.0")
        self.port: int = int(os.getenv("AI_ENGINE_PORT", "8000"))
        self.log_level: str = os.getenv("AI_LOG_LEVEL", "INFO").upper()
        # Model
        self.checkpoint_path: str = os.getenv(
            "GATV2_CHECKPOINT", "models/checkpoints/gatv2_multitask.pt"
        )
        self.offline_mode: bool = _bool("ALCHEMI_OFFLINE", False)

    @property
    def llm_enabled(self) -> bool:
        return bool(self.openai_api_key) and not self.offline_mode

    def public_summary(self) -> dict:
        return {
            "env_file": str(self.env_file) if self.env_file else None,
            "llm_provider": "openai" if self.llm_enabled else "offline-fallback",
            "llm_model": self.openai_model if self.llm_enabled else "rule-based-chem-engine",
            "offline_mode": self.offline_mode,
        }


settings = Settings()
