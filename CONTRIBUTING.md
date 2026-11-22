# Contributing to MindRush

Thank you for your interest in contributing to **MindRush** — an educational and arcade gaming platform that combines real-time hand gesture tracking with AI-assisted curriculum question generation.

---

## 1. Code of Conduct & Core Principles

- **Player Experience First:** Game modes must remain performant (60 FPS arcade loop) with zero latency introduced by background AI inference.
- **Architectural Boundary:** The Node.js Express server is the **authoritative database writer**. The Python AI microservice is **strictly stateless compute** running on loopback (`127.0.0.1`) without database access.
- **Human-in-the-Loop Governance:** AI-generated questions are never automatically published into gameplay; they must pass automated validation and human review.

---

## 2. Getting Started & Local Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/your-username/MindRush.git
   cd MindRush
   ```
2. **Install Node.js Dependencies:**
   ```bash
   npm install
   ```
3. **Configure Python AI Environment:**
   ```bash
   python -m venv MindRush-AI/.venv
   # Windows PowerShell:
   .\MindRush-AI\.venv\Scripts\Activate.ps1
   pip install -r MindRush-AI/requirements.txt
   ```
4. **Configure Local Environment File:**
   ```bash
   copy .env.example .env
   ```
   Edit `.env` to verify `MONGODB_URI=mongodb://127.0.0.1:27017/MindRush`.
5. **Set up Ollama & Download Model:**
   - Install Ollama from [ollama.com](https://ollama.com).
   - Pull the candidate model:
     ```bash
     ollama pull qwen3.5:4b
     ```
6. **Initialize Database & Seed Data:**
   ```bash
   node server/scripts/seed-curriculum.js
   ```
7. **Provision a Local Admin Account:**
   ```bash
   node server/scripts/create-admin.js
   ```

---

## 3. Development Workflow

### Starting the Stack
Run each service in a dedicated terminal window:

1. **Ollama Daemon:**
   ```bash
   ollama serve
   ```
2. **Python AI Microservice:**
   ```bash
   # Windows PowerShell:
   $env:PYTHONPATH="MindRush-AI"
   .\MindRush-AI\.venv\Scripts\uvicorn ai_service.app:app --host 127.0.0.1 --port 5050
   ```
3. **Node.js Express Server:**
   ```bash
   npm run dev   # or: node server.js
   ```

### Accessing the Platform
- Game Client: `http://localhost:3000`
- Cadet Login: `http://localhost:3000/login`
- Admin Flight Deck: `http://localhost:3000/admin/index.html`

---

## 4. Branching & Commit Conventions

- Create a feature branch from `main`:
  ```bash
  git checkout -b feature/your-feature-name
  # or for bug fixes:
  git checkout -b fix/issue-description
  ```
- Use conventional commits format:
  - `feat: implement new curriculum math validator`
  - `fix: resolve educational engine answer mismatch`
  - `docs: update development setup guide`
  - `test: add contract tests for publication endpoint`

---

## 5. Testing Requirements

Before opening a pull request, all test suites must pass cleanly:

1. **Python AI Microservice Tests:**
   ```bash
   .\MindRush-AI\.venv\Scripts\pytest MindRush-AI/tests/
   ```
2. **Node.js Integration & Regression Suites:**
   ```bash
   node --test tests/test_foundation_milestone.mjs tests/test_admin_provisioning.mjs tests/test_generation_batch.mjs tests/test_validation_pipeline.mjs tests/test_review_workflow.mjs tests/test_educational_engine_adapter.mjs tests/test_publication_atomicity.mjs tests/test_dashboard_audit.mjs
   ```

---

## 6. What Contributors Must NOT Commit

- Never commit `.env` or files containing passwords, API keys, or personal tokens.
- Never commit downloaded LLM weights (`*.gguf`, `*.bin`, or Ollama blob storage).
- Never commit copyrighted third-party Olympiad question paper PDFs.
- Never commit `.venv/`, `node_modules/`, or build artifacts.
