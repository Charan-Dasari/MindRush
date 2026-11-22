# MindRush API Reference

This document lists all authenticated Express routes (Node.js) and internal loopback compute endpoints (Python FastAPI).

---

## 1. Node.js Express API (`server/`)

### A. Authentication Routes (`/api/auth`)

| Method | Endpoint | Auth Required | CSRF Required | Description |
|---|---|---|---|---|
| `POST` | `/api/auth/signup` | No | No | Registers new player cadet (`role: player`). |
| `POST` | `/api/auth/login` | No | No | Authenticates user credentials via Argon2id; issues session cookie. |
| `POST` | `/api/auth/logout` | Yes | No | Destroys current session and clears cookie. |
| `GET` | `/api/auth/me` | Yes | No | Returns active user profile and role. |

### B. Administrative Governance Routes (`/api/admin`)

*All admin endpoints require session authentication with `role: admin`. State-changing methods (`POST`, `PUT`, `PATCH`, `DELETE`) require the custom header `X-Requested-With: MindRush-Admin`.*

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/admin/generation` | Queues an asynchronous question generation batch. Enforces single-batch mutex and idempotency. |
| `GET` | `/api/admin/generation/:batchId` | Polls progress and status of a generation batch. |
| `GET` | `/api/admin/questions/pending-review` | Fetches questions awaiting review with automated validation reports. |
| `POST` | `/api/admin/questions/:id/review` | Approves or rejects a question (rejection requires mandatory `reason`). |
| `PATCH` | `/api/admin/questions/:id` | Edits question stem, options, or explanation. |
| `POST` | `/api/admin/questions/publish` | Publishes approved questions to `educational-questions-published.js`. |
| `POST` | `/api/admin/questions/:id/disable` | Disables a question from future publications. |
| `GET` | `/api/admin/documents` | Catalogs ingested source PDF documents. |
| `POST` | `/api/admin/documents` | Ingests a new PDF source document into the catalog. |
| `GET` | `/api/admin/dashboard` | Aggregates system metrics (batches, questions, source documents). |
| `GET` | `/api/admin/audit-logs` | Inspects append-only governance audit entries. |
| `GET` | `/api/admin/batches` | Lists all historical generation batches. |

### C. Question Delivery & Reporting Routes (`/api/questions`)

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/questions/random` | No | Prepared remote gameplay question delivery endpoint. |
| `POST` | `/api/questions/:id/report` | Optional | Submits a player problem report for a question. |

---

## 2. Python FastAPI Microservice API (`127.0.0.1:5050`)

*Internal loopback compute endpoints strictly require the header `X-Internal-Secret: <AI_SERVICE_SECRET>`.*

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/health` | No (Public probe) | Returns service health, GPU detection (`nvidia-smi`), and Ollama connectivity. |
| `GET` | `/internal/ping` | Yes | Verifies authenticated loopback connectivity. |
| `POST` | `/internal/generation/generate` | Yes | Invokes local Ollama `qwen3.5:4b` inference and returns structured MCQ JSON questions. |
| `POST` | `/internal/validation/validate` | Yes | Runs safe AST math recalculation, 4-tier duplicate checking, and Pydantic schema validation. |
| `POST` | `/internal/documents/extract` | Yes | PyMuPDF text and question extraction with canonical path containment security. |
