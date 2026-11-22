# MindRush AI Version 1 — Master Phase Map and Scope Reconciliation

**Feature Branch**: `001-ai-question-generation`  
**Date**: 2026-11-20 (Final Targeted Correction Pass)  
**Governing Documents**:
- Constitution v1.1.0 (`.specify/memory/constitution.md`)
- Feature 001 Specification (`specs/001-ai-question-generation/spec.md`)
- Master Implementation Prompt (`MindRush_AI_V1_Master_Prompt_for_Planning.txt`)
- Evidence Audit Report (`PLANNING_EVIDENCE_AUDIT.md`)

---

## 1. Purpose and Architecture Context

This document establishes the authoritative bridge between the **Feature 001 Specification** and the complete **MindRush AI Version 1 Master Vision** (13 phases: Phase 0–12 plus Supplemental Requirements A–E).

Following the Read-Only Repository Evidence Audit and final targeted corrections, this phase map incorporates all resolved architectural decisions, security boundaries, and database ownership rules to ensure seamless task generation (`/speckit-tasks`) without technical ambiguity or scope creep.

---

## 2. Complete Phase Mapping (Phases 0–12)

| Phase | Master Prompt Title | Summary of Objectives & Scope | Scope Classification | Feature 001 Scope vs. Later V1 Scope |
|---|---|---|---|---|
| **Phase 0** | Workspace and Repository Audit | Audit MindRush-AI workspace, dataset paths (`standard 1` space, `ganerated_questions` typo), Windows 11, RTX 3050 Ti 4GB VRAM, Node.js, Python, MongoDB, Git. Document pre-existing engine defects. | **Feature 001 & V1 Foundation** | Full audit executed; pre-existing engine bugs (`EducationalEngine` missing properties, `Score.mode` enum) documented. |
| **Phase 1** | Installation and Environment Configuration | Python venv (3.11+), Node.js, MongoDB Community/local, Ollama with verified Qwen3.5 4B model, PyMuPDF, FastAPI. Secure CLI admin script (`create-admin.js`). `.env.example`. | **Feature 001 & V1 Foundation** | **Feature 001**: Python environment, FastAPI, PyMuPDF, Ollama, MongoDB, CLI admin script. *ChromaDB deferred to Phase 4*. |
| **Phase 2** | Architecture and Database Design | 11 physical MongoDB collections (curricula, source_documents, source_questions, generation_batches, generated_questions, validation_results, question_reports, users, audit_logs, counters). Node.js sole writer. | **Shared / Partitioned** | **Feature 001**: 11 physical collections in Mongoose, atomic counter (`$inc`), status state machine. **Later V1**: Dynamic curriculum editor UI. |
| **Phase 3** | Document Ingestion and Extraction | PDF, XLSX, XLS, DOCX support; OCR fallback. 12-step processing workflow, document hashing, metadata capture, strict canonical path containment to prevent path traversal. | **Partitioned** | **Feature 001**: PDF extraction for the 4 CMO papers in `standard 1/mathematics/` with path traversal defense. **Later V1**: XLSX, DOCX, and OCR. |
| **Phase 4** | Embeddings and RAG | Persistent ChromaDB, `sentence-transformers/all-MiniLM-L6-v2` pinned to CPU, vector indexing, semantic retrieval, cross-standard contamination testing. | **Later V1 Scope (Mandatory)** | **Deferred from Feature 001**. Constitution §1.2 governance conflict noted: explicit user approval / Constitution amendment required before Phase 4 execution. |
| **Phase 5** | Local LLM Integration | Ollama client module, Qwen3.5 4B quantized, single-stream concurrency lock (concurrency = 1), 2048 context limit, timeout (120s), fallback handling. | **Feature 001 Core** | Fully in Feature 001. Establishes the reusable Ollama wrapper in FastAPI. |
| **Phase 6** | Question Generation Engine | Generation workflow for Standard 1 Mathematics (Addition/Subtraction), few-shot prompt construction, persisted idempotency key and request hash, startup orphan reconciler. | **Feature 001 Core** | Fully in Feature 001 for Standard 1 Mathematics MCQs; extensible to other standards and question types. |
| **Phase 7** | Automated Question Validation | Schema check, deterministic mathematical recalculation in Python, 4 duplicate checks (exact, normalized, near, TF-IDF), option integrity. Zero auto-approval. | **Feature 001 Core** | Fully in Feature 001. Python deterministic arithmetic recalculation and duplicate detection are mandatory quality gates. |
| **Phase 8** | Admin Dashboard | Overview, Source Documents, Generate, Review Queue (approve/reject/patch), Published Bank. Session auth, `requireAdmin`, custom CSRF header check. | **Partitioned** | **Feature 001**: Review and publication workflow. **Later V1**: Full curriculum hierarchy editor and analytics. |
| **Phase 9** | Game Delivery Integration & Publication | Node.js Express backend connects to FastAPI loopback. Publication via atomic sequence counter (1001+) and staged `.tmp` -> `rename` companion file. Game retrieval API (`/api/questions/random`) and player reporting. | **Partitioned (Hybrid Phasing)** | **Feature 001**: Local runtime companion file publication (actual gameplay delivery source) and targeted backward-compatible `EducationalEngine` constructor normalizer. Backend `GET /api/questions/random` and `POST /api/questions/:id/report` implemented as backend capabilities prepared for later game-client adoption (no engine migration or in-game reporting UI in Feature 001). **Later V1 (Phase 9b)**: Migrate game engines to async API delivery, make `GET /api/questions/random` the actual gameplay source, implement in-game reporting UI, and achieve immediate exclusion of disabled questions from gameplay without republishing files. |
| **Phase 10** | CI/CD and Automation | GitHub Actions workflows for Python linting/tests, API tests, Node.js tests. Separation of software CI/CD from question data approval. | **Later V1 Scope** | Standard test scripts run locally in Feature 001; GitHub Actions CI/CD pipeline set up in Phase 10. |
| **Phase 11** | Testing and Quality Assurance | Unit, integration, and security tests. Dual-engine regression suite (8 explicit acceptance cases). 90-question benchmark dataset across Standards 1–3. | **Partitioned** | **Feature 001**: Regression test suite for all 100 original questions, published questions, and normalizer. **Later V1 (Phase 11b)**: 90-question benchmark. |
| **Phase 12** | Documentation and Final Handover | Complete 18-file `docs/` suite, updated root README with Windows 11 PowerShell instructions, `docs/FINAL_QA_REPORT.md`, `docs/FINAL_PROJECT_REPORT.md`. | **Continuous & V1 Capstone** | Base architecture and continuous logs maintained in Feature 001; complete 18-doc handover finalized at V1 completion. |
| **Supp. A–E** | Mandatory Reporting System | `docs/DEVELOPMENT_LOG.md`, `docs/CHANGELOG.md`, `docs/FILE_CHANGE_REGISTER.md`, `docs/TEST_REPORT.md`, `docs/INSTALLATION_AND_ENVIRONMENT_LOG.md`, `docs/ERROR_AND_FIX_LOG.md`, `docs/PHASE_COMPLETION_REPORTS/`, `docs/PROJECT_STATUS.md`. | **Cross-Cutting (All Phases)** | Active across all implementation phases. Continuous tracking of every command, test, file change, and error. |

