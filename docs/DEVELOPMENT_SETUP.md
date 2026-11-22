# MindRush Development Setup Guide

This guide walks a developer through configuring and running MindRush on a fresh Windows workstation.

---

## 1. Prerequisites & Required Tools

Ensure the following tools are installed:
- **Node.js:** v18.0.0 or higher (v20+ / v22+ recommended)
- **Python:** 3.11, 3.12, or 3.13 (64-bit)
- **MongoDB Community Server:** Running locally as a Windows service on default port `27017`
- **MongoDB Compass:** Recommended GUI for inspecting collections
- **Ollama:** Windows installer from [ollama.com](https://ollama.com)
- **Git:** Standard Windows Git distribution

---

## 2. Step-by-Step Installation

### Step A: Clone the Repository
```powershell
git clone https://github.com/your-username/MindRush.git
cd MindRush
```

### Step B: Configure Node.js Environment
```powershell
# Install Node dependencies
npm install

# Copy configuration template
Copy-Item .env.example .env
```
Open `.env` in your editor and verify:
```ini
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/MindRush
SESSION_SECRET=dev_session_secret_key_at_least_32_characters_long
AI_SERVICE_URL=http://127.0.0.1:5050
AI_SERVICE_SECRET=dev_internal_secret_key_change_in_production
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.5:4b
```

### Step C: Configure Python AI Subsystem
```powershell
# Create isolated virtual environment
python -m venv MindRush-AI/.venv

# Activate environment and install dependencies
.\MindRush-AI\.venv\Scripts\Activate.ps1
pip install -r MindRush-AI/requirements.txt
```

### Step D: Download Ollama Candidate Model
```powershell
# Ensure Ollama daemon is active
ollama serve

# In a separate terminal, pull the 3.3 GB candidate model:
ollama pull qwen3.5:4b
```

### Step E: Seed Curriculum & Initialize Counter
```powershell
node server/scripts/seed-curriculum.js
```
*Expected Output:*
```text
[MindRush DB] Successfully connected to MongoDB instance (mongodb://127.0.0.1:27017/MindRush)
[SUCCESS] Curriculum 'cmo-math-olympiad' seeded successfully.
[SUCCESS] Counter initialized: published_question_id = 1000
```

### Step F: Ingest Source Reference Documents (Optional)
```powershell
node server/scripts/seed-source-documents.js
```

### Step G: Provision Your Local Admin Account
```powershell
node server/scripts/create-admin.js
```
Follow the interactive prompts:
- Enter Username (e.g. `admin`)
- Enter Full Name (e.g. `Local Admin`)
- Enter Date of Birth (format: `YYYY-MM-DD`)
- Enter Gender (`male` or `female`)
- Enter and confirm your secure password

---

## 3. Starting the Application Stack

Open three separate terminal windows:

### Terminal 1: Ollama Service
```powershell
ollama serve
```

### Terminal 2: Python FastAPI Microservice
```powershell
$env:PYTHONPATH="MindRush-AI"
.\MindRush-AI\.venv\Scripts\uvicorn ai_service.app:app --host 127.0.0.1 --port 5050
```
*Verification:* Navigate to `http://127.0.0.1:5050/health` in your browser. It should report status `ok` with `ollama_connected: true`.

### Terminal 3: Node.js Web Server
```powershell
node server.js
```
*Verification:* Open `http://localhost:3000` to launch the game client.

---

## 4. Key Application URLs

- **Game Client / Home:** `http://localhost:3000`
- **Cadet Login:** `http://localhost:3000/login`
- **Admin Dashboard:** `http://localhost:3000/admin/index.html`
- **Question Generation Console:** `http://localhost:3000/admin/generate.html`
- **Human Review Queue:** `http://localhost:3000/admin/review.html`
- **Publication Manager:** `http://localhost:3000/admin/publish.html`
- **Source Documents Catalog:** `http://localhost:3000/admin/documents.html`
