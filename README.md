# MindRush — Interactive Gesture Arcade & AI-Assisted Educational Gaming

[![Node.js CI](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.11+-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.100+-teal.svg)](https://fastapi.tiangolo.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Community_or_Atlas-forestgreen.svg)](https://www.mongodb.com)
[![Ollama](https://img.shields.io/badge/Ollama-Qwen3.5_4B-orange.svg)](https://ollama.com)

MindRush is a dual-mode gaming and educational platform. It combines real-time hand gesture tracking via webcam with local AI-assisted question generation, deterministic validation, and human review governance for primary school mathematics.

---

## 1. Game Modes & Capabilities

### Fun Mode (Arcade)
- **Breakout Retro Mode:** Classic paddle ball physics, power-ups, brick destruction, and hazard avoidance.
- **Space Invaders Retro Mode:** Multi-phase UFO waves, boss battles, dynamic reactive UFO AI, and gesture lasers.
- **Control Schemes:** Webcam hand gesture tracking (Handtrack.js / MediaPipe), mouse movement, and keyboard arrow controls.

### Educational Mode (Curriculum Learning)
- **Falling Answer Object Gameplay:** Questions appear with falling option badges. Cadets steer their paddle to catch the correct answer.
- **Progressive Scoring & Lives:** Zero lives lost on correct catches; progressive penalties and life deductions on incorrect or missed answers.
- **Verified Question Banks:** 100 canonical Crest Mathematics Olympiad (CMO) Standard 1 questions + companion dynamic expansion bank.

### AI-Assisted Question Generation Subsystem (Feature 001)
- **Source Material Extraction:** Ingests Olympiad PDF papers with canonical path traversal defense.
- **Local LLM Inference:** Generates grade-appropriate MCQs using local Ollama (`qwen3.5:4b`) with zero cloud token costs.
- **Automated Multi-Tier Validation:**
  - Pydantic schema integrity (4 distinct options, answer equivalence).
  - Deterministic safe AST math recalculation (addition and subtraction ground-truth verification).
  - 4-tier duplicate similarity detection (exact, normalized, Levenshtein distance, token overlap).
- **Human-in-the-Loop Governance:** Pending review queue with automated validation reports and mandatory rejection reasons.
- **Atomic Publication:** Monotonic IDs starting at `1001` via MongoDB atomic counter sequences and staged `.tmp` file replacement.

---

## 2. High-Level Technology Stack

- **Frontend:** HTML5, CSS3, JavaScript (ES Modules), p5.js, Handtrack.js, MediaPipe
- **Backend:** Node.js, Express.js, Mongoose, Argon2id, Express-Session, Connect-Mongo
- **AI Microservice:** Python 3.11+, FastAPI, Uvicorn, Pydantic, PyMuPDF, Safe AST
- **Local Inference:** Ollama Daemon running `qwen3.5:4b` (GGUF Q4_K_M)
- **Database:** MongoDB Community Server (Local) or MongoDB Atlas (Production)

---

## 3. Quick Start & Local Setup

### Prerequisites
- Node.js v18+ & Python 3.11+
- MongoDB Community Server running locally on `mongodb://127.0.0.1:27017`
- Ollama installed with candidate model pulled: `ollama pull qwen3.5:4b`

### Installation Steps

1. **Clone the Repository & Install Node Dependencies:**
   ```powershell
   git clone https://github.com/your-username/MindRush.git
   cd MindRush
   npm install
   ```

2. **Configure Environment:**
   ```powershell
   Copy-Item .env.example .env
   ```
   *Verify that `.env` points to `MONGODB_URI=mongodb://127.0.0.1:27017/MindRush`.*

3. **Set Up Python Virtual Environment:**
   ```powershell
   python -m venv MindRush-AI/.venv
   .\MindRush-AI\.venv\Scripts\Activate.ps1
   pip install -r MindRush-AI/requirements.txt
   ```

4. **Initialize Database & Seed Curriculum:**
   ```powershell
   node server/scripts/seed-curriculum.js
   ```

5. **Provision an Administrator Account:**
   ```powershell
   node server/scripts/create-admin.js
   ```

---

## 4. Running the Platform

Start each service in a dedicated terminal:

### Terminal 1: Ollama
```powershell
ollama serve
```

### Terminal 2: Python AI Microservice
```powershell
$env:PYTHONPATH="MindRush-AI"
.\MindRush-AI\.venv\Scripts\uvicorn ai_service.app:app --host 127.0.0.1 --port 5050
```

### Terminal 3: Node.js Express Server
```powershell
node server.js
```

---

## 5. Key URLs

- **Game Home:** `http://localhost:3000`
- **Cadet Login:** `http://localhost:3000/login`
- **Admin Flight Deck:** `http://localhost:3000/admin/index.html`
- **Question Generation Console:** `http://localhost:3000/admin/generate.html`
- **Human Review Queue:** `http://localhost:3000/admin/review.html`
- **Publication Manager:** `http://localhost:3000/admin/publish.html`
- **AI Microservice Health:** `http://127.0.0.1:5050/health`

---

## 6. Running Test Suites

```powershell
# Python AI Subsystem Tests (34 tests)
.\MindRush-AI\.venv\Scripts\pytest MindRush-AI/tests/

# Node.js Integration & Regression Suites (27 test suites)
node --test tests/test_foundation_milestone.mjs tests/test_admin_provisioning.mjs tests/test_generation_batch.mjs tests/test_validation_pipeline.mjs tests/test_review_workflow.mjs tests/test_educational_engine_adapter.mjs tests/test_publication_atomicity.mjs tests/test_dashboard_audit.mjs
```

---

## 7. Documentation Index

- [docs/ARCHITECTURE.md](file:///d:/MindRush/docs/ARCHITECTURE.md) — Detailed architecture, data flows, and service boundaries.
- [docs/DEVELOPMENT_SETUP.md](file:///d:/MindRush/docs/DEVELOPMENT_SETUP.md) — Fresh machine setup and troubleshooting guide.
- [docs/SECURITY_AUDIT.md](file:///d:/MindRush/docs/SECURITY_AUDIT.md) — Security audit findings, sanitization, and upload readiness.
- [docs/API_REFERENCE.md](file:///d:/MindRush/docs/API_REFERENCE.md) — Complete endpoint documentation.
- [docs/DATABASE_SCHEMA.md](file:///d:/MindRush/docs/DATABASE_SCHEMA.md) — MongoDB schemas, models, and dual-store patterns.
- [docs/AI_QUESTION_GENERATION.md](file:///d:/MindRush/docs/AI_QUESTION_GENERATION.md) — Detailed question generation and validation pipeline guide.
- [docs/ANTIGRAVITY_GUIDE.md](file:///d:/MindRush/docs/ANTIGRAVITY_GUIDE.md) — Collaboration guide for Google Antigravity IDE users.
- [docs/KNOWN_ISSUES.md](file:///d:/MindRush/docs/KNOWN_ISSUES.md) — Active limitations and technical register.
- [CONTRIBUTING.md](file:///d:/MindRush/CONTRIBUTING.md) — Developer guidelines and pull request instructions.
