# API Contracts: Question Management, AI Service, and Game Delivery

**Feature Branch**: `001-ai-question-generation`  
**Date**: 2026-11-20 (Final Targeted Correction Pass)  
**Governing Context**: Reconciled against `MindRush_AI_V1_Master_Prompt_for_Planning.txt` Phase 9, Constitution v1.1.0, and Feature 001 Spec.

---

## Architecture Overview: Two-Tier API Boundary

```text
Browser / Game Client ────────► Node.js / Express Backend (Port 3000)
                                 │  • Session Auth & requireAdmin Middleware
                                 │  • Sole Authoritative Writer to MongoDB
                                 │  • Mutex Concurrency Lock & Idempotency
                                 │  • Game Delivery & Reporting
                                 ▼ (Authenticated Loopback HTTP)
                               Python FastAPI AI Service (Port 5050)
                                 │  • Strictly Local (127.0.0.1)
                                 │  • Path-Sanitized Document Extraction
                                 │  • Ollama Communication (Qwen3.5 4B)
                                 │  • Deterministic Arithmetic Validation
                                 ▼
                               Ollama Local Daemon (Port 11434)
```

1. **Tier 1: Node.js Application API (Port 3000)**:
   - Public application & administrative gateway.
   - Reuses existing session authentication (`req.session.userId`).
   - Administrative routes require verified `admin` role and `X-Requested-With: MindRush-Admin` custom header.
   - Exclusive manager and writer to MongoDB collections.
2. **Tier 2: Python AI Service API (Port 5050 - Internal Loopback)**:
   - Strictly listens on `127.0.0.1:5050`.
   - Requires internal authorization header: `X-Internal-Secret: <INTERNAL_API_KEY>`.
   - Stateless compute engine: does NOT access or write to MongoDB directly.

---

# Part 1: Node.js Application API (Port 3000)

All JSON responses follow the standard envelope: `{ "success": boolean, "error"?: string, ... }`.

---

### 1. Dashboard Overview
**`GET /api/admin/dashboard`**  
Returns operational statistics across documents, batches, review queues, and published banks.

- **Auth**: Required (`requireAuth` + `requireAdmin`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "stats": {
      "totalSourceDocuments": 4,
      "totalSourceQuestions": 100,
      "totalGeneratedQuestions": 45,
      "pendingReviewCount": 12,
      "approvedCount": 25,
      "rejectedCount": 8,
      "publishedCount": 25,
      "reportedCount": 1,
      "activeBatch": false
    }
  }
  ```

---

### 2. Document Upload & Ingestion
**`POST /api/admin/documents`**  
Uploads an educational source document. Express saves the file to `MindRush-AI/dataset/`, verifies hash, and calls Python for extraction.

- **Auth**: Required (`requireAuth` + `requireAdmin`, `X-Requested-With: MindRush-Admin`)
- **Form Data**:
  - `file`: Document file (`.pdf` in Feature 001; `.xlsx`, `.xls`, `.docx` in Phase 3b; max 25 MB)
  - `standard`: `1` | `2` | `3`
  - `subject`: `mathematics` | `science` | `computer` | `logical_reasoning`
  - `curriculum_id`: e.g. `cmo-math-olympiad`
  - `license_info`: e.g. "Approved Educational Reference"
- **Response (201 Created)**:
  ```json
  {
    "success": true,
    "document": {
      "_id": "674b2a3b4c5d6e7f8a9b0c01",
      "filename": "CMO-Sample-Paper-for-Class-1.pdf",
      "file_hash": "a1b2c3d4e5f6...",
      "processing_status": "extracted",
      "extractedQuestionsCount": 25
    }
  }
  ```
- **Error (409 Conflict)**: Duplicate document detected (matching SHA-256 hash).
- **Error (400 Bad Request)**: Invalid file extension or size exceeds 25 MB.

---

### 3. Trigger Question Generation Batch
**`POST /api/admin/generation`**  
Initiates asynchronous batch generation. Protected by single-worker concurrency lock and persisted idempotency.

- **Auth**: Required (`requireAuth` + `requireAdmin`, `X-Requested-With: MindRush-Admin`)
- **Rate Limit**: Max 5 batch requests per minute.
- **Request Body**:
  ```json
  {
    "idempotency_key": "c6a7b8c9-1234-5678-9abc-def012345678",
    "curriculum_id": "cmo-math-olympiad",
    "standard": 1,
    "subject": "mathematics",
    "topic": "addition",
    "difficulty": "medium",
    "question_type": "multiple_choice",
    "count": 10
  }
  ```
- **Idempotency Rules**:
  - `idempotency_key` is persisted in `generation_batches` alongside `request_hash` (SHA-256 of normalized parameters).
  - If the same key is submitted with **identical** parameters: Returns the existing batch record (`200 OK` or `202 Accepted`).
  - If the same key is submitted with **different** parameters: Rejects immediately with `409 Conflict` (`IDEMPOTENCY_PAYLOAD_MISMATCH`).
- **Concurrency**:
  - Enforces single active generation on the local 4 GB VRAM GPU.
  - If another batch is currently `generating` or `validating`: Rejects with `409 Conflict` (`GENERATION_IN_PROGRESS`).
- **Response (202 Accepted)**:
  ```json
  {
    "success": true,
    "batchId": "674b2a3b4c5d6e7f8a9b0c02",
    "status": "pending",
    "message": "Generation batch started in background."
  }
  ```

---

### 4. Get Generation Batch Status
**`GET /api/admin/generation/:batchId`**  
Polls progress and retrieves generated questions.

- **Auth**: Required (`requireAuth` + `requireAdmin`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "batch": {
      "batch_id": "674b2a3b4c5d6e7f8a9b0c02",
      "status": "completed",
      "totalGenerated": 10,
      "totalValidated": 9,
      "totalFailed": 1,
      "duration_ms": 28400
    },
    "questions": [
      {
        "question_id": "gen-std1-math-001",
        "question_text": "What is 4 + 6?",
        "options": [
          { "id": "A", "text": "9" },
          { "id": "B", "text": "10" },
          { "id": "C", "text": "11" },
          { "id": "D", "text": "12" }
        ],
        "correct_answer": { "value": 10, "type": "number" },
        "correct_option_id": "B",
        "status": "pending_review"
      }
    ]
  }
  ```

