"""
MindRush AI - Initial Feasibility Benchmark for Candidate Model (qwen3.5:4b)
T002 Follow-Up: Local Hardware Feasibility Test
Hardware: Windows 11, 16 GB System RAM, NVIDIA GeForce RTX 3050 Ti (4 GB VRAM)
"""

import json
import time
import subprocess
import threading
import re
import os
import httpx
import psutil

OLLAMA_API_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "qwen3.5:4b"

TEST_PROMPTS = [
    {
        "topic": "Addition",
        "prompt": """You are an expert primary school mathematics teacher creating questions for Standard 1 (Grade 1, ages 6-7).
Generate 1 new, original Standard 1 Mathematics multiple-choice question on the topic 'Addition'.

Reference examples from verified curriculum:
Example 1:
Question: What is 4 + 5?
Options: [{"id": "A", "text": "8"}, {"id": "B", "text": "9"}, {"id": "C", "text": "10"}, {"id": "D", "text": "7"}]
Correct Option: B (9)

Example 2:
Question: Riya has 3 apples. Her brother gives her 4 more apples. How many apples does she have altogether?
Options: [{"id": "A", "text": "6"}, {"id": "B", "text": "7"}, {"id": "C", "text": "8"}, {"id": "D", "text": "5"}]
Correct Option: B (7)

Strict Output Schema:
You must respond ONLY with a valid JSON object matching this schema:
{
  "question": "string",
  "options": [
    {"id": "A", "text": "string"},
    {"id": "B", "text": "string"},
    {"id": "C", "text": "string"},
    {"id": "D", "text": "string"}
  ],
  "correct_option_id": "A" or "B" or "C" or "D",
  "correct_answer": {
    "value": number or string,
    "type": "number" or "string"
  },
  "explanation": "step by step explanation",
  "topic": "Addition",
  "standard": 1,
  "difficulty": "easy"
}
Do not include any thinking tags, markdown blocks, or text outside the JSON object.
"""
    },
    {
        "topic": "Subtraction",
        "prompt": """You are an expert primary school mathematics teacher creating questions for Standard 1 (Grade 1, ages 6-7).
Generate 1 new, original Standard 1 Mathematics multiple-choice question on the topic 'Subtraction'.

Reference examples from verified curriculum:
Example 1:
Question: What is 9 - 4?
Options: [{"id": "A", "text": "6"}, {"id": "B", "text": "5"}, {"id": "C", "text": "4"}, {"id": "D", "text": "3"}]
Correct Option: B (5)

Example 2:
Question: There are 8 birds sitting on a tree branch. 3 birds fly away. How many birds are left on the branch?
Options: [{"id": "A", "text": "5"}, {"id": "B", "text": "6"}, {"id": "C", "text": "4"}, {"id": "D", "text": "7"}]
Correct Option: A (5)

Strict Output Schema:
You must respond ONLY with a valid JSON object matching this schema:
{
  "question": "string",
  "options": [
    {"id": "A", "text": "string"},
    {"id": "B", "text": "string"},
    {"id": "C", "text": "string"},
    {"id": "D", "text": "string"}
  ],
  "correct_option_id": "A" or "B" or "C" or "D",
  "correct_answer": {
    "value": number or string,
    "type": "number" or "string"
  },
  "explanation": "step by step explanation",
  "topic": "Subtraction",
  "standard": 1,
  "difficulty": "easy"
}
Do not include any thinking tags, markdown blocks, or text outside the JSON object.
"""
    },
    {
        "topic": "Numerals",
        "prompt": """You are an expert primary school mathematics teacher creating questions for Standard 1 (Grade 1, ages 6-7).
Generate 1 new, original Standard 1 Mathematics multiple-choice question on the topic 'Numerals' (number sequence or place value tens and ones).

Reference examples from verified curriculum:
Example 1:
Question: Which number comes before 40?
Options: [{"id": "A", "text": "39"}, {"id": "B", "text": "41"}, {"id": "C", "text": "30"}, {"id": "D", "text": "49"}]
Correct Option: A (39)

Example 2:
Question: Which number is shown by 4 tens and 7 ones?
Options: [{"id": "A", "text": "74"}, {"id": "B", "text": "47"}, {"id": "C", "text": "44"}, {"id": "D", "text": "17"}]
Correct Option: B (47)

Strict Output Schema:
You must respond ONLY with a valid JSON object matching this schema:
{
  "question": "string",
  "options": [
    {"id": "A", "text": "string"},
    {"id": "B", "text": "string"},
    {"id": "C", "text": "string"},
    {"id": "D", "text": "string"}
  ],
  "correct_option_id": "A" or "B" or "C" or "D",
  "correct_answer": {
    "value": number or string,
    "type": "number" or "string"
  },
  "explanation": "step by step explanation",
  "topic": "Numerals",
  "standard": 1,
  "difficulty": "easy"
}
Do not include any thinking tags, markdown blocks, or text outside the JSON object.
"""
    }
]

