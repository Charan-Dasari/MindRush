# Project Status — MindRush

**Current Phase:** Phase 0 Completed (Spec Kit Environment & Governance Established)  
**Last Updated:** 2026-11-16

---

## 1. Subsystem Health & Status

| Subsystem | Tech Stack | Status | Notes |
|---|---|---|---|
| **Web Frontend & Canvas** | HTML5, CSS3, ES6, js, Web Audio | **Operational** | Classic arcade game engine and educational mode intact in `public/`. |
| **Backend & Auth Service** | Node.js (v22), Express.js (v5), Mongoose | **Operational** | Authentication, sessions, scoring API intact in `server/`. Graceful in-memory fallback enabled when no MongoDB URI is supplied. |
| **Database & Persistence** | MongoDB Atlas / Local MongoDB | **Configured** | Supports Atlas connection string via `MONGODB_URI` in `.env`. |
| **Specification Engine** | GitHub Spec Kit (`specify-cli` v1.4.1.dev0) | **Configured** | Initialized at root `D:\MindRush` with native Antigravity (`agy`) integration. |
| **Agent Skills** | Antigravity Workspace Skills (`.agents/skills/`) | **Configured** | 9 SDD workflow skills deployed and ready for command invocation. |
| **AI Subsystem (Future)** | Python, FastAPI, Ollama, ChromaDB, MongoDB | **Pending Inception** | Datasets preserved under `MindRush-AI/dataset/`. Development will follow the SDD workflow (Specify → Plan → Tasks → Implement). |

---

## 2. Architectural Guardrails (Enforced for Future Phases)

1. **Non-Destructive Evolution:** The existing game engine in `public/` and Express backend in `server/` must never be rewritten or replaced.
2. **Authority Separation:** The Express backend remains the authoritative gateway for cadet accounts, gameplay sessions, scores, and serving vetted questions.
3. **Dedicated AI Microservice:** Python FastAPI will host document ingestion, chunking, question generation, and validation as an offline/background service.
4. **Authoritative Storage vs. Retrieval:** MongoDB is the authoritative database for validated questions; ChromaDB is a rebuildable vector retrieval cache.
5. **Zero Inference in Gameplay:** Offline question generation only; no live LLM calls during player game sessions.
6. **Human Verification Protocol:** AI-generated questions must undergo schema validation and explicit human review before promotion to the live question bank.
7. **Asset Immutability:** Original question banks and dataset PDFs (`QuestionBank/`, `MindRush-AI/dataset/`) must never be modified or deleted.
8. **Security & Secrets:** All credentials, keys, and private tokens remain in untracked `.env` files; no secrets in Git.
9. **Rigorous Audit Trail:** Every phase and feature requires corresponding development logs, file change registers, test reports, and error logs.

---

## 3. Next Milestone: Phase 1 — MindRush Project Constitution & Inception Specification

- **Objective:** Establish the formal MindRush project constitution using `/speckit-constitution`, defining all technical invariants, coding standards, and architectural rules.
- **Subsequent Action:** Formulate the baseline specification for the AI Question Generation microservice using `/speckit-specify`.

