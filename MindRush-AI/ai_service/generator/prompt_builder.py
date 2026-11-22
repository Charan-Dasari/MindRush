"""
MindRush AI Subsystem - Few-Shot Prompt Builder
Constructs high-precision generation prompts incorporating verified canonical questions
and extracted source questions for Standard 1 Mathematics.
"""

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

# Path to the 100 canonical verified questions
CANONICAL_QUESTIONS_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "public"
    / "js"
    / "game"
    / "educational-questions.js"
)

_cached_canonical_questions: Optional[List[Dict[str, Any]]] = None


def load_canonical_questions() -> List[Dict[str, Any]]:
    """
    Parses verified canonical questions from educational-questions.js.
    Caches parsed result in memory.
    """
    global _cached_canonical_questions
    if _cached_canonical_questions is not None:
        return _cached_canonical_questions

    if not CANONICAL_QUESTIONS_PATH.exists():
        return []

    content = CANONICAL_QUESTIONS_PATH.read_text(encoding="utf-8")
    # Match ORIGINAL_QUESTIONS or EDUCATIONAL_QUESTIONS array
    match = re.search(r"(?:export\s+)?const\s+(?:ORIGINAL_QUESTIONS|EDUCATIONAL_QUESTIONS)\s*=\s*(\[[\s\S]*?\]);", content)
    if not match:
        return []

    raw_array = match.group(1)
    try:
        # Standard JSON parsing
        questions = json.loads(raw_array)
        _cached_canonical_questions = questions
        return questions
    except Exception:
        # Fallback regex extraction if raw_array has JS quirks
        questions = []
        q_blocks = re.findall(r"\{[^{}]*\"id\"[^{}]*\}", raw_array)
        for block in q_blocks:
            try:
                questions.append(json.loads(block))
            except Exception:
                pass
        _cached_canonical_questions = questions
        return questions


class PromptBuilder:
    def __init__(self, canonical_questions: Optional[List[Dict[str, Any]]] = None):
        self.canonical_questions = canonical_questions if canonical_questions is not None else load_canonical_questions()

    def get_reference_examples(
        self,
        topic: str,
        limit: int = 3,
        source_questions: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieves matching reference questions for the specified topic.
        Prioritizes extracted source questions (CMO) if supplied, supplemented by canonical questions.
        """
        refs = []
        topic_lower = topic.strip().lower()

        # 1. Use extracted CMO questions if available
        if source_questions:
            for sq in source_questions:
                sq_topic = (sq.get("topic") or "").strip().lower()
                if sq_topic == topic_lower or not sq_topic:
                    refs.append({
                        "question": sq.get("question_text", ""),
                        "options": sq.get("options", []),
                        "correctAnswer": str(sq.get("correct_answer", ""))
                    })
                if len(refs) >= limit:
                    return refs

        # 2. Supplement from canonical questions
        for cq in self.canonical_questions:
            cq_topic = (cq.get("topic") or "").strip().lower()
            if cq_topic == topic_lower or topic_lower in cq_topic:
                refs.append({
                    "question": cq.get("question", ""),
                    "options": cq.get("options", []),
                    "correctAnswer": str(cq.get("correctAnswer", ""))
                })
            if len(refs) >= limit:
                break

        # Fallback if no exact topic match: take first available canonical questions
        if not refs and self.canonical_questions:
            for cq in self.canonical_questions[:limit]:
                refs.append({
                    "question": cq.get("question", ""),
                    "options": cq.get("options", []),
                    "correctAnswer": str(cq.get("correctAnswer", ""))
                })

        return refs

    def build_generation_prompt(
        self,
        curriculum_name: str,
        standard: int,
        subject: str,
        topic: str,
        difficulty: str,
        count: int = 5,
        source_questions: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, str]:
        """
        Builds system prompt and user prompt enforcing exact MCQ schema:
        options array of 4 { id: "A"|"B"|"C"|"D", text: string },
        correct_option_id: string,
        correct_answer: { value: string|number, type: "number"|"string" }
        """
        examples = self.get_reference_examples(topic, limit=2, source_questions=source_questions)
        
        system_prompt = (
            "You are an expert elementary school curriculum designer specializing in primary education "
            "and mathematics olympiads for young children. You generate mathematically rigorous, "
            "pedagogically sound, age-appropriate multiple choice questions adhering strictly to JSON output."
        )

        formatted_examples = []
        for ex in examples:
            options = ex.get("options", [])
            opt_objs = []
            letter_keys = ["A", "B", "C", "D"]
            correct_id = "A"
            for i, opt in enumerate(options[:4]):
                letter = letter_keys[i] if i < len(letter_keys) else str(i)
                opt_objs.append({"id": letter, "text": str(opt)})
                if str(opt).strip() == str(ex.get("correctAnswer", "")).strip():
                    correct_id = letter

            formatted_examples.append({
                "question_text": ex.get("question", ""),
                "options": opt_objs,
                "correct_option_id": correct_id,
                "correct_answer": {
                    "value": ex.get("correctAnswer", ""),
                    "type": "number" if str(ex.get("correctAnswer", "")).isdigit() else "string"
                },
                "explanation": "Calculated directly based on primary grade math concepts."
            })

        user_prompt = f"""Generate {count} distinct Multiple Choice Questions (MCQ) for students.

Curriculum: {curriculum_name}
Grade / Standard: Standard {standard} (Ages 5-7)
Subject: {subject}
Topic: {topic}
Difficulty: {difficulty}

Target Specifications:
1. Standard {standard} Mathematics: Keep numbers between 0 and 100. Use clear, simple language.
2. Each question MUST have exactly 4 options labeled A, B, C, and D.
3. All 4 options MUST be distinct and non-empty.
4. One and only one option MUST be the mathematically correct answer.
5. The `correct_option_id` MUST be one of "A", "B", "C", "D".
6. The `correct_answer.value` as a trimmed string MUST strictly equal the `text` of that option.
7. Return a JSON object with a single key "questions" containing an array of question objects.

Reference Examples:
{json.dumps(formatted_examples, indent=2)}

Output ONLY valid JSON matching this exact structure:
{{
  "questions": [
    {{
      "question_text": "Question stem here?",
      "options": [
        {{ "id": "A", "text": "10" }},
        {{ "id": "B", "text": "12" }},
        {{ "id": "C", "text": "14" }},
        {{ "id": "D", "text": "16" }}
      ],
      "correct_option_id": "B",
      "correct_answer": {{
        "value": "12",
        "type": "number"
      }},
      "explanation": "Brief explanation of how the answer is derived."
    }}
  ]
}}
"""
        return {
            "system": system_prompt,
            "prompt": user_prompt
        }