def get_gpu_metrics():
    """Queries NVIDIA SMI for current GPU VRAM and utilization."""
    try:
        cmd = ["nvidia-smi", "--query-gpu=memory.used,memory.total,utilization.gpu", "--format=csv,noheader,nounits"]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=2.0)
        parts = res.stdout.strip().split(",")
        return {
            "vram_used_mib": int(parts[0].strip()),
            "vram_total_mib": int(parts[1].strip()),
            "gpu_util_percent": int(parts[2].strip())
        }
    except Exception as e:
        return {"error": str(e), "vram_used_mib": None, "vram_total_mib": 4096, "gpu_util_percent": None}

class VRAMSampler:
    """Continuously samples GPU VRAM during inference to record peak sampled utilization."""
    def __init__(self, interval_sec: float = 0.05):
        self.interval = interval_sec
        self.peak_vram_mib = 0
        self._stop = threading.Event()
        self._thread = None

    def _sample(self):
        while not self._stop.is_set():
            metrics = get_gpu_metrics()
            used = metrics.get("vram_used_mib")
            if used and used > self.peak_vram_mib:
                self.peak_vram_mib = used
            time.sleep(self.interval)

    def start(self):
        initial = get_gpu_metrics().get("vram_used_mib") or 0
        self.peak_vram_mib = initial
        self._stop.clear()
        self._thread = threading.Thread(target=self._sample, daemon=True)
        self._thread.start()

    def stop(self) -> int:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=1.0)
        final = get_gpu_metrics().get("vram_used_mib") or 0
        if final > self.peak_vram_mib:
            self.peak_vram_mib = final
        return self.peak_vram_mib

