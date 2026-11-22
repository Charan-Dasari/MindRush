# Changelog — MindRush

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added - 2026-11-20 (Feature 001: Phase 1 Setup & Phase 2 Foundation Milestone)
- **T001 Python Environment Setup:**
  - Initialized isolated Python 3.13 virtual environment (`MindRush-AI/.venv`).
  - Defined dependencies in `MindRush-AI/requirements.txt` (`fastapi`, `uvicorn`, `pydantic`, `pymupdf`, `httpx`, `pytest`, `python-dotenv`, `psutil`).
- **T002 Local Ollama & Candidate Model Evaluation (`qwen3.5:4b`):**
  - Verified local Ollama daemon 0.40.16 on port 11434.
  - Pulled and benchmarked `qwen3.5:4b` (3.3 GB GGUF, Q4_K_M, 4.2B params, Apache 2.0).
  - Benchmark confirmed 3,208 MiB peak VRAM utilization (78.3% of 4,096 MiB RTX 3050 Ti VRAM).
  - Generation speed measured at 7.0–7.6 tokens/sec (~31s latency per question with `"think": False`).
- **T003 Environment Configuration:**
  - Updated `.env.example` with AI service configuration, internal secrets, and Ollama endpoints.
  - Created `MindRush-AI/ai_service/config.py` with typed configuration values.
- **T004 Fallback Companion File & Doc Registers:**
  - Created initial published companion file `public/js/game/educational-questions-published.js` exporting `PUBLISHED_QUESTIONS = []`.
- **T005 User Role Authorization:**
  - Added `role: { type: String, required: true, enum: ['player', 'admin'], default: 'player' }` to `server/models/User.js` in both MongoDB schema and `MemoryUserStore`.
- **T006 Curriculum Hierarchy Model:**
  - Created `server/models/Curriculum.js` with hierarchical syllabus tree and in-memory store.
- **T007 Atomic Sequence Generator:**
  - Created `server/models/Counter.js` with `getNextSequence(name)` using atomic `$inc` starting from 1000.
- **T008 Audit Log Model:**
  - Created `server/models/AuditLog.js` with enum action constraints and in-memory fallback.
- **T009 Admin Provisioning CLI:**
  - Created `server/scripts/create-admin.js` for secure CLI-only administrative account provisioning.
- **T010 Admin Authorization & Security Middleware:**
  - Created `server/middleware/requireAdmin.js` with session authentication, admin role verification, Origin/CORS validation, and CSRF header `X-Requested-With: MindRush-Admin`.
- **T011 FastAPI Microservice Shell:**
  - Created `MindRush-AI/ai_service/app.py` with `X-Internal-Secret` middleware and hardware inspection `/health` probe.
- **T012 Curriculum Seed Script:**
  - Created and executed `server/scripts/seed-curriculum.js`, seeding CMO Standard 1 syllabus and `published_question_id = 1000`.

### Changed - 2026-11-20
- Fixed `argon2` Windows prebuild incompatibility by updating `package.json` to `"argon2": "^0.41.1"`, resolving `STATUS_ACCESS_VIOLATION` (`0xC0000005`).

### Added - 2026-11-16 (Phase 0: Spec Kit Integration)
- **Specification-Driven Development (SDD) Infrastructure:**
  - Installed Astral `uv-0.13.8` package manager.
  - Installed official `github/spec-kit` (`specify-cli v1.4.1.dev0`) globally into user environment (`~/.local/bin/specify.exe`).
  - Initialized Spec Kit root environment at `D:\MindRush` using the native Antigravity (`agy`) integration.
  - Added `.specify/` infrastructure with memory, PowerShell automation scripts (`check-prerequisites.ps1`, `common.ps1`, `create-new-feature.ps1`, etc.), templates, and workflows.
  - Added 9 workspace skills in `.agents/skills/`:
    - `/speckit-constitution`
    - `/speckit-specify`
    - `/speckit-clarify`
    - `/speckit-plan`
    - `/speckit-checklist`
    - `/speckit-tasks`
    - `/speckit-analyze`
    - `/speckit-implement`
    - `/speckit-converge`
- **Documentation & Tracking Suite:**
  - Created `docs/INSTALLATION_AND_ENVIRONMENT_LOG.md`
  - Created `docs/FILE_CHANGE_REGISTER.md`
  - Created `docs/ERROR_AND_FIX_LOG.md`
  - Created `docs/TEST_REPORT.md`
  - Created `docs/DEVELOPMENT_LOG.md`
  - Created `docs/CHANGELOG.md`
  - Created `docs/PROJECT_STATUS.md`
  - Created directory `docs/PHASE_COMPLETION_REPORTS/`



## [1.1.0] - 2026-11-22
### Added
- Feature 001: AI-Assisted Question Generation and Question Bank Expansion (T001–T054).
- Models: SourceDocument, SourceQuestion, GenerationBatch, GeneratedQuestion, ValidationResult, QuestionReport.
- Python AI Microservice: Ollama LLM Client (qwen3.5:4b), Few-shot PromptBuilder with canonical baseline questions, PyMuPDF PDF Extractor, Deterministic AST Math Validator, 4-tier Duplicate Detector, Schema Validator.
- Server Services: AiClient, BatchProcessor, QuestionAdapter, QuestionPublisher with atomic sequence and staged file writes.
- Administrative Routes and UI: Batch Generation, Human Review Queue, Publication Manager, Source Document Catalog, Analytics Dashboard.
- Gameplay Preparation: Question report endpoint and tightened backward-compatible EducationalEngine constructor normalizer.
