# MindRush — AI Agent Working Rules & Guidelines

Welcome, AI Agent! You are working on the **MindRush** project. Follow these core rules to maintain architectural integrity, security, and quality.

---

## 1. Primary Knowledge Sources

Before executing or modifying code, review:
- `docs/ARCHITECTURE.md` — Decoupled client, Node.js server, MongoDB, and Python AI service roles.
- `docs/DATABASE_SCHEMA.md` — Dual Mongoose & in-memory models.
- `docs/API_REFERENCE.md` — Express & FastAPI endpoint definitions.
- `docs/KNOWN_ISSUES.md` — Existing technical constraints and deprecation notices.
- `.specify/memory/constitution.md` — Non-negotiable principles.

---

## 2. Immutable Architecture Invariants

1. **Database Writer Role:** Node.js (`server/`) is the **SOLE AUTHORITATIVE DATABASE WRITER**. The Python AI microservice (`MindRush-AI/`) is strictly a stateless compute engine listening on loopback (`127.0.0.1:5050`) with **zero database credentials or write access**.
2. **Gameplay Performance:** Never perform real-time LLM inference during active gameplay. Educational Mode loads questions synchronously from statically bundled files or cached delivery routes.
3. **Dual Model Pattern:** Every Mongoose model in `server/models/` must retain its paired `MemoryStore` fallback implementation to ensure offline and unit test isolation.
4. **Security & CSRF:** State-changing admin endpoints must enforce the `X-Requested-With: MindRush-Admin` custom header and validate origins.
5. **Human Governance:** All AI-generated questions must pass automated validation and require explicit human review before publication.

---

## 3. Testing Rules

Always run relevant tests before concluding any modification:
- **Python AI Suite:** `pytest MindRush-AI/tests/`
- **Node.js Test Suites:** `node --test tests/<suite_name>.mjs`

---

## 4. Git & Data Safety

- Never run `git commit`, `git push`, `git reset`, or `git clean` without explicit user permission.
- Never hardcode secrets, passwords, or personal connection strings.
- Never drop, clear, or reset MongoDB collections.