---

### 5. Review Question (Approve / Reject / Correction)
**`POST /api/admin/questions/:id/review`**  
Submits human review outcome.

- **Auth**: Required (`requireAuth` + `requireAdmin`, `X-Requested-With: MindRush-Admin`)
- **Request Body**:
  ```json
  {
    "decision": "approved", // or "rejected" | "correction_requested"
    "reason": "" // Mandatory if rejected
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "question": {
      "_id": "674b2a3b4c5d6e7f8a9b0c03",
      "status": "approved",
      "review_decision": "approved",
      "review_timestamp": "2026-11-20T10:15:00.000Z"
    }
  }
  ```

---

### 6. Controlled Question Publication (Feature 001 Local Scope)
**`POST /api/admin/questions/publish`**  
Publishes approved questions to the local companion file with sequence IDs starting at 1001.

- **Auth**: Required (`requireAuth` + `requireAdmin`, `X-Requested-With: MindRush-Admin`)
- **Concurrency**: Protected by publication mutex.
- **Request Body**:
  ```json
  {
    "questionIds": ["674b2a3b4c5d6e7f8a9b0c03", "674b2a3b4c5d6e7f8a9b0c04"]
  }
  ```
- **Lifecycle & Boundaries**:
  1. Verifies all question IDs exist and have `status === 'approved'`.
  2. Increments atomic sequence counter (`counters` collection) for each question to obtain sequential `published_id` (1001+).
  3. Formats questions via `adaptToCanonicalGameFormat`.
  4. Writes module to `educational-questions-published.js.tmp`.
  5. Atomically replaces target file using `fs.renameSync()`.
  6. Commits database updates: marks questions `published`, sets `published_id` and `published_at`.
  7. Writes audit log entry.
- **Explicit Limitations**:
  - Local companion file writing is suitable *strictly for local development and offline desktop play*.
  - Not suitable for read-only containers, serverless architectures, or CDNs.
  - Filesystem replacement and MongoDB updates are not an atomic cross-system transaction; partial failure leaves records in `approved` status for manual retry. Advanced outbox recovery is deferred to later V1 phases.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "publishedCount": 2,
    "publishedQuestions": [
      { "_id": "674b2a3b4c5d6e7f8a9b0c03", "published_id": 1001, "status": "published" },
      { "_id": "674b2a3b4c5d6e7f8a9b0c04", "published_id": 1002, "status": "published" }
    ],
    "totalProductionQuestions": 102
  }
  ```
- **Error (409 Conflict)**: Publication mutex is busy.
- **Error (500 Internal Server Error)**: Filesystem write failed; database records remain untouched in `approved` status.

---

### 7. Gameplay Question Delivery API
**`GET /api/questions/random`**  
Serves questions dynamically for gameplay sessions.

> [!NOTE]
> **Boundary Clarification**: In Feature 001, this endpoint is implemented and contract-tested as a **backend capability prepared for later game-client adoption**. Neither `EducationalEngine` nor `EducationalInvaderEngine` is migrated to consume this API during Feature 001; actual gameplay delivery in Feature 001 uses the local companion file (`educational-questions-published.js`). Migration of client engines to async API delivery is scheduled for Phase 9b.

- **Auth**: Public / Optional Session
- **Query Params**:
  - `standard`: `1` (required)
  - `subject`: `mathematics` (required)
  - `topic`: optional filter
  - `difficulty`: `easy` | `medium` | `hard` (optional)
  - `count`: default `10`
  - `exclude_ids`: comma-separated published IDs to prevent repetition within a session
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "questions": [
      {
        "id": 1001,
        "question": "What is 4 + 6?",
        "options": ["9", "10", "11", "12"],
        "correctAnswer": "10",
        "topic": "Addition"
      }
    ]
  }
  ```

---

### 8. Player Question Reporting API
**`POST /api/questions/:id/report`**  
Enables players to flag defective questions.