def verify_math_correctness(question_text: str, correct_val_str: str, topic: str):
    """
    Deterministic arithmetic check for standard 1 math.
    CRITICAL: Unsupported mathematical patterns must be reported as unverified, NOT automatically correct.
    """
    try:
        val = int(correct_val_str)
    except ValueError:
        return False, f"Non-integer answer value '{correct_val_str}' cannot be arithmetically verified"

    # Look for patterns like X + Y
    add_match = re.search(r'(\d+)\s*\+\s*(\d+)', question_text)
    if add_match:
        a, b = int(add_match.group(1)), int(add_match.group(2))
        return (val == a + b), f"Expected {a + b}, got {val}"

    # Look for patterns like X - Y
    sub_match = re.search(r'(\d+)\s*-\s*(\d+)', question_text)
    if sub_match:
        a, b = int(sub_match.group(1)), int(sub_match.group(2))
        return (val == a - b), f"Expected {a - b}, got {val}"

    # Look for 'comes after X'
    after_match = re.search(r'comes after\s+(\d+)', question_text, re.IGNORECASE)
    if after_match:
        a = int(after_match.group(1))
        return (val == a + 1), f"Expected {a + 1}, got {val}"

    # Look for 'comes before X'
    before_match = re.search(r'comes before\s+(\d+)', question_text, re.IGNORECASE)
    if before_match:
        a = int(before_match.group(1))
        return (val == a - 1), f"Expected {a - 1}, got {val}"

    # Look for 'X tens and Y ones'
    tens_match = re.search(r'(\d+)\s+tens\s+and\s+(\d+)\s+ones', question_text, re.IGNORECASE)
    if tens_match:
        t, o = int(tens_match.group(1)), int(tens_match.group(2))
        expected = t * 10 + o
        return (val == expected), f"Expected {expected}, got {val}"

    # Word problem two-number fallback
    numbers = [int(n) for n in re.findall(r'\b\d+\b', question_text)]
    if len(numbers) >= 2:
        if topic == "Addition":
            if val == sum(numbers[:2]):
                return True, f"Word problem sum verified: {numbers[0]} + {numbers[1]} = {val}"
            else:
                return False, f"Word problem sum failed: expected {sum(numbers[:2])}, got {val}"
        elif topic == "Subtraction":
            if val == numbers[0] - numbers[1]:
                return True, f"Word problem difference verified: {numbers[0]} - {numbers[1]} = {val}"
            else:
                return False, f"Word problem difference failed: expected {numbers[0] - numbers[1]}, got {val}"

    # Unsupported pattern must be reported as unverified (not automatically correct)
    return False, "unsupported mathematical pattern (unverified)"

def validate_full_schema(parsed: dict, topic: str):
    """Validates all required fields, data types, and logical consistency."""
    errors = []

    # 1. Question stem
    q = parsed.get("question")
    if not isinstance(q, str) or not q.strip():
        errors.append("Question stem must be a non-empty string")

    # 2. Options array
    opts = parsed.get("options")
    if not isinstance(opts, list) or len(opts) != 4:
        errors.append("Options must be an array of exactly 4 elements")
    else:
        opt_ids = [o.get("id") for o in opts if isinstance(o, dict)]
        if set(opt_ids) != {"A", "B", "C", "D"}:
            errors.append(f"Option IDs must be exactly ['A', 'B', 'C', 'D'], got {opt_ids}")
        opt_texts = [str(o.get("text", "")).strip() for o in opts if isinstance(o, dict)]
        if len(set(opt_texts)) != 4 or any(len(t) == 0 for t in opt_texts):
            errors.append("All 4 option texts must be distinct and non-empty")

    # 3. Correct option ID
    corr_id = parsed.get("correct_option_id")
    if corr_id not in ["A", "B", "C", "D"]:
        errors.append(f"correct_option_id must be 'A', 'B', 'C', or 'D', got {corr_id}")

    # 4. Correct answer object
    ca = parsed.get("correct_answer")
    if not isinstance(ca, dict) or "value" not in ca or ca.get("type") not in ["number", "string"]:
        errors.append("correct_answer must be an object with 'value' and 'type' ('number' or 'string')")
    else:
        ca_type = ca.get("type")
        ca_val = ca.get("value")
        if ca_type == "number":
            if isinstance(ca_val, bool) or not isinstance(ca_val, (int, float)):
                errors.append(f"correct_answer.value must be numeric when type is 'number', got {type(ca_val).__name__}")
        elif ca_type == "string":
            if not isinstance(ca_val, str):
                errors.append(f"correct_answer.value must be a string when type is 'string', got {type(ca_val).__name__}")

        # Check alignment between correct_option_id text and correct_answer.value
        if isinstance(opts, list) and corr_id:
            matching = [o for o in opts if isinstance(o, dict) and o.get("id") == corr_id]
            if matching:
                opt_text = str(matching[0].get("text", "")).strip()
                ans_val = str(ca_val).strip()
                if opt_text != ans_val:
                    errors.append(f"correct_option_id '{corr_id}' text ('{opt_text}') does not match correct_answer.value ('{ans_val}')")
            else:
                errors.append(f"No option found matching correct_option_id '{corr_id}'")

    # 5. Explanation
    exp = parsed.get("explanation")
    if not isinstance(exp, str) or not exp.strip():
        errors.append("Explanation must be a non-empty string")

    # 6. Topic
    top = parsed.get("topic")
    if not isinstance(top, str) or top.strip().lower() != topic.lower():
        errors.append(f"Topic must be '{topic}', got '{top}'")

    # 7. Standard
    std = parsed.get("standard")
    if std != 1:
        errors.append(f"Standard must be integer 1, got {std}")

    # 8. Difficulty
    diff = parsed.get("difficulty")
    if diff not in ["easy", "medium", "hard"]:
        errors.append(f"Difficulty must be 'easy', 'medium', or 'hard', got {diff}")

    return (len(errors) == 0), errors

