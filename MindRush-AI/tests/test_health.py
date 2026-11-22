"""
MindRush AI Subsystem - Health & Secret Authorization Tests
Verifies internal endpoint authentication and public health probe behavior against the live FastAPI app.
"""

import pytest
from fastapi.testclient import TestClient
from ai_service.app import app
from ai_service.config import INTERNAL_API_SECRET

client = TestClient(app)

def test_health_check_without_secret():
    """Health check without secret should succeed (public probe for uptime/container monitors)."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "ollama_connected" in data
    assert "gpu_detected" in data
    # Secret must never be leaked in public health response
    assert INTERNAL_API_SECRET not in resp.text

def test_health_check_with_valid_secret():
    """Health check with valid secret should succeed."""
    resp = client.get("/health", headers={"X-Internal-Secret": INTERNAL_API_SECRET})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert INTERNAL_API_SECRET not in resp.text

def test_health_check_with_invalid_secret():
    """Health check with invalid secret should be rejected with 401."""
    resp = client.get("/health", headers={"X-Internal-Secret": "invalid_wrong_secret"})
    assert resp.status_code == 401
    assert resp.json()["error"] == "UNAUTHORIZED"
    assert INTERNAL_API_SECRET not in resp.text

def test_internal_endpoint_without_secret():
    """Protected internal endpoints without secret must be rejected with 401."""
    resp = client.get("/internal/ping")
    assert resp.status_code == 401
    assert resp.json()["error"] == "UNAUTHORIZED"
    assert INTERNAL_API_SECRET not in resp.text

def test_internal_endpoint_with_invalid_secret():
    """Protected internal endpoints with invalid secret must be rejected with 401."""
    resp = client.get("/internal/ping", headers={"X-Internal-Secret": "wrong_key_12345"})
    assert resp.status_code == 401
    assert resp.json()["error"] == "UNAUTHORIZED"
    assert INTERNAL_API_SECRET not in resp.text

def test_internal_endpoint_with_valid_secret():
    """Protected internal endpoints with valid secret must succeed."""
    resp = client.get("/internal/ping", headers={"X-Internal-Secret": INTERNAL_API_SECRET})
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert resp.json()["message"] == "authenticated"
    assert INTERNAL_API_SECRET not in resp.text
