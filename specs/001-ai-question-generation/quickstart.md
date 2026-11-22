# Quickstart Validation Guide: AI-Assisted Question Generation and Delivery

**Feature Branch**: `001-ai-question-generation`  
**Date**: 2026-11-20 (Final Targeted Correction Pass)  
**Governing Context**: Reconciled against `MindRush_AI_V1_Master_Prompt_for_Planning.txt`, Constitution v1.1.0, Feature 001 Spec, and Evidence Audit Report.

> [!NOTE]
> The scenarios below represent **implementation acceptance test procedures**. They specify how each completed feature slice will be verified during development and do not claim that unbuilt features currently pass.

---

## Prerequisites & Service Startup

Before executing the validation scenarios during implementation:

1. **MongoDB**: Local Community Server running on `mongodb://localhost:27017/MindRush` (or Atlas / in-memory fallback).
2. **Ollama Local Daemon**:
   ```powershell
   ollama serve
   # Verify Qwen3.5 4B model is installed:
   ollama list
   ```
3. **Node.js Express Server (Port 3000)**:
   ```powershell
   npm install
   npm start
   ```
4. **Python FastAPI AI Microservice (Port 5050)**:
   ```powershell
   cd MindRush-AI
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   python -m uvicorn ai_service.app:app --host 127.0.0.1 --port 5050
   ```

---

## Acceptance Test 1: Secure Administrator Provisioning

**Objective**: Verify that public signup strictly sets `role: 'player'`, and administrator accounts can only be provisioned via interactive CLI.

```powershell
# 1. Negative Test: Public signup attempting to assign role: 'admin'
curl -X POST http://localhost:3000/api/auth/signup `
  -H "Content-Type: application/json" `
  -d '{
    "fullName": "Test Cadet",
    "username": "cadet_test",
    "dob": "2000-01-01",
    "gender": "male",
    "password": "Password123!",
    "confirmPassword": "Password123!",
    "role": "admin",
    "terms": true
  }'
# Verify in database: user record MUST have role: 'player'

# 2. Positive Test: CLI Admin Provisioning
node server/scripts/create-admin.js --username=sysadmin
# Prompts interactively for password without exposing it in arguments or logs
```

---

## Acceptance Test 2: AI Microservice Health & Loopback Auth

**Objective**: Verify the Python AI service connects to Ollama, detects the GPU, and rejects unauthorized requests.

```powershell
# 1. Negative Test: Missing loopback secret
curl -i http://127.0.0.1:5050/health
# Expected: 401 Unauthorized

# 2. Positive Test: Authorized health check
curl http://127.0.0.1:5050/health `
  -H "X-Internal-Secret: dev_internal_secret_key"
```

**Expected Response (200 OK)**:
```json
{
  "status": "ok",
  "ollama_connected": true,
  "gpu_detected": true,
  "model_tag": "qwen3.5:4b",
  "context_limit": 2048,
  "active_generation": false
}
```

---

## Acceptance Test 3: Document Ingestion & Canonical Path Containment

**Objective**: Verify that valid CMO PDF extraction succeeds, while path traversal escapes (`..`), null bytes, symlinks, and unsupported extensions are rejected.

```powershell
# 1. Positive Test: Valid relative document extraction
curl -X POST http://127.0.0.1:5050/internal/documents/extract `
  -H "Content-Type: application/json" `
  -H "X-Internal-Secret: dev_internal_secret_key" `
  -d '{
    "relative_path": "standard 1/mathematics/CMO-Sample-Paper-for-Class-1.pdf",
    "file_format": "pdf"
  }'
# Expected: 200 OK with extracted_text and sample_questions

# 2. Negative Security Test: Path traversal escape attempt
curl -X POST http://127.0.0.1:5050/internal/documents/extract `
  -H "Content-Type: application/json" `
  -H "X-Internal-Secret: dev_internal_secret_key" `
  -d '{
    "relative_path": "../../../../Windows/System32/drivers/etc/hosts",
    "file_format": "pdf"
  }'
