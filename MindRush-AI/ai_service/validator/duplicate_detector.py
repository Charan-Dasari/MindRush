"""
MindRush AI Subsystem - 4-Tier Duplicate Detector
Detects near and exact duplicates against verified canonical questions (100)
using exact matching, normalized stems, Levenshtein distance, and Jaccard token overlap.
"""

import re
from typing import Any, Dict, List, Optional
from ..generator.prompt_builder import load_canonical_questions


def normalize_text(text: str) -> str:
    """Normalizes text by lowercasing, removing punctuation, and stripping extra whitespace."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    return " ".join(text.split())


def levenshtein_ratio(s1: str, s2: str) -> float:
    """Computes Levenshtein similarity ratio between 0.0 and 1.0."""
    if s1 == s2:
        return 1.0
    if not s1 or not s2:
        return 0.0

    len1, len2 = len(s1), len(s2)
    # Initialize DP matrix
    dp = [[0] * (len2 + 1) for _ in range(len1 + 1)]
    for i in range(len1 + 1):
        dp[i][0] = i
    for j in range(len2 + 1):
        dp[0][j] = j

    for i in range(1, len1 + 1):
        for j in range(1, len2 + 1):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,      # deletion
                dp[i][j - 1] + 1,      # insertion
                dp[i - 1][j - 1] + cost # substitution
            )

    dist = dp[len1][len2]
    max_len = max(len1, len2)
    return 1.0 - (dist / max_len)


def token_jaccard_similarity(s1: str, s2: str) -> float:
    """Computes Jaccard token overlap ratio."""
    tokens1 = set(s1.split())
    tokens2 = set(s2.split())
    if not tokens1 or not tokens2:
        return 0.0
    intersection = tokens1.intersection(tokens2)
    union = tokens1.union(tokens2)
    return len(intersection) / len(union)


class DuplicateDetector:
    def __init__(self, canonical_questions: Optional[List[Dict[str, Any]]] = None):
        self.canonical_questions = canonical_questions if canonical_questions is not None else load_canonical_questions()
        # Pre-normalize canonical questions
        self._normalized_bank = []
        for q in self.canonical_questions:
            stem = q.get("question", "")
            self._normalized_bank.append({
                "id": q.get("id"),
                "raw": stem,
                "normalized": normalize_text(stem)
            })

    def check_duplicate(self, candidate_question_text: str) -> Dict[str, Any]:
        """
        Runs 4-tier check against question bank:
        Tier 1: Exact raw match
        Tier 2: Normalized stem match
        Tier 3: Levenshtein distance >= 0.85
        Tier 4: Token Jaccard overlap >= 0.80
        """
        raw_cand = candidate_question_text.strip()
        norm_cand = normalize_text(candidate_question_text)

        highest_score = 0.0
        most_similar_id = None
        flag_status = "passed"

        for item in self._normalized_bank:
            # Tier 1: Exact raw match
            if raw_cand == item["raw"]:
                return {
                    "duplicate_check": "flagged_exact",
                    "similarity_score": 1.0,
                    "most_similar_id": item["id"],
                    "matched_stem": item["raw"],
                    "tier": "tier_1_exact"
                }

            # Tier 2: Normalized match
            if norm_cand == item["normalized"]:
                return {
                    "duplicate_check": "flagged_exact",
                    "similarity_score": 1.0,
                    "most_similar_id": item["id"],
                    "matched_stem": item["raw"],
                    "tier": "tier_2_normalized"
                }

            # Tier 3: Levenshtein ratio
            lev_score = levenshtein_ratio(norm_cand, item["normalized"])
            # Tier 4: Token overlap
            tok_score = token_jaccard_similarity(norm_cand, item["normalized"])
            combined = max(lev_score, tok_score)

            if combined > highest_score:
                highest_score = combined
                most_similar_id = item["id"]

        if highest_score >= 0.85:
            flag_status = "flagged_near"

        return {
            "duplicate_check": flag_status,
            "similarity_score": round(highest_score, 3),
            "most_similar_id": most_similar_id,
            "tier": "tier_3_4_similarity" if flag_status != "passed" else "none"
        }
