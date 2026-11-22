# Implementation Plan: AI-Assisted Question Generation and Question Bank Expansion

**Branch**: `001-ai-question-generation` | **Date**: 2026-11-20 (Final Targeted Correction Pass) | **Spec**: [spec.md](specs/001-ai-question-generation/spec.md)  
**Governing Documents**:
- Constitution v1.1.0 (`.specify/memory/constitution.md`)
- Master Implementation Prompt (`MindRush_AI_V1_Master_Prompt_for_Planning.txt`)
- Master Phase Map (`specs/001-ai-question-generation/v1-phase-map.md`)
- Technical Research (`specs/001-ai-question-generation/research.md`)
- Data Model (`specs/001-ai-question-generation/data-model.md`)
- API Contracts (`specs/001-ai-question-generation/contracts/admin-api.md`)
- Evidence Audit Report (`PLANNING_EVIDENCE_AUDIT.md`)

---

## 1. Executive Summary & Architecture Strategy

This plan establishes the implementation specifications for **Feature 001** of MindRush AI Version 1.

### Authoritative Architecture Decisions
1. **Question Delivery Phasing & Engine Compatibility**:
   - *Feature 001 (Local Development)*: Server-side runtime companion file generation (`educational-questions-published.js`) for immediate, safe expansion of the existing synchronous arcade engines. Feature 001 preserves the existing question-delivery architecture and applies one targeted, backward-compatible constructor normalizer fix to `EducationalEngine` to repair its existing question-field compatibility defect.
   - *Backend API Preparedness in Feature 001*: Backend endpoints `GET /api/questions/random` and `POST /api/questions/:id/report` may be implemented and contract-tested as backend capabilities prepared for later game-client adoption. Neither game engine is migrated to consume the API, and no in-game reporting UI is implemented in Feature 001. Companion-file delivery remains the actual gameplay delivery mechanism.
   - *Question-Disable Behavior*: Disabling a question immediately changes its database status in MongoDB and excludes it from `/api/questions/random`. However, the existing companion file may still contain that question until the next successful publication (which strictly excludes disabled questions).
   - *Production V1 Target (Phase 9b)*: Server-side API delivery (`GET /api/questions/random`) becomes the actual gameplay source when both engines are migrated to async loading, in-game reporting UI is added, and disabled questions are immediately excluded from gameplay without republishing files.
   - *Explicit Limitation*: Runtime file writing is suitable *strictly for local development and offline desktop play*; it is not suitable for read-only containers, serverless environments, or CDNs. Filesystem replacement and MongoDB updates do not form an atomic cross-system transaction. Advanced outbox recovery is deferred to later V1 phases.
2. **Database Ownership**:
   - Node.js / Express / Mongoose is the **sole authoritative writer** to MongoDB across 11 physical collections.
   - Python FastAPI is a stateless calculation engine (extracting text, calling Ollama, checking arithmetic) communicating over authenticated internal loopback HTTP (`127.0.0.1:5050`). Python does NOT connect to or write to MongoDB.
3. **ChromaDB & RAG Governance**:
   - Defer ChromaDB and embedding models from Feature 001 to Phase 4.
   - Feature 001 uses direct text caching from the 4 Standard 1 Mathematics CMO papers.
   - Phase 4 remains a mandatory Version 1 phase; explicit user approval or a Constitution patch will be recorded before Phase 4.
4. **Targeted Engine Fix & Answer Validation**:
   - Constructor normalizer in `EducationalEngine` strictly validates that `correctAnswer` matches exactly one option in `q.options`, validates any existing `correctIndex` consistency (strictly requiring `Number.isInteger(q.correctIndex)`), and populates `questionText`. It never silently defaults to index 0 on mismatch.
5. **Security & Provisioning**:
   - Strict canonical path containment (`os.path.realpath` against `DATASET_ROOT`) blocks path traversal attacks.
   - Admin accounts provisioned strictly via interactive CLI (`node server/scripts/create-admin.js`). Public signup strictly defaults to `role: 'player'`.

---

## 2. Technical Context & Constraints

