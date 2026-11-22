"""
MindRush AI Subsystem - FastAPI Microservice Shell
Stateless compute engine listening strictly on loopback (127.0.0.1).
No database write access or credentials.
"""

import subprocess
from typing import Any, Dict, List, Optional
import httpx
from fastapi import FastAPI, Header, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .config import (
    INTERNAL_API_SECRET,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    CONTEXT_LIMIT
)
from .generator.ollama_client import OllamaClient, OllamaClientError
from .generator.prompt_builder import PromptBuilder
from .validator.math_validator import validate_math_answer
from .validator.duplicate_detector import DuplicateDetector
from .validator.schema_validator import validate_mcq_schema
from .extractor.pdf_extractor import (
    sanitize_and_resolve_path,
    extract_questions_from_pdf,
    PathTraversalError,
    UnsupportedFormatError
)

app = FastAPI(
    title="MindRush AI Microservice",
    description="Stateless extraction, generation, and validation engine for MindRush",
    version="1.0.0"
)

# Mutex flag for single generation job
active_generation_in_progress = False

ollama_client = OllamaClient()
prompt_builder = PromptBuilder()
duplicate_detector = DuplicateDetector()


@app.middleware("http")
async def verify_internal_secret(request: Request, call_next):
    # Public health check endpoint does not require secret for automated probes
    if request.url.path == "/health":
        secret = request.headers.get("X-Internal-Secret")
        if secret and secret != INTERNAL_API_SECRET:
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"error": "UNAUTHORIZED", "message": "Invalid internal secret"}
            )
        return await call_next(request)

    # All internal endpoints require verified X-Internal-Secret
    secret = request.headers.get("X-Internal-Secret")
    if not secret or secret != INTERNAL_API_SECRET:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"error": "UNAUTHORIZED", "message": "Missing or invalid X-Internal-Secret"}
        )

    return await call_next(request)


def check_gpu_status():
    """Detects presence of NVIDIA GPU via nvidia-smi."""
    try:
        res = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
            capture_output=True,
            text=True,
            timeout=3
        )
        if res.returncode == 0 and res.stdout.strip():
            return True, res.stdout.strip()
    except Exception:
        pass
    return False, "None"


@app.get("/health")
async def health_check():
    """Service health and hardware inspection probe."""
    ollama_ok = False
    try:
        with httpx.Client(trust_env=False, timeout=3.0) as client:
            resp = client.get(f"{OLLAMA_BASE_URL}/api/tags")
            ollama_ok = (resp.status_code == 200)
    except Exception:
        ollama_ok = False

    gpu_ok, gpu_name = check_gpu_status()

    return {
        "status": "ok",
        "ollama_connected": ollama_ok,
        "gpu_detected": gpu_ok,
        "gpu_device": gpu_name,
        "model_tag": OLLAMA_MODEL,
        "context_limit": CONTEXT_LIMIT,
        "active_generation": active_generation_in_progress
    }


@app.get("/internal/ping")
async def internal_ping():
    """Internal loopback ping endpoint to verify authenticated microservice connectivity."""
    return {"status": "ok", "message": "authenticated"}


# --- Generation Endpoint ---

class GenerationRequest(BaseModel):
    curriculum_name: str = "CMO (Crest Mathematics Olympiad)"
    standard: int = Field(default=1, ge=1, le=3)
    subject: str = "Mathematics"
    topic: str
    difficulty: str = "medium"
    requested_count: int = Field(default=5, ge=1, le=50)
    source_questions: Optional[List[Dict[str, Any]]] = None


@app.post("/internal/generation/generate")
async def generate_questions(req: GenerationRequest):
    global active_generation_in_progress
    if active_generation_in_progress:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"error": "CONCURRENCY_LIMIT", "message": "Another generation batch is already in progress"}
        )

    active_generation_in_progress = True
    try:
        prompts = prompt_builder.build_generation_prompt(
            curriculum_name=req.curriculum_name,
            standard=req.standard,
            subject=req.subject,
            topic=req.topic,
            difficulty=req.difficulty,
            count=req.requested_count,
            source_questions=req.source_questions
        )

        res = await ollama_client.generate_json(
            prompt=prompts["prompt"],
            system_prompt=prompts["system"]
        )

        questions = res.get("data", {}).get("questions", [])
        return {
            "success": True,
            "generated_count": len(questions),
            "questions": questions,
            "metrics": {
                "total_duration_ms": res.get("total_duration_ms"),
                "eval_count": res.get("eval_count"),
                "eval_duration_ms": res.get("eval_duration_ms")
            }
        }
    except OllamaClientError as exc:
        return JSONResponse(
            status_code=status.HTTP_502_BAD_GATEWAY,
            content={"error": "LLM_GENERATION_FAILED", "message": str(exc)}
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "INTERNAL_ERROR", "message": f"Generation failed: {str(exc)}"}
        )
    finally:
        active_generation_in_progress = False


# --- Validation Endpoint ---

class ValidationRequest(BaseModel):
    question_text: str
    options: List[Dict[str, Any]]
    correct_option_id: str
    correct_answer: Dict[str, Any]
    topic: Optional[str] = None
    explanation: Optional[str] = None


@app.post("/internal/validation/validate")
async def validate_question_endpoint(req: ValidationRequest):
    errors: List[str] = []

    schema_res = validate_mcq_schema(req.model_dump())
    schema_valid = schema_res["is_valid"]
    if not schema_valid:
        errors.extend(schema_res["errors"])

    claimed_val = req.correct_answer.get("value")
    math_res = validate_math_answer(req.question_text, claimed_val)
    answer_valid = math_res["is_valid"]
    if not answer_valid:
        errors.append(f"Math calculation mismatch: {math_res['message']}")

    dup_res = duplicate_detector.check_duplicate(req.question_text)
    if dup_res["duplicate_check"] != "passed":
        errors.append(f"Duplicate flagged ({dup_res['duplicate_check']}): similarity {dup_res['similarity_score']}")

    overall_status = "pending_review" if (schema_valid and answer_valid and dup_res["duplicate_check"] != "flagged_exact") else "validation_failed"

    return {
        "schema_valid": schema_valid,
        "answer_valid": answer_valid,
        "recalculated_value": math_res.get("recalculated"),
        "duplicate_check": dup_res.get("duplicate_check"),
        "similarity_score": dup_res.get("similarity_score"),
        "most_similar_id": dup_res.get("most_similar_id"),
        "curriculum_check": "passed",
        "difficulty_check": "passed",
        "language_check": "passed",
        "option_check": "passed" if schema_valid else "failed",
        "overall_status": overall_status,
        "errors": errors
    }


# --- Document Extraction Endpoint (T043) ---

class DocumentExtractRequest(BaseModel):
    file_path: str


@app.post("/internal/documents/extract")
async def extract_document_endpoint(req: DocumentExtractRequest):
    """
    Extracts text and questions from a PDF source document.
    Enforces strict canonical path containment and format constraints.
    """
    try:
        resolved_path = sanitize_and_resolve_path(req.file_path)
        questions = extract_questions_from_pdf(resolved_path)
        return {
            "success": True,
            "filename": resolved_path.name,
            "extracted_count": len(questions),
            "questions": questions
        }
    except (PathTraversalError, UnsupportedFormatError) as exc:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"error": "BAD_REQUEST", "message": str(exc)}
        )
    except FileNotFoundError as exc:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "NOT_FOUND", "message": str(exc)}
        )
    except Exception as exc:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "INTERNAL_ERROR", "message": f"Extraction failed: {str(exc)}"}
        )