> [!NOTE]
> **Boundary Clarification**: In Feature 001, this endpoint is implemented and contract-tested as a **backend capability prepared for later game-client adoption**. No in-game reporting UI is implemented during Feature 001. The in-game reporting button/UI in the client engines is scheduled for Phase 9b.

- **Auth**: Public / Session-based
- **Request Body**:
  ```json
  {
    "report_type": "incorrect_answer", // "ambiguous" | "incorrect_options" | "typo" | "out_of_syllabus" | "other"
    "description": "The correct answer 10 was marked wrong."
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Report logged. Thank you for helping keep MindRush accurate."
  }
  ```

---

### 9. Disable / Withdraw Question from Gameplay
**`POST /api/admin/questions/:id/disable`**  
Marks a reported or defective question as disabled.

- **Auth**: Required (`requireAuth` + `requireAdmin`, `X-Requested-With: MindRush-Admin`)
- **Lifecycle & Delivery Behavior**:
  - **Immediate Database Status Change**: The question status is updated to `disabled` in MongoDB immediately.
  - **Impact on `/api/questions/random`**: Immediately excluded from the dynamic API question pool.
  - **Impact on Feature 001 Companion File**: The existing local companion file (`educational-questions-published.js`) will continue to contain that question until the **next successful publication**, which strictly filters out disabled questions. Disabling does NOT immediately rewrite the companion file or withdraw the question from companion-file gameplay without re-publication.
  - **Phase 9b Delivery**: Once client engines are migrated to async API delivery, disabling immediately removes the question from active gameplay sessions without republishing files.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "question": {
      "_id": "674b2a3b4c5d6e7f8a9b0c03",
      "status": "disabled",
      "disabled_at": "2026-11-20T10:30:00.000Z"
    },
    "note": "Question excluded from API. Republishing required to update local companion file."
  }
  ```

---

# Part 2: Python AI Service API (Port 5050 - Loopback Only)

All endpoints require the internal loopback authorization header: `X-Internal-Secret: <INTERNAL_API_KEY>`.

---

### 1. Service Health & Hardware Detection
**`GET /health`**

- **Response (200 OK)**:
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

### 2. Path-Contained Document Extraction
**`POST /internal/documents/extract`**  
Extracts text and reference questions from a verified document file within `DATASET_ROOT`.

- **Security Enforcement**:
  - Accepts `relative_path` relative to `DATASET_ROOT`.
  - Canonical path resolution: `target_path = os.path.realpath(os.path.join(canonical_root, request.relative_path))`.
  - Directory boundary check: `target_path == canonical_root or target_path.startswith(canonical_root + os.sep)`.
  - Traversal tokens (`..`), symlinks, hidden files, and null bytes are rejected with `400 Bad Request`.
  - Format restricted to `.pdf` in Feature 001; size limited to 25 MB max.
- **Request Body**:
  ```json
  {
    "relative_path": "standard 1/mathematics/CMO-Sample-Paper-for-Class-1.pdf",
    "file_format": "pdf"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "extracted_text": "... raw text ...",
    "sample_questions": [
      {
        "question_text": "Which number comes after 15?",
        "options": ["14", "16", "17", "18"],
        "correct_answer": "16",
        "has_answer_key": true
      }
    ]
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `{"error": "PATH_TRAVERSAL_DETECTED", "message": "Security violation: Path traversal detected"}`
  - `400 Bad Request`: `{"error": "UNSUPPORTED_FORMAT", "message": "Only PDF files are supported in Feature 001"}`
  - `404 Not Found`: `{"error": "DOCUMENT_NOT_FOUND", "message": "Source document does not exist"}`

---

### 3. Structured Question Generation Execution
**`POST /internal/generation/generate`**

- **Request Body**:
  ```json
  {
    "batch_id": "batch-uuid-1234",
    "curriculum_id": "cmo-math-olympiad",
    "standard": 1,
    "subject": "mathematics",
    "topic": "addition",
    "difficulty": "medium",
    "question_type": "multiple_choice",
    "count": 10,
    "reference_texts": ["Sample CMO Question: What is 3 + 4? Answer: 7"]
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "generated_questions": [
      {
        "question_text": "What is 8 + 5?",
        "options": [
          { "id": "A", "text": "11" },
          { "id": "B", "text": "12" },
          { "id": "C", "text": "13" },
          { "id": "D", "text": "14" }
        ],
        "correct_answer": { "value": 13, "type": "number" },
        "correct_option_id": "C",
        "explanation": "8 plus 5 equals 13."
      }
    ],
    "raw_duration_ms": 19400
  }
  ```

---

### 4. Deterministic Independent Validation
**`POST /internal/questions/validate`**

- **Request Body**:
  ```json
  {
    "question_text": "What is 8 + 5?",
    "options": ["11", "12", "13", "14"],
    "correct_answer": "13",
    "subject": "mathematics",
    "standard": 1,
    "existing_questions": ["Which number comes after 58?", ...]
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "schema_valid": true,
    "answer_valid": true,
    "recalculated_value": 13,
    "duplicate_check": "passed",
    "similarity_score": 0.11,
    "overall_status": "pending_review",
    "errors": []
  }
  ```