- **Platform & Environment**: Windows 11 (64-bit), Node.js (ES modules), Python 3.11+.
- **Hardware Profile (Strict Constraint)**: NVIDIA GeForce RTX 3050 Ti with 4 GB VRAM, 16 GB System RAM.
  - LLM capped at quantized 4B parameter models (primary candidate: **Qwen3.5 4B quantized**).
  - Single active generation job at a time (mutex lock enforces concurrency = 1).
  - Context window capped at 2,048 tokens.
- **Storage Infrastructure**:
  - *Authoritative MongoDB*: 11 physical collections managed exclusively by Node.js.
  - *Atomic Sequence Counters*: `counters` collection with `$inc` guarantees non-colliding `published_id` allocation starting at 1001.
  - *ChromaDB*: Deferred to Phase 4 (pinned to CPU).
- **Python Project Structure**: `MindRush-AI/ai_service/app.py` (using valid Python identifier without hyphens).
- **Game Engine Integration**:
  - Preserves all 100 original questions (`id: 1–100`).
  - Published questions assigned IDs starting at 1001.
  - `EducationalInvaderEngine` consumes questions without changes.
  - `EducationalEngine` receives targeted constructor normalizer.

---

## 3. Constitution & Governance Gate Check

| Principle | Compliance Status | Evidence & Resolution |
|---|---|---|
| **§1 Preserve Existing Project** (NON-NEGOTIABLE) | ✅ PASS | Preserves all 100 original questions (`educational-questions.js:6-1207`). Retains existing Node.js, Express, and MongoDB backend. Folder names (`standard 1`, `ganerated_questions`) preserved. |
| **§2 Gesture-Based Interaction** | ✅ PASS (N/A) | Operates in educational content generation; does not interfere with future MediaPipe hand tracking. |
| **§3 Gameplay & Educational Quality** | ✅ PASS | Multi-tier automated validation (schema, deterministic math recalculation in Python, duplicate detection) and mandatory human review prevent invalid questions from entering gameplay. |
| **§4 Modular Architecture** | ✅ PASS | Strict separation: Node.js owns database and game delivery; Python owns AI/extraction; interfaces governed by REST contracts. |
| **§5 Performance and UX** | ✅ PASS | Generation executes completely out-of-band from active gameplay. Zero real-time LLM inference during student sessions. |
| **§6 Data Integrity** (NON-NEGOTIABLE) | ✅ PASS | Atomic counter prevents ID collision. Correct answer stored as text and `{ value, type }`. Staged publication lifecycle. |
| **§7 Privacy and Security** | ✅ PASS | Local inference via Ollama. Zero PII transmitted. Path traversal blocked. Admin CLI provisioning prevents public role escalation. |
| **§8 Testability & Documentation** | ✅ PASS | Unit, integration, regression, and security acceptance tests specified. 8 continuous living reporting documents maintained. |
| **Add. §1.2 Technology Selection** | ⚠️ CONFLICT NOTED | Constitution classifies ChromaDB as "Optional; subject to requirements." Master Prompt Phase 4 requires ChromaDB. Deferred from Feature 001 to Phase 4; governance amendment will precede Phase 4. |
| **Add. §3 Validation & Approval** | ✅ PASS | Mandatory human review gate before publication. Zero automated approvals. |

---

## 4. Project Directory Structure