# Expected: 400 Bad Request ("PATH_TRAVERSAL_DETECTED")

# 3. Negative Security Test: Unauthorized file extension
curl -X POST http://127.0.0.1:5050/internal/documents/extract `
  -H "Content-Type: application/json" `
  -H "X-Internal-Secret: dev_internal_secret_key" `
  -d '{
    "relative_path": "standard 1/mathematics/secret.env",
    "file_format": "env"
  }'
# Expected: 400 Bad Request ("UNSUPPORTED_FORMAT")
```

---

## Acceptance Test 4: Generation Idempotency & Concurrency Lock

**Objective**: Verify that duplicate requests with the same idempotency key return the existing batch, conflicting payloads are rejected, and concurrency is capped at 1.

```powershell
# Authenticate as admin
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"username": "sysadmin", "password": "AdminPassword123!"}'

# 1. Initial batch request
curl -b cookies.txt -X POST http://localhost:3000/api/admin/generation `
  -H "Content-Type: application/json" `
  -H "X-Requested-With: MindRush-Admin" `
  -d '{
    "idempotency_key": "batch-key-001",
    "curriculum_id": "cmo-math-olympiad",
    "standard": 1,
    "subject": "mathematics",
    "topic": "addition",
    "difficulty": "medium",
    "count": 5
  }'
# Expected: 202 Accepted with batchId

# 2. Idempotency Test: Resubmitting identical key and payload
curl -b cookies.txt -X POST http://localhost:3000/api/admin/generation `
  -H "Content-Type: application/json" `
  -H "X-Requested-With: MindRush-Admin" `
  -d '{
    "idempotency_key": "batch-key-001",
    "curriculum_id": "cmo-math-olympiad",
    "standard": 1,
    "subject": "mathematics",
    "topic": "addition",
    "difficulty": "medium",
    "count": 5
  }'
# Expected: 200 OK / 202 Accepted returning the existing batchId

# 3. Idempotency Mismatch Test: Same key with differing payload
curl -b cookies.txt -X POST http://localhost:3000/api/admin/generation `
  -H "Content-Type: application/json" `
  -H "X-Requested-With: MindRush-Admin" `
  -d '{
    "idempotency_key": "batch-key-001",
    "curriculum_id": "cmo-math-olympiad",
    "standard": 1,
    "subject": "mathematics",
    "topic": "subtraction",
    "difficulty": "hard",
    "count": 10
  }'
# Expected: 409 Conflict ("IDEMPOTENCY_PAYLOAD_MISMATCH")
```

---

## Acceptance Test 5: Deterministic Math Validation & Review

**Objective**: Verify that generated questions undergo Python recalculation and enter `pending_review` without auto-approval.

```powershell
# Poll batch until completed
curl -b cookies.txt http://localhost:3000/api/admin/generation/BATCH_ID

# Review questions: Approve one, Reject one with reason
curl -b cookies.txt -X POST http://localhost:3000/api/admin/questions/QUESTION_ID_1/review `
  -H "Content-Type: application/json" `
  -H "X-Requested-With: MindRush-Admin" `
  -d '{"decision": "approved"}'

curl -b cookies.txt -X POST http://localhost:3000/api/admin/questions/QUESTION_ID_2/review `
  -H "Content-Type: application/json" `
  -H "X-Requested-With: MindRush-Admin" `
  -d '{"decision": "rejected", "reason": "Distractor options are confusing for Standard 1"}'
```

---

## Acceptance Test 6: Controlled Publication (Feature 001 Local Scope)

**Objective**: Verify sequential non-colliding ID assignment starting at 1001, staging to `.tmp` and atomic rename, with preservation of the original 100 questions.

```powershell
# Publish approved question
curl -b cookies.txt -X POST http://localhost:3000/api/admin/questions/publish `
  -H "Content-Type: application/json" `
  -H "X-Requested-With: MindRush-Admin" `
  -d '{"questionIds": ["QUESTION_ID_1"]}'
