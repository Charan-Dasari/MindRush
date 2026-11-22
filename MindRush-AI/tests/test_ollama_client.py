"""
MindRush AI Subsystem - Ollama Client Tests
"""

import asyncio
from unittest.mock import AsyncMock, patch
from ai_service.generator.ollama_client import OllamaClient, OllamaClientError, ModelUnavailableError
from ai_service.generator.prompt_builder import PromptBuilder, load_canonical_questions


def test_canonical_questions_loaded():
    """Verify 100 canonical questions can be parsed from public JS bundle."""
    questions = load_canonical_questions()
    assert isinstance(questions, list)
    assert len(questions) == 100
    first_q = questions[0]
    assert "question" in first_q
    assert "options" in first_q
    assert "correctAnswer" in first_q
    assert len(first_q["options"]) == 4


def test_prompt_builder_few_shot_examples():
    """Verify prompt builder formats few shot examples matching MCQ specification."""
    builder = PromptBuilder()
    prompts = builder.build_generation_prompt(
        curriculum_name="CMO",
        standard=1,
        subject="Mathematics",
        topic="Addition",
        difficulty="medium",
        count=3
    )

    assert "system" in prompts
    assert "prompt" in prompts
    assert "Generate 3 distinct Multiple Choice Questions" in prompts["prompt"]
    assert "Standard 1" in prompts["prompt"]
    assert "Addition" in prompts["prompt"]


def test_ollama_client_model_verification_missing():
    """Verify missing model tag raises ModelUnavailableError."""
    async def run():
        client = OllamaClient(base_url="http://localhost:11434", model_name="non_existent_model_tag:99b")
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_resp = AsyncMock()
            mock_resp.status_code = 200
            mock_resp.json = lambda: {"models": [{"name": "qwen3.5:4b"}]}
            mock_get.return_value = mock_resp

            try:
                await client.verify_model_available()
                assert False, "Should have raised ModelUnavailableError"
            except ModelUnavailableError:
                pass

    asyncio.run(run())


def test_ollama_client_model_verification_found():
    """Verify candidate model tag is correctly found."""
    async def run():
        client = OllamaClient(base_url="http://localhost:11434", model_name="qwen3.5:4b")
        with patch("httpx.AsyncClient.get") as mock_get:
            mock_resp = AsyncMock()
            mock_resp.status_code = 200
            mock_resp.json = lambda: {"models": [{"name": "qwen3.5:4b"}]}
            mock_get.return_value = mock_resp

            found = await client.verify_model_available()
            assert found["name"] == "qwen3.5:4b"

    asyncio.run(run())