```text
d:\MindRush\
├── server/                                   # Existing Node.js / Express Application
│   ├── app.js                                # Express app configuration (mounts /api/admin)
│   ├── server.js                             # Entry point (port 3000)
│   ├── db.js                                 # MongoDB connection
│   ├── models/
│   │   ├── User.js                           # Existing user model (add role field)
│   │   ├── Score.js                          # Existing score model (unchanged)
│   │   ├── Curriculum.js                     # Physical collection: curricula
│   │   ├── SourceDocument.js                 # Physical collection: source_documents
│   │   ├── SourceQuestion.js                 # Physical collection: source_questions
│   │   ├── GenerationBatch.js                # Physical collection: generation_batches
│   │   ├── GeneratedQuestion.js              # Physical collection: generated_questions
│   │   ├── ValidationResult.js               # Physical collection: validation_results
│   │   ├── QuestionReport.js                 # Physical collection: question_reports
│   │   ├── AuditLog.js                       # Physical collection: audit_logs
│   │   └── Counter.js                        # Physical collection: counters (atomic $inc)
│   ├── routes/
│   │   ├── auth.js                           # Existing auth routes
│   │   ├── progress.js                       # Existing progress routes
│   │   ├── admin.js                          # Admin API routes (requireAuth + requireAdmin)
│   │   └── questions.js                      # Game delivery API (/api/questions/random, /report)
│   ├── services/
│   │   ├── ai-client.js                      # HTTP client for Python FastAPI service
│   │   ├── question-publisher.js             # Staged file publication & atomic counters
│   │   └── question-adapter.js               # Game format converter (MCQ adapter)
│   ├── scripts/
│   │   └── create-admin.js                   # Secure interactive CLI admin provisioning
│   └── middleware/
│       └── requireAdmin.js                   # Admin authorization & CSRF header middleware
│
├── public/                                   # Existing Client-Side Web Application
│   ├── js/game/
│   │   ├── educational-questions.js          # Canonical bank (imports published companion)
│   │   ├── educational-questions-published.js# Local runtime companion file
│   │   ├── educational-engine.js             # Falling-object engine (constructor normalizer)
│   │   └── educational-invader-engine.js     # Space-invader engine (unchanged)
│   └── admin/                                # Admin Interface
│       ├── index.html                        # Dashboard overview
│       ├── documents.html                    # Document upload & provenance viewer
│       ├── generate.html                     # Generation request form
│       ├── review.html                       # Human review & approval queue
│       ├── publish.html                      # Publication manager
│       ├── bank.html                         # Approved question bank search
│       └── js/admin-app.js                   # Admin frontend logic
│
├── MindRush-AI/                              # Python AI Subsystem Workspace
│   ├── ai_service/                           # FastAPI Microservice (Valid identifier without hyphens)
│   │   ├── app.py                            # FastAPI application entry point
│   │   ├── config.py                         # Environment & dataset root constraints
│   │   ├── extractor/
│   │   │   └── pdf_extractor.py              # PyMuPDF parser with path containment
│   │   ├── generator/
│   │   │   ├── ollama_client.py              # Ollama client with retry & hardware limits
│   │   │   └── prompt_builder.py             # Structured prompt templates
│   │   └── validator/
│   │       ├── math_validator.py             # Deterministic arithmetic recalculation
│   │       ├── duplicate_detector.py         # 4-tier duplicate check (exact/near/TF-IDF)
│   │       └── schema_validator.py           # Pydantic schema validation
│   ├── dataset/                              # Existing source material (preserved)
│   │   └── standard 1/mathematics/           # 4 CMO question paper PDFs
│   ├── ganerated_questions/                  # Existing output directory (preserved)
│   ├── tests/                                # Python unit & security tests
│   │   ├── test_pdf_extractor.py
│   │   ├── test_math_validator.py
│   │   ├── test_path_security.py             # Negative security tests (traversal)
│   │   └── test_ollama_client.py
│   └── requirements.txt                      # Python dependencies
│
├── docs/                                     # Mandatory Reporting Suite
│   ├── DEVELOPMENT_LOG.md                    # Supplemental Req A.1: Task audit log
│   ├── CHANGELOG.md                          # Supplemental Req A.2: Version changelog
│   ├── FILE_CHANGE_REGISTER.md               # Supplemental Req A.3: File audit register
│   ├── TEST_REPORT.md                        # Supplemental Req A.4: Test execution records
│   ├── INSTALLATION_AND_ENVIRONMENT_LOG.md   # Supplemental Req A.5: Environment specs
│   ├── ERROR_AND_FIX_LOG.md                  # Supplemental Req A.6: Error & fix register
│   ├── PROJECT_STATUS.md                     # Supplemental Req A.8: Real-time status
│   ├── FINAL_QA_REPORT.md                    # Phase 11: QA benchmarks
│   ├── FINAL_PROJECT_REPORT.md               # Supplemental Req D: Final handover
│   └── PHASE_COMPLETION_REPORTS/             # Supplemental Req A.7: Phase audit reports
│       ├── PHASE_00_REPOSITORY_AUDIT.md
│       └── ...
│
└── tests/                                    # Node.js Integration & Regression Tests (.mjs)
    ├── test_question_adapter.mjs
    ├── test_admin_api.mjs
    ├── test_publication_atomicity.mjs
    ├── test_educational_engine_adapter.mjs
    └── test_dual_engine_compatibility.mjs
```

