# Antigravity IDE Development & Collaboration Guide

This guide instructs teammates and autonomous agents working within **Google Antigravity IDE** on how to inspect, develop, maintain, and test the MindRush platform safely.

---

## 1. What an Agent Must Read First

Before planning or editing code in this repository, you **MUST** read:

1. [constitution.md](file:///d:/MindRush/.specify/memory/constitution.md): The non-negotiable architectural principles.
2. [ARCHITECTURE.md](file:///d:/MindRush/docs/ARCHITECTURE.md): The complete multi-tier system architecture and service boundaries.
3. [DATABASE_SCHEMA.md](file:///d:/MindRush/docs/DATABASE_SCHEMA.md): MongoDB collections, fields, and dual model patterns.
4. [KNOWN_ISSUES.md](file:///d:/MindRush/docs/KNOWN_ISSUES.md): Existing known limitations.

---

## 2. Non-Negotiable Operational Rules for Antigravity

- **Authoritative Database Invariant:** Node.js (`server/`) is the **sole writer to MongoDB**. The Python AI microservice (`MindRush-AI/`) is strictly a stateless compute engine with **zero database credentials or write access**.
- **No Uncontrolled In-Game AI:** LLM inference is strictly an out-of-band administrative task. Never introduce live inference into the 60 FPS gameplay loop.
- **Git Safety:** Never execute `git commit`, `git push`, `git reset`, `git clean`, or stash operations without explicit human authorization.
- **Credential Protection:** Never hardcode secrets, API keys, passwords, or connection strings into code, documentation, or test fixtures.
- **Read Before Modifying:** Always inspect existing implementations in `server/models/`, `server/routes/`, and `public/js/game/` before modifying code.

---

## 3. Reusable Instruction Template for New Features

When prompting an Antigravity Agent to work on MindRush, use this template:

```markdown
You are working on the MindRush repository.

Before making any changes:
1. Read `.specify/memory/constitution.md` and `docs/ARCHITECTURE.md`.
2. Inspect the existing implementation in `server/`, `MindRush-AI/`, or `public/js/game/`.
3. Adhere to the established pattern:
   - Node.js is the sole MongoDB writer.
   - Python AI service is strictly stateless compute on port 5050.
   - Dual Mongoose + MemoryStore pattern must be preserved for any new model.
4. Run relevant test suites after making edits:
   - Python: `pytest MindRush-AI/tests/`
   - Node.js: `node --test tests/<relevant_test>.mjs`
5. Do NOT stage, commit, push, or delete database contents.
6. Clearly report what was implemented, what was verified, and any remaining limitations.
```