---

## 3. Authoritative Strategic Decisions & Governance Boundaries

### A. Question Delivery Phasing & Limitations
- **Feature 001 (Local Development)**: 
  - Preserves existing synchronous module loading. Feature 001 preserves the existing question-delivery architecture and applies one targeted, backward-compatible constructor normalizer fix to `EducationalEngine` to repair its existing question-field compatibility defect.
  - Companion-file delivery (`public/js/game/educational-questions-published.js`) is the actual gameplay delivery mechanism.
  - Express endpoint `POST /api/admin/questions/publish` generates the companion file at runtime using a staged `.tmp` -> `rename` pattern and an atomic MongoDB sequence counter starting at `1001`.
  - Backend endpoints `GET /api/questions/random` and `POST /api/questions/:id/report` are implemented and contract-tested as backend capabilities prepared for later game-client adoption; neither game engine is migrated to the API, and no in-game reporting UI is implemented in Feature 001.
  - **Question-Disable Behavior in Feature 001**: Disabling a question (`POST /api/admin/questions/:id/disable`) immediately changes its database status in MongoDB and excludes it from `/api/questions/random`. However, the existing companion file may still contain that question until the next successful publication, which strictly excludes disabled questions. Disabling does not immediately withdraw questions from companion-file gameplay without re-publication.
  - **Explicit Limitations**: Runtime file writing is suitable *strictly for local development and offline desktop play*; it is not suitable for read-only containers, serverless environments, or CDN hosting. Filesystem replacement and MongoDB updates are not an atomic cross-system transaction; advanced outbox recovery is deferred to later V1 phases.