---

## 5. Implementation Phasing & Work Breakdown

### Phase 0: Workspace and Repository Audit (Feature 001)
- Verify `MindRush-AI/dataset/standard 1/mathematics/` contains exactly 4 PDFs.
- Verify hardware: RTX 3050 Ti (4GB VRAM), RAM, Python, Node.js, Git, MongoDB.
- Document pre-existing engine and score limitations in audit reports.
- Deliverables: `docs/ENVIRONMENT_AUDIT.md`, `docs/MINDRUSH_REPOSITORY_AUDIT.md`, `PHASE_00 report`.

### Phase 1: Installation & Environment Configuration (Feature 001)
- Set up Python virtual environment (`.venv`) with Python 3.11+.
- Verify local Ollama daemon and pull verified model tag (`qwen3.5:4b` or verified equivalent).
- Verify MongoDB connectivity (local instance / Atlas / in-memory fallback).
- Install core dependencies: `fastapi`, `uvicorn`, `pydantic`, `pymupdf`, `httpx`.
- Implement admin provisioning script: `server/scripts/create-admin.js`.
- Deliverables: `.env.example`, `MindRush-AI/requirements.txt`, `INSTALLATION_LOG`, `PHASE_01 report`.

### Phase 2: Architecture & Database Design (Feature 001)
- Define Mongoose schemas for the 11 physical collections in `server/models/`.
- Seed initial curriculum record for Standard 1 Mathematics (CMO) accommodating future V1 fields (country, syllabus version, allowed concepts, difficulty rules).
- Seed atomic counter sequence (`published_question_id = 1000`).
- Implement status lifecycle state machine with validation transitions.
- Deliverables: Model files, database initialization script, `PHASE_02 report`.

### Phase 3: Document Ingestion (Feature 001 PDF Scope)
- Build PyMuPDF text extractor in `MindRush-AI/ai_service/extractor/pdf_extractor.py`.
- Enforce canonical path containment asserting `target_path == canonical_root or target_path.startswith(canonical_root + os.sep)`.
- Parse the 4 CMO papers in `standard 1/mathematics/`.
- Compute SHA-256 hashes, record provenance, extract sample reference questions without inventing missing answers.
- Deliverables: Extractor module, unit & negative security tests, `PHASE_03 report`.

### Phase 4: Embeddings and RAG (Later V1 - Mandatory)
- Record Constitution amendment / explicit user approval for ChromaDB adoption.
- Configure persistent ChromaDB local storage and `sentence-transformers/all-MiniLM-L6-v2` pinned to CPU.
- Implement semantic retrieval, metadata filtering, and cross-standard contamination testing.
- Deliverables: Vector pipeline, retrieval evaluation report, `PHASE_04 report`.

### Phase 5: Local LLM Integration (Feature 001)
- Build robust Ollama client in Python with health checks, timeout handling (120s), and structured JSON enforcement.
- Single active generation job enforced via mutex.
- Test prompt generation with quantized Qwen3.5 4B under 4 GB VRAM constraints (concurrency = 1).
- Deliverables: Ollama service module, prompt templates, integration tests, `PHASE_05 report`.

### Phase 6: Question Generation Engine (Feature 001)
- Implement generation workflow in FastAPI: request parameters → reference retrieval → prompt construction → Ollama inference → structured JSON parsing.
- Persist `idempotency_key` and `request_hash` in `generation_batches`.
- Implement startup orphan reconciliation marking stale batches `failed`.
- Store batch records in `generation_batches` and raw questions in `generated_questions`.
- Deliverables: Generation API endpoints, batch tracking, `PHASE_06 report`.

