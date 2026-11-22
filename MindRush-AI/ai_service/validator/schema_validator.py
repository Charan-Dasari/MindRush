"""
MindRush AI Subsystem - Schema and Option Validator
Enforces structural integrity, non-empty distinct options, and correct answer consistency.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ValidationError


class OptionModel(BaseModel):
    id: str = Field(..., min_length=1)
    text: str = Field(..., min_length=1)


class CorrectAnswerModel(BaseModel):
    value: Any
    type: str = Field(..., pattern="^(number|string|boolean)$")


class MCQQuestionModel(BaseModel):
    question_text: str = Field(..., min_length=3)
    options: List[OptionModel] = Field(..., min_items=4, max_items=4)
    correct_option_id: str
    correct_answer: CorrectAnswerModel
    explanation: Optional[str] = None


def validate_mcq_schema(raw_question: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates MCQ question according to Feature 001 specifications:
    1. options has exactly 4 items
    2. All 4 option IDs are unique
    3. All 4 option texts are distinct and non-empty
    4. correct_option_id matches one of the option IDs
    5. String(correct_answer.value).strip() strictly equals the matching option's text
    6. No other option has identical text
    """
    errors: List[str] = []

    try:
        parsed = MCQQuestionModel(**raw_question)
    except ValidationError as e:
        return {
            "is_valid": False,
            "errors": [f"{err['loc']}: {err['msg']}" for err in e.errors()]
        }

    # Option ID uniqueness
    option_ids = [opt.id for opt in parsed.options]
    if len(set(option_ids)) != 4:
        errors.append("Options must have 4 unique IDs")

    # Option text uniqueness and non-empty
    option_texts = [opt.text.strip() for opt in parsed.options]
    if any(len(t) == 0 for t in option_texts):
        errors.append("All option texts must be non-empty")
    if len(set(option_texts)) != 4:
        errors.append("All 4 option texts must be distinct")

    # Correct option existence
    matched_opt = next((opt for opt in parsed.options if opt.id == parsed.correct_option_id), None)
    if not matched_opt:
        errors.append(f"correct_option_id '{parsed.correct_option_id}' does not match any option ID")
    else:
        # Consistency between correct_answer.value and matching option text
        claimed_val = str(parsed.correct_answer.value).strip()
        if claimed_val != matched_opt.text.strip():
            errors.append(
                f"correct_answer.value ('{claimed_val}') does not equal matching option text ('{matched_opt.text.strip()}')"
            )

    return {
        "is_valid": len(errors) == 0,
        "errors": errors
    }
