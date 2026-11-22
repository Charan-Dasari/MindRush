"""
Tests for benchmark validation functions and VRAMSampler lifecycle.
"""
from scripts.initial_model_benchmark import verify_math_correctness, validate_full_schema, VRAMSampler

def test_unsupported_math_pattern_returns_false():
    res, msg = verify_math_correctness("Find the secret number that shines like the sun", "5", "Geometry")
    assert res is False
    assert "unsupported" in msg

def test_supported_addition_pattern():
    res, msg = verify_math_correctness("What is 4 + 7?", "11", "Addition")
    assert res is True

def test_supported_subtraction_pattern():
    res, msg = verify_math_correctness("Calculate 10 - 3", "7", "Subtraction")
    assert res is True

def test_valid_schema():
    valid_q = {
        "question": "What is 5 + 3?",
        "options": [
            {"id": "A", "text": "8"},
            {"id": "B", "text": "9"},
            {"id": "C", "text": "7"},
            {"id": "D", "text": "6"}
        ],
        "correct_option_id": "A",
        "correct_answer": {"value": 8, "type": "number"},
        "explanation": "5 + 3 = 8",
        "topic": "Addition",
        "standard": 1,
        "difficulty": "easy"
    }
    ok, errs = validate_full_schema(valid_q, "Addition")
    assert ok is True
    assert len(errs) == 0

def test_invalid_schema_option_mismatch():
    invalid_q = {
        "question": "What is 5 + 3?",
        "options": [
            {"id": "A", "text": "8"},
            {"id": "B", "text": "9"},
            {"id": "C", "text": "7"},
            {"id": "D", "text": "6"}
        ],
        "correct_option_id": "B", # Mismatch: Option B is '9', value is 8
        "correct_answer": {"value": 8, "type": "number"},
        "explanation": "5 + 3 = 8",
        "topic": "Addition",
        "standard": 1,
        "difficulty": "easy"
    }
    ok, errs = validate_full_schema(invalid_q, "Addition")
    assert ok is False
    assert any("does not match" in e for e in errs)

def test_invalid_correct_answer_type_mismatch():
    # Value is string but type declares number
    q1 = {
        "question": "What is 5 + 3?",
        "options": [
            {"id": "A", "text": "eight"},
            {"id": "B", "text": "nine"},
            {"id": "C", "text": "seven"},
            {"id": "D", "text": "six"}
        ],
        "correct_option_id": "A",
        "correct_answer": {"value": "eight", "type": "number"},
        "explanation": "5 + 3 = 8",
        "topic": "Addition",
        "standard": 1,
        "difficulty": "easy"
    }
    ok, errs = validate_full_schema(q1, "Addition")
    assert ok is False
    assert any("must be numeric when type is 'number'" in e for e in errs)

    # Value is boolean (True) which is technically int subclass in Python
    q2 = {
        "question": "What is 5 + 3?",
        "options": [
            {"id": "A", "text": "True"},
            {"id": "B", "text": "False"},
            {"id": "C", "text": "7"},
            {"id": "D", "text": "6"}
        ],
        "correct_option_id": "A",
        "correct_answer": {"value": True, "type": "number"},
        "explanation": "5 + 3 = 8",
        "topic": "Addition",
        "standard": 1,
        "difficulty": "easy"
    }
    ok2, errs2 = validate_full_schema(q2, "Addition")
    assert ok2 is False
    assert any("must be numeric when type is 'number'" in e for e in errs2)

    # Value is number but type declares string
    q3 = {
        "question": "What is 5 + 3?",
        "options": [
            {"id": "A", "text": "8"},
            {"id": "B", "text": "9"},
            {"id": "C", "text": "7"},
            {"id": "D", "text": "6"}
        ],
        "correct_option_id": "A",
        "correct_answer": {"value": 8, "type": "string"},
        "explanation": "5 + 3 = 8",
        "topic": "Addition",
        "standard": 1,
        "difficulty": "easy"
    }
    ok3, errs3 = validate_full_schema(q3, "Addition")
    assert ok3 is False
    assert any("must be a string when type is 'string'" in e for e in errs3)

def test_invalid_option_count_and_duplicates():
    # Only 3 options
    q1 = {
        "question": "What is 5 + 3?",
        "options": [
            {"id": "A", "text": "8"},
            {"id": "B", "text": "9"},
            {"id": "C", "text": "7"}
        ],
        "correct_option_id": "A",
        "correct_answer": {"value": 8, "type": "number"},
        "explanation": "5 + 3 = 8",
        "topic": "Addition",
        "standard": 1,
        "difficulty": "easy"
    }
    ok, errs = validate_full_schema(q1, "Addition")
    assert ok is False
    assert any("exactly 4 elements" in e for e in errs)

    # Duplicate option text
    q2 = {
        "question": "What is 5 + 3?",
        "options": [
            {"id": "A", "text": "8"},
            {"id": "B", "text": "8"}, # Duplicate text
            {"id": "C", "text": "7"},
            {"id": "D", "text": "6"}
        ],
        "correct_option_id": "A",
        "correct_answer": {"value": 8, "type": "number"},
        "explanation": "5 + 3 = 8",
        "topic": "Addition",
        "standard": 1,
        "difficulty": "easy"
    }
    ok2, errs2 = validate_full_schema(q2, "Addition")
    assert ok2 is False
    assert any("distinct" in e for e in errs2)

def test_sampler_lifecycle_and_stop():
    sampler = VRAMSampler(interval_sec=0.01)
    sampler.start()
    assert sampler._thread is not None
    assert sampler._thread.is_alive()
    peak = sampler.stop()
    assert not sampler._thread.is_alive()
    assert peak >= 0