def run_benchmark_test(test_idx: int, test_spec: dict):
    topic = test_spec["topic"]
    prompt = test_spec["prompt"]
    print(f"\n==================================================")
    print(f" Test {test_idx}: Topic '{topic}'")
    print(f"==================================================")

    process = psutil.Process()
    ram_process_before_mb = process.memory_info().rss / (1024 * 1024)
    ram_avail_before_mb = psutil.virtual_memory().available / (1024 * 1024)
    gpu_before = get_gpu_metrics()

    print(f"GPU VRAM Before: {gpu_before.get('vram_used_mib')} MiB / {gpu_before.get('vram_total_mib')} MiB")
    print(f"Process RSS Before: {ram_process_before_mb:.1f} MB | System Available RAM: {ram_avail_before_mb:.1f} MB")

    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "format": "json",
        "stream": False,
        "think": False,
        "options": {
            "num_ctx": 2048,
            "num_predict": 350,
            "temperature": 0.3
        }
    }

    sampler = VRAMSampler(interval_sec=0.05)
    sampler.start()

    start_time = time.perf_counter()
    try:
        with httpx.Client(trust_env=False, timeout=180.0) as client:
            resp = client.post(OLLAMA_API_URL, json=payload)
    finally:
        peak_vram_sampled_mib = sampler.stop()
    elapsed_time = time.perf_counter() - start_time

    gpu_after = get_gpu_metrics()
    ram_process_after_mb = process.memory_info().rss / (1024 * 1024)
    ram_avail_after_mb = psutil.virtual_memory().available / (1024 * 1024)

    if resp.status_code != 200:
        print(f"[FAIL] Ollama returned status {resp.status_code}: {resp.text}")
        return None

    data = resp.json()
    response_text = data.get("response", "").strip()

    # Schema Validation
    json_valid = False
    parsed_json = None
    schema_compliant = False
    schema_errors = []
    math_correct = False
    math_note = ""

    try:
        parsed_json = json.loads(response_text)
        json_valid = True
        schema_compliant, schema_errors = validate_full_schema(parsed_json, topic)

        corr_val = str(parsed_json.get("correct_answer", {}).get("value", "")).strip()
        q_text = parsed_json.get("question", "")
        math_correct, math_note = verify_math_correctness(q_text, corr_val, topic)
    except Exception as e:
        schema_errors.append(f"JSON decode error: {str(e)}")

    eval_count = data.get("eval_count", 0)
    eval_duration_ms = data.get("eval_duration", 0) / 1_000_000
    tokens_per_sec = (eval_count / (eval_duration_ms / 1000)) if eval_duration_ms > 0 else 0

    print(f"Elapsed Wall-Clock Time: {elapsed_time:.2f} s")
    print(f"Generated Tokens: {eval_count} | Speed: {tokens_per_sec:.2f} tokens/s")
    print(f"Measured Peak Sampled VRAM during Inference: {peak_vram_sampled_mib} MiB")
    print(f"GPU VRAM Reading After: {gpu_after.get('vram_used_mib')} MiB")
    print(f"Process RSS After: {ram_process_after_mb:.1f} MB | System Available RAM: {ram_avail_after_mb:.1f} MB")
    print(f"JSON Syntax Valid: {json_valid}")
    print(f"Overall Schema Compliant: {schema_compliant}")
    if schema_errors:
        print(f"Schema Errors: {schema_errors}")
    print(f"Math Correctness: {math_correct} ({math_note})")

    if parsed_json:
        print(f"Stem: {parsed_json.get('question')}")
        print(f"Options: {[(o.get('id'), o.get('text')) for o in parsed_json.get('options', [])]}")
        print(f"Correct: {parsed_json.get('correct_option_id')} -> {parsed_json.get('correct_answer')}")

    return {
        "test_idx": test_idx,
        "topic": topic,
        "elapsed_seconds": elapsed_time,
        "tokens_per_sec": tokens_per_sec,
        "eval_tokens": eval_count,
        "gpu_vram_before_mib": gpu_before.get("vram_used_mib"),
        "gpu_vram_after_mib": gpu_after.get("vram_used_mib"),
        "gpu_vram_peak_sampled_mib": peak_vram_sampled_mib,
        "gpu_vram_total_mib": gpu_after.get("vram_total_mib"),
        "gpu_util_percent": gpu_after.get("gpu_util_percent"),
        "process_rss_mb": ram_process_after_mb,
        "system_ram_available_mb": ram_avail_after_mb,
        "json_valid": json_valid,
        "schema_compliant": schema_compliant,
        "schema_errors": schema_errors,
        "math_correct": math_correct,
        "math_note": math_note,
        "output": parsed_json
    }

