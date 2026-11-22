"""
MindRush AI Subsystem - Deterministic Arithmetic Validator
Safely evaluates arithmetic expressions (+ and -) using AST evaluation.
Guarantees deterministic ground-truth verification without eval().
"""

import ast
import operator
import re
from typing import Any, Dict, Optional, Tuple

_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos
}


def _eval_ast_node(node: ast.AST) -> int:
    """Recursively evaluates an AST node restricted strictly to addition and subtraction integers."""
    if isinstance(node, ast.Constant):
        if isinstance(node.value, int):
            return node.value
        raise ValueError(f"Unsupported constant type: {type(node.value)}")
    elif isinstance(node, ast.BinOp):
        op_type = type(node.op)
        if op_type not in _OPERATORS:
            raise ValueError(f"Unsupported binary operator: {op_type}")
        left = _eval_ast_node(node.left)
        right = _eval_ast_node(node.right)
        return _OPERATORS[op_type](left, right)
    elif isinstance(node, ast.UnaryOp):
        op_type = type(node.op)
        if op_type not in _OPERATORS:
            raise ValueError(f"Unsupported unary operator: {op_type}")
        operand = _eval_ast_node(node.operand)
        return _OPERATORS[op_type](operand)
    else:
        raise ValueError(f"Unsupported AST node: {type(node)}")


def extract_and_evaluate_math(question_text: str) -> Optional[int]:
    """
    Finds arithmetic expression inside question stem (e.g., 'What is 12 + 5?', '18 - 6')
    and deterministically calculates its mathematical value via safe AST.
    """
    # Look for patterns like '12 + 5' or '35 - 12'
    expr_match = re.search(r"(\b\d+\s*[\+\-]\s*\d+(?:\s*[\+\-]\s*\d+)*\b)", question_text)
    if not expr_match:
        return None

    raw_expr = expr_match.group(1).strip()
    try:
        parsed_tree = ast.parse(raw_expr, mode="eval")
        return _eval_ast_node(parsed_tree.body)
    except Exception:
        return None


def validate_math_answer(question_text: str, claimed_answer: Any) -> Dict[str, Any]:
    """
    Validates claimed answer against deterministic recalculation.
    Returns:
      recalculated: int or None
      is_valid: bool
      has_math_expression: bool
    """
    recalc = extract_and_evaluate_math(question_text)
    if recalc is None:
        # Non-arithmetic or word problem where AST could not extract simple binary expression
        return {
            "has_math_expression": False,
            "recalculated": None,
            "is_valid": True,
            "message": "No direct binary arithmetic expression found; passes arithmetic check."
        }

    claimed_str = str(claimed_answer).strip()
    # Handle possible number string or direct numeric equality
    is_valid = False
    try:
        is_valid = (int(claimed_str) == recalc)
    except ValueError:
        is_valid = False

    return {
        "has_math_expression": True,
        "recalculated": recalc,
        "is_valid": is_valid,
        "message": f"Expected {recalc}, claimed {claimed_str}" if not is_valid else "Arithmetic verified"
    }
