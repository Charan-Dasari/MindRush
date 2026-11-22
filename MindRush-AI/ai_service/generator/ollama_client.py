"""
MindRush AI Subsystem - Ollama LLM Client
Client targeting local Ollama daemon (qwen3.5:4b).
Enforces single-concurrency mutex, 120s timeout, context limits, and JSON format.
"""

import asyncio
import json
import logging
from typing import Any, Dict, Optional
import httpx

from ai_service.config import (
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    CONTEXT_LIMIT,
    CONCURRENCY_LIMIT,
    DEFAULT_TEMPERATURE,
    DEFAULT_NUM_PREDICT,
    REQUEST_TIMEOUT_SECONDS,
)

logger = logging.getLogger("ai_service.ollama_client")

# Hardware concurrency mutex lock (enforcing concurrency limit = 1 for 4GB VRAM safety)
_hardware_generation_lock = asyncio.Lock()


class OllamaClientError(Exception):
    """Base exception for Ollama client errors."""
    pass


class ModelUnavailableError(OllamaClientError):
    """Raised when the required model is not installed or available in Ollama."""
    pass


class OllamaConnectionError(OllamaClientError):
    """Raised when the local Ollama daemon is unreachable."""
    pass


class OllamaClient:
    def __init__(
        self,
        base_url: str = OLLAMA_BASE_URL,
        model_name: str = OLLAMA_MODEL,
        timeout: float = REQUEST_TIMEOUT_SECONDS
    ):
        self.base_url = base_url.rstrip("/")
        self.model_name = model_name
        self.timeout = timeout

    async def verify_model_available(self) -> Dict[str, Any]:
        """
        Verifies local Ollama daemon connectivity and confirms candidate model tag is available.
        """
        async with httpx.AsyncClient(trust_env=False, timeout=5.0) as client:
            try:
                resp = await client.get(f"{self.base_url}/api/tags")
                if resp.status_code != 200:
                    raise OllamaConnectionError(f"Ollama returned HTTP {resp.status_code}")
                data = resp.json()
            except httpx.RequestError as exc:
                raise OllamaConnectionError(f"Cannot reach Ollama at {self.base_url}: {exc}") from exc

        models = data.get("models", [])
        matched = None
        for m in models:
            name = m.get("name", "")
            # Match 'qwen3.5:4b' or 'qwen3.5:4b-...'
            if name == self.model_name or name.startswith(f"{self.model_name}:") or name.split(":")[0] == self.model_name.split(":")[0]:
                matched = m
                break

        if not matched:
            raise ModelUnavailableError(
                f"Model '{self.model_name}' not found in local Ollama daemon. "
                f"Available: {[m.get('name') for m in models]}"
            )

        return matched

    async def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = DEFAULT_TEMPERATURE,
        num_predict: int = DEFAULT_NUM_PREDICT,
        num_ctx: int = CONTEXT_LIMIT
    ) -> Dict[str, Any]:
        """
        Generates completion from Ollama ensuring JSON format enforcement,
        bounded context, and hardware mutex synchronization.
        """
        payload: Dict[str, Any] = {
            "model": self.model_name,
            "prompt": prompt,
            "format": "json",
            "stream": False,
            "think": False,
            "options": {
                "num_ctx": num_ctx,
                "temperature": temperature,
                "num_predict": num_predict
            }
        }

        if system_prompt:
            payload["system"] = system_prompt

        # Hardware concurrency lock guarantees no concurrent inference on 4GB VRAM
        async with _hardware_generation_lock:
            async with httpx.AsyncClient(trust_env=False, timeout=self.timeout) as client:
                try:
                    resp = await client.post(
                        f"{self.base_url}/api/generate",
                        json=payload
                    )
                except httpx.TimeoutException as exc:
                    raise OllamaClientError(f"Ollama generation timed out after {self.timeout}s") from exc
                except httpx.RequestError as exc:
                    raise OllamaConnectionError(f"Ollama connection error during generation: {exc}") from exc

            if resp.status_code != 200:
                raise OllamaClientError(f"Ollama generation failed with HTTP {resp.status_code}: {resp.text}")

            result = resp.json()
            raw_response = result.get("response", "")
            
            try:
                parsed_json = json.loads(raw_response)
            except json.JSONDecodeError as exc:
                # Some small models may wrap json in markdown block
                cleaned = raw_response.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                if cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                try:
                    parsed_json = json.loads(cleaned.strip())
                except Exception:
                    raise OllamaClientError(f"LLM output could not be parsed as JSON: {raw_response[:200]}") from exc

            return {
                "data": parsed_json,
                "raw_response": raw_response,
                "total_duration_ms": result.get("total_duration", 0) / 1_000_000,
                "load_duration_ms": result.get("load_duration", 0) / 1_000_000,
                "eval_count": result.get("eval_count", 0),
                "eval_duration_ms": result.get("eval_duration", 0) / 1_000_000
            }