def main():
    print("=" * 60)
    print(" MindRush AI - qwen3.5:4b Candidate Model Benchmark")
    print(" Peak Sampled Telemetry & Strict Field Validation")
    print("=" * 60)

    # Preserve historical results if present
    hist_path = "MindRush-AI/scripts/initial_benchmark_results_historical.json"
    curr_path = "MindRush-AI/scripts/initial_benchmark_results.json"
    if os.path.exists(curr_path) and not os.path.exists(hist_path):
        import shutil
        shutil.copyfile(curr_path, hist_path)
        print(f"[PRESERVED] Historical benchmark results backed up to {hist_path}")

    results = []
    for idx, test_spec in enumerate(TEST_PROMPTS, 1):
        res = run_benchmark_test(idx, test_spec)
        if res:
            results.append(res)
        time.sleep(1)

    print("\n" + "=" * 60)
    print(" FINAL BENCHMARK AUDIT REPORT")
    print("=" * 60)
    total_tests = len(results)
    print(f"Total Tests Executed: {total_tests}")
    
    if results:
        json_passed = sum(1 for r in results if r["json_valid"])
        schema_passed = sum(1 for r in results if r["schema_compliant"])
        math_passed = sum(1 for r in results if r["math_correct"])
        avg_speed = sum(r["tokens_per_sec"] for r in results) / total_tests
        max_sampled_vram = max((r["gpu_vram_peak_sampled_mib"] or 0) for r in results)
        avg_time = sum(r["elapsed_seconds"] for r in results) / total_tests

        print(f"JSON Syntax Valid Rate: {json_passed}/{total_tests}")
        print(f"Schema Compliance Pass Rate: {schema_passed}/{total_tests}")
        print(f"Math Verification Pass Rate: {math_passed}/{total_tests}")
        print(f"Average Generation Speed: {avg_speed:.2f} tokens/second")
        print(f"Average Latency: {avg_time:.2f} seconds")
        print(f"Peak Sampled VRAM during Inference: {max_sampled_vram} MiB / 4096 MiB ({max_sampled_vram / 4096 * 100:.1f}%)")

        with open(curr_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2)
        print(f"Results successfully saved to {curr_path}")
    else:
        print("[FAIL] No benchmark tests succeeded.")

if __name__ == "__main__":
    main()
