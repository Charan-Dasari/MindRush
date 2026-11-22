"""
MindRush AI Subsystem - Path Containment Boundary Tests
"""

import pytest
from pathlib import Path
from ai_service.extractor.pdf_extractor import sanitize_and_resolve_path, PathTraversalError
from ai_service.config import DATASET_ROOT


def test_root_containment_boundary():
    """Verify arbitrary filesystem escape attempts are blocked."""
    with pytest.raises(PathTraversalError):
        sanitize_and_resolve_path("C:/Windows/System32/calc.pdf")
