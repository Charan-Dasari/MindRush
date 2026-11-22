"""
MindRush AI Subsystem - Configuration Isolation Tests
Tests production, staging, and development configuration loading using isolated subprocesses
to guarantee no sys.modules caching effects.
"""

import os
import sys
import subprocess
from pathlib import Path

PYTHON_EXE = sys.executable
AI_ROOT = Path(__file__).resolve().parent.parent

def run_config_subprocess(env_overrides):
    env = os.environ.copy()
    env["PYTHONPATH"] = str(AI_ROOT)
    for k, v in env_overrides.items():
        if v is None:
            env.pop(k, None)
        else:
            env[k] = v

    code = "from ai_service import config; print('LOADED:', config.INTERNAL_API_SECRET)"
    res = subprocess.run(
        [PYTHON_EXE, "-c", code],
        cwd=str(AI_ROOT),
        env=env,
        capture_output=True,
        text=True
    )
    return res

def test_production_missing_secret_fails():
    """In production, missing secret must abort initialization."""
    res = run_config_subprocess({"ENVIRONMENT": "production", "AI_SERVICE_SECRET": ""})
    assert res.returncode != 0
    assert "FATAL: In production environments, AI_SERVICE_SECRET must be explicitly defined." in res.stderr

def test_production_default_secret_fails():
    """In production, known development default secret must abort initialization."""
    res = run_config_subprocess({
        "ENVIRONMENT": "production",
        "AI_SERVICE_SECRET": "dev_internal_secret_key_change_in_production"
    })
    assert res.returncode != 0
    assert "cannot use the known development fallback" in res.stderr

def test_production_short_secret_fails():
    """In production, secret shorter than 32 characters must abort initialization."""
    res = run_config_subprocess({
        "ENVIRONMENT": "production",
        "AI_SERVICE_SECRET": "too_short_key_123"
    })
    assert res.returncode != 0
    assert "must be at least 32 characters long" in res.stderr

def test_staging_missing_secret_fails():
    """In staging, missing secret must abort initialization."""
    res = run_config_subprocess({"ENVIRONMENT": "staging", "AI_SERVICE_SECRET": ""})
    assert res.returncode != 0
    assert "FATAL: In production environments, AI_SERVICE_SECRET must be explicitly defined." in res.stderr

def test_production_valid_secret_succeeds():
    """In production, a valid 32+ character non-default secret must succeed."""
    valid_sec = "a_very_secure_production_secret_key_that_is_32_chars_long_123"
    res = run_config_subprocess({"ENVIRONMENT": "production", "AI_SERVICE_SECRET": valid_sec})
    assert res.returncode == 0
    assert f"LOADED: {valid_sec}" in res.stdout

def test_development_default_secret_succeeds():
    """In development, missing secret falls back to known dev secret."""
    res = run_config_subprocess({"ENVIRONMENT": "development", "AI_SERVICE_SECRET": ""})
    assert res.returncode == 0
    assert "LOADED: dev_internal_secret_key_change_in_production" in res.stdout

def test_development_custom_secret_succeeds():
    """In development, custom secret is respected."""
    custom = "custom_dev_key"
    res = run_config_subprocess({"ENVIRONMENT": "development", "AI_SERVICE_SECRET": custom})
    assert res.returncode == 0
    assert f"LOADED: {custom}" in res.stdout