```

**Verification Script**:
```powershell
# 1. Verify published companion file
node -e "import('./public/js/game/educational-questions-published.js').then(m => {
  console.log('Published question count:', m.PUBLISHED_QUESTIONS.length);
  console.log('First published ID:', m.PUBLISHED_QUESTIONS[0].id, '(Expected >= 1001)');
})"

# 2. Verify all 100 original questions are unchanged
node -e "import('./public/js/game/educational-questions.js').then(m => {
  const originals = m.EDUCATIONAL_QUESTIONS.filter(q => q.id <= 100);
  console.log('Originals count:', originals.length, '(Expected: 100)');
  console.log('Total bank count:', m.EDUCATIONAL_QUESTIONS.length);
})"
```

---

## Acceptance Test 7: EducationalEngine Adapter & Answer Validation

**Objective**: Execute the 8 explicit engine acceptance test cases.

```powershell
node tests/test_educational_engine_adapter.mjs
```

**Explicit Test Cases Covered**:
1. **All 100 original questions**: Verified to resolve non-empty `questionText` and valid `correctIndex` matching `q.correctAnswer`.
2. **All 4 Option Positions**: Verification that correct answers located at indices 0, 1, 2, and 3 are mapped accurately.
3. **Missing `correctAnswer`**: Rejection error thrown when `correctAnswer` is undefined or empty string.
4. **Correct answer not matching any option**: Rejection error thrown (never silently defaulted to 0).
5. **Invalid or out-of-range existing `correctIndex`**: Rejection error thrown if `correctIndex < 0`, `>= options.length`, or not an integer (`!Number.isInteger(q.correctIndex)`).
6. **Existing `correctIndex` conflicting with `correctAnswer`**: Rejection error thrown if option at `correctIndex` does not match `correctAnswer`.
7. **Duplicate matching options**: Rejection error thrown if multiple options match `correctAnswer`.
8. **Shuffled options test**: Verifies that option shuffling in `QuestionDeck` preserves answer-to-option mapping.

---

## Acceptance Test 8: Backend Gameplay Delivery API & Player Reporting Capabilities

**Objective**: Verify the dynamic question retrieval and player reporting backend endpoints as prepared capabilities for future client adoption.

> [!NOTE]
> **Boundary Clarification**: In Feature 001, neither game engine is migrated to consume `/api/questions/random` and no in-game reporting UI is added. Actual gameplay uses `educational-questions-published.js`. This test verifies the backend routes and contract behavior in isolation. Disabling a question immediately excludes it from this API; withdrawing it from companion-file gameplay occurs on the next publication run.

```powershell
# 1. Retrieve dynamic questions from backend API capability
curl "http://localhost:3000/api/questions/random?standard=1&subject=mathematics&count=5"

# 2. Submit player question report to backend API
curl -X POST http://localhost:3000/api/questions/1001/report `
  -H "Content-Type: application/json" `
  -d '{
    "report_type": "typo",
    "description": "Minor typo in question stem."
  }'

# 3. Disable the reported question
curl -b cookies.txt -X POST http://localhost:3000/api/admin/questions/QUESTION_ID_1/disable `
  -H "Content-Type: application/json" `
  -H "X-Requested-With: MindRush-Admin"
# Note: Verification shows question is immediately excluded from /api/questions/random.
# The local companion file retains the question until the next publication run (which strictly excludes disabled questions).
```

---

## Acceptance Test 9: Mandatory Continuous Reporting Verification

**Objective**: Verify that all continuous reporting documents exist and record actual operations.

```powershell
Test-Path docs/DEVELOPMENT_LOG.md
Test-Path docs/CHANGELOG.md
Test-Path docs/FILE_CHANGE_REGISTER.md
Test-Path docs/TEST_REPORT.md
Test-Path docs/PROJECT_STATUS.md
```