- **Version 1 Target (Phase 9b Migration)**:
  - Server-side API question delivery (`GET /api/questions/random`) is the authoritative production architecture.
  - In Phase 9b, both `EducationalEngine` and `EducationalInvaderEngine` will be migrated to asynchronous API loading, making `GET /api/questions/random` the actual gameplay delivery source while preserving 100% backward compatibility with the original 100 questions.
  - In-game player reporting (`POST /api/questions/:id/report`) and UI will be implemented.
  - In Phase 9b, disabling a question immediately removes it from active API-based gameplay without republishing files.

### B. ChromaDB & RAG Phasing
- **Feature 001**: Defer ChromaDB and embedding models. Standard 1 Mathematics has only 4 CMO papers; direct text extraction and structured prompt caching satisfy all generation and validation criteria without risking the 4 GB VRAM GPU limit.
- **Phase 4**: ChromaDB persistent local storage, `all-MiniLM-L6-v2` (pinned to CPU), and the full RAG pipeline remain **mandatory Version 1 requirements**.
- **Governance Conflict**: Constitution §1.2 defines ChromaDB as "Optional; subject to requirements." Master Prompt Phase 4 mandates ChromaDB. Prior to executing Phase 4, an explicit user approval / Constitution amendment will be recorded to reconcile this difference.

### C. MongoDB Ownership & Microservice Separation
- **Node.js Backend**: Exclusive authoritative writer to MongoDB. Manages all 11 physical collections, user sessions, admin authorization, atomic counters, and publication.
- **Python AI Microservice**: Stateless computation engine listening on `127.0.0.1:5050` with loopback secret authorization. Performs PDF extraction, Ollama generation, and deterministic math validation. **Python has NO direct database write connection to MongoDB**.

### D. Administrator Authorization
- Reuses existing `User` model with `role: { type: String, enum: ['player', 'admin'], default: 'player' }`.
- Public registration (`/api/auth/signup`) strictly defaults to `role: 'player'`. Untrusted client input cannot assign roles.
- Administrative accounts are provisioned exclusively via interactive CLI: `node server/scripts/create-admin.js`.
- State-changing administrative endpoints require custom header `X-Requested-With: MindRush-Admin`.
- All administrative actions are recorded in `audit_logs`.

### E. EducationalEngine Adapter Alignment
- `EducationalEngine` constructor normalizer strictly validates that `correctAnswer` exists and matches exactly one option in `q.options`, validates any existing `correctIndex` (strictly requiring `Number.isInteger(q.correctIndex)`), and sets `questionText`. It never silently defaults to index 0.
- Guarantees that the array displayed on screen and the array used to calculate correctness are identical, repairing the pre-existing bug for both original and published questions without breaking `EducationalInvaderEngine`.
- Explicit acceptance test suite covers all 100 original questions, all 4 option positions, missing answers, conflicting indices, and duplicate options.

### F. Document Extraction Security
- `POST /internal/documents/extract` enforces canonical path containment using `os.path.realpath` against `DATASET_ROOT`.
- Path traversal escapes (`..`), symlinks, hidden files, and unsupported extensions are rejected with `400 Bad Request`.
