"""
MindRush AI Subsystem - Math and Duplicate Validator Tests
"""

import pytest
from ai_service.validator.math_validator import extract_and_evaluate_math, validate_math_answer
from ai_service.validator.duplicate_detector import DuplicateDetector, levenshtein_ratio, token_jaccard_similarity
from ai_service.validator.schema_validator import validate_mcq_schema


def test_math_validator_addition():
    """Verify deterministic safe AST evaluation for addition."""
    val = extract_and_evaluate_math("What is 15 + 24?")
    assert val == 39

    res = validate_math_answer("What is 15 + 24?", "39")
    assert res["is_valid"] is True
    assert res["recalculated"] == 39

    res_fail = validate_math_answer("What is 15 + 24?", "40")
    assert res_fail["is_valid"] is False


def test_math_validator_subtraction():
    """Verify deterministic safe AST evaluation for subtraction."""
    val = extract_and_evaluate_math("Calculate 50 - 18.")
    assert val == 32

    res = validate_math_answer("Calculate 50 - 18.", 32)
    assert res["is_valid"] is True

    res_fail = validate_math_answer("Calculate 50 - 18.", 30)
    assert res_fail["is_valid"] is False


def test_duplicate_detector_exact_and_normalized():
    """Verify duplicate detector catches exact match from canonical questions."""
    detector = DuplicateDetector()
    # Question 1 is: "Which number is shown by 4 tens and 7 ones?"
    res = detector.check_duplicate("Which number is shown by 4 tens and 7 ones?")
    assert res["duplicate_check"] == "flagged_exact"
    assert res["similarity_score"] == 1.0
    assert res["most_similar_id"] == 1

    # Case insensitive + punctuation normalized match
    res_norm = detector.check_duplicate("  which number is shown by 4 tens and 7 ones?!!  ")
    assert res_norm["duplicate_check"] == "flagged_exact"


def test_schema_validator_rules():
    """Verify MCQ schema validation rules."""
    valid_q = {
        "question_text": "What is 10 + 5?",
        "options": [
            {"id": "A", "text": "14"},
            {"id": "B", "text": "15"},
            {"id": "C", "text": "16"},
            {"id": "D", "text": "17"}
        ],
        "correct_option_id": "B",
        "correct_answer": {"value": "15", "type": "number"}
    }
    res = validate_mcq_schema(valid_q)
    assert res["is_valid"] is True

    # Duplicate option text should fail
    dup_options_q = {
        **valid_q,
        "options": [
            {"id": "A", "text": "15"},
            {"id": "B", "text": "15"},
            {"id": "C", "text": "16"},
            {"id": "D", "text": "17"}
        ]
    }
    assert validate_mcq_schema(dup_options_q)["is_valid"] is False

    # Mismatched correct answer value should fail
    mismatch_q = {
        **valid_q,
        "correct_answer": {"value": "99", "type": "number"}
    }
    assert validate_mcq_schema(mismatch_q)["is_valid"] is False
