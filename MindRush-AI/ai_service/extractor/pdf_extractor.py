"""
MindRush AI Subsystem - PyMuPDF PDF Extractor
Extracts text and reference questions from PDF files with strict canonical path containment.
Rejects path traversal attempts, null bytes, and non-PDF formats.
"""

import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import fitz  # PyMuPDF
from ..config import DATASET_ROOT


class PathTraversalError(Exception):
    """Raised when file path escapes canonical dataset root."""
    pass


class UnsupportedFormatError(Exception):
    """Raised when file format is not .pdf."""
    pass


def sanitize_and_resolve_path(target_path: str, root_dir: Optional[Path] = None) -> Path:
    """
    Enforces strict canonical path containment:
    1. Rejects null bytes
    2. Rejects non-PDF extension
    3. Resolves realpath and verifies it resides within root_dir
    """
    if "\0" in target_path:
        raise PathTraversalError("Null bytes prohibited in path")

    root = (root_dir or DATASET_ROOT).resolve()
    resolved = Path(os.path.realpath(target_path))

    if resolved.suffix.lower() != ".pdf":
        raise UnsupportedFormatError(f"Unsupported format '{resolved.suffix}'. Feature 001 strictly requires .pdf")

    # Strict containment check
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise PathTraversalError(f"Access denied: Path '{resolved}' escapes root '{root}'") from exc

    if not resolved.exists():
        raise FileNotFoundError(f"File not found: {resolved}")

    return resolved


def extract_questions_from_pdf(pdf_path: Path) -> List[Dict[str, Any]]:
    """
    Extracts text and attempts parsing question stems and options from Olympiad paper PDF.
    """
    doc = fitz.open(str(pdf_path))
    full_text = ""
    for page in doc:
        full_text += page.get_text() + "\n"
    doc.close()

    # Heuristic parsing for Olympiad questions (Q1., 1., etc.)
    questions = []
    lines = [l.strip() for l in full_text.splitlines() if l.strip()]
    
    current_q = None
    for line in lines:
        if (line.startswith("Q") or (len(line) > 1 and line[0].isdigit() and line[1] in (".", ")"))) and len(line) > 5:
            if current_q and current_q.get("question_text"):
                questions.append(current_q)
            current_q = {
                "question_text": line,
                "options": [],
                "has_answer_key": False
            }
        elif current_q:
            if any(line.startswith(prefix) for prefix in ["(a)", "(b)", "(c)", "(d)", "A.", "B.", "C.", "D.", "a)", "b)", "c)", "d)"]):
                current_q["options"].append(line)
            else:
                if len(current_q["options"]) == 0:
                    current_q["question_text"] += " " + line

    if current_q and current_q.get("question_text"):
        questions.append(current_q)

    return questions