### Phase 7: Automated Question Validation (Feature 001)
- Build independent Python validation engine:
  - Schema integrity.
  - Deterministic arithmetic recalculation (using safe Python math parsing).
  - 4-tier duplicate detection (exact, normalized, near-string, TF-IDF).
  - Option integrity (4 distinct options, correct answer matches exactly one option).
- Store validation audit records in `validation_results`.
- Deliverables: Validator modules, arithmetic checking tests, duplicate detection tests, `PHASE_07 report`.

### Phase 8: Admin Dashboard & Review Workflow (Feature 001)
- Implement admin API in Express: `/api/admin/questions`, review endpoints (approve/reject/patch).
- Implement `requireAdmin` middleware and CSRF header verification (`X-Requested-With: MindRush-Admin`).
- Build clean HTML/JS admin interface in `public/admin/`.
- Deliverables: Admin routes, review UI pages, authorization middleware, `PHASE_08 report`.

### Phase 9: Game Integration & Publication (Feature 001 & Phase 9b Target)
- *Feature 001 (Actual Gameplay Delivery via Local Companion File)*:
  - Implement `question-publisher.js` with staged temporary file writing (`.tmp` -> `rename`) and atomic MongoDB `$inc` sequence allocation.
  - Generate `public/js/game/educational-questions-published.js` with non-colliding IDs (1001+).
  - Update `educational-questions.js` with one-time additive import of published questions.
  - Apply one targeted, backward-compatible constructor normalizer fix to `EducationalEngine` with strict answer validation (validating `Number.isInteger(q.correctIndex)` and no defaulting to 0).
  - Implement `GET /api/questions/random` and `POST /api/questions/:id/report` in Node.js backend as backend capabilities prepared for later game-client adoption; neither game engine is migrated to the API, and no in-game reporting UI is implemented.
  - Disabling a question (`POST /api/admin/questions/:id/disable`) immediately updates MongoDB status and excludes it from `/api/questions/random`. The existing companion file may still contain that question until the next successful publication, which strictly excludes disabled questions.
- *Phase 9b (Later V1 Production Target)*:
  - Migrate both game engines (`EducationalEngine` and `EducationalInvaderEngine`) to asynchronous API-based question delivery (`GET /api/questions/random`).
  - Make `GET /api/questions/random` the actual gameplay delivery source.
  - Implement the in-game player reporting UI.
  - Ensure disabled or withdrawn questions are immediately excluded from API-based gameplay without republishing files.
- Deliverables: Publication service, game delivery route, dual-engine compatibility verification, `PHASE_09 report`.

### Phase 10: CI/CD & Automation (Later V1)
- Create GitHub Actions workflow for linting, unit tests, and API contract checks.
- Deliverables: `.github/workflows/ci.yml`, `PHASE_10 report`.

### Phase 11: Testing & Quality Assurance (Feature 001 & Later V1)
- *Feature 001 Planned Acceptance Tests*:
  1. Regression suite for all 100 original questions.
  2. All 4 option positions (0, 1, 2, 3) mapped to `correctIndex`.
  3. Missing `correctAnswer` rejection.
  4. Non-matching `correctAnswer` rejection.
  5. Out-of-range existing `correctIndex` rejection.
  6. Conflicting existing `correctIndex` rejection.
  7. Duplicate matching options rejection.
  8. Option shuffling in `QuestionDeck` preserves answer-to-option mapping.
- *Phase 11b*: 90-question benchmark dataset across Standards 1–3.
- Deliverables: Test suite execution, `docs/TEST_REPORT.md`, `PHASE_11 report`.

### Phase 12: Documentation & Final Handover (Continuous & V1 Capstone)
- Maintain 8 continuous reporting documents throughout development.
- Finalize the complete 18-document `docs/` technical handover at Version 1 completion.
- Deliverables: `docs/FINAL_PROJECT_REPORT.md`, `PHASE_12 report`.
