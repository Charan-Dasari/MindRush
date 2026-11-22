"""
MindRush AI Subsystem - Configuration Module
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root if present
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

# Canonical Dataset Directory (Canonical containment anchor)
DATASET_ROOT = (PROJECT_ROOT / "MindRush-AI" / "dataset").resolve()

# Environment detection
ENVIRONMENT = os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development")).lower().strip()
IS_PRODUCTION = ENVIRONMENT in ("production", "prod", "staging")

# Internal Loopback Authorization Secret
# In production, must be explicitly set and not use known development fallback
KNOWN_DEV_SECRET = "dev_internal_secret_key_change_in_production"
_raw_secret = os.getenv("AI_SERVICE_SECRET", "").strip()

if IS_PRODUCTION:
    if not _raw_secret:
        raise RuntimeError(
            "FATAL: In production environments, AI_SERVICE_SECRET must be explicitly defined."
        )
    if _raw_secret == KNOWN_DEV_SECRET:
        raise RuntimeError(
            "FATAL: In production environments, AI_SERVICE_SECRET cannot use the known development fallback."
        )
    if len(_raw_secret) < 32:
        raise RuntimeError(
            "FATAL: In production environments, AI_SERVICE_SECRET must be at least 32 characters long."
        )
    INTERNAL_API_SECRET = _raw_secret
else:
    INTERNAL_API_SECRET = _raw_secret if _raw_secret else KNOWN_DEV_SECRET

# Local Ollama Configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen3.5:4b")

# Hardware & Inference Boundaries (NVIDIA GeForce RTX 3050 Ti Laptop GPU - 4 GB VRAM)
HARDWARE_MAX_VRAM_MIB = 4096
CONTEXT_LIMIT = 2048
CONCURRENCY_LIMIT = 1
DEFAULT_TEMPERATURE = 0.3
DEFAULT_NUM_PREDICT = 1024
REQUEST_TIMEOUT_SECONDS = 120.0
