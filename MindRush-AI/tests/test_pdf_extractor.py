"""
MindRush AI Subsystem - PDF Extractor & Path Security Tests
"""

import pytest
from pathlib import Path
from ai_service.extractor.pdf_extractor import (
    sanitize_and_resolve_path,
    extract_questions_from_pdf,
    PathTraversalError,
    UnsupportedFormatError
)
from ai_service.config import DATASET_ROOT


def test_path_traversal_prevention_parent_dir():
    """Verify paths attempting traversal outside dataset root are rejected."""
    traversal_path = str(DATASET_ROOT / ".." / "config.py")
    with pytest.raises((PathTraversalError, UnsupportedFormatError)):
        sanitize_and_resolve_path(traversal_path)


def test_path_traversal_null_bytes():
    """Verify null bytes in path are rejected immediately."""
    null_byte_path = str(DATASET_ROOT / "standard 1" / "mathematics" / "Class-1_31.pdf\0.txt")
    with pytest.raises(PathTraversalError):
        sanitize_and_resolve_path(null_byte_path)


def test_unsupported_format_rejection():
    """Verify non-PDF extensions are strictly rejected."""
    xlsx_path = str(DATASET_ROOT / "standard 1" / "mathematics" / "sample.xlsx")
    with pytest.raises(UnsupportedFormatError):
        sanitize_and_resolve_path(xlsx_path)


def test_valid_pdf_resolution():
    """Verify valid CMO PDF inside dataset root resolves correctly."""
    valid_pdf = DATASET_ROOT / "standard 1" / "mathematics" / "Class-1_31.pdf"
    if valid_pdf.exists():
        resolved = sanitize_and_resolve_path(str(valid_pdf))
        assert resolved == valid_pdf
        questions = extract_questions_from_pdf(resolved)
        assert isinstance(questions, list)
