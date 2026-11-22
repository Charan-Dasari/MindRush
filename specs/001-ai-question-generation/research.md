# Research: AI-Assisted Question Generation and Question Bank Expansion

**Feature Branch**: `001-ai-question-generation`  
**Date**: 2026-11-20 (Final Targeted Correction Pass)  
**Governing Documents**:
- Constitution v1.1.0 (`.specify/memory/constitution.md`)
- Feature 001 Specification (`specs/001-ai-question-generation/spec.md`)
- Master Implementation Prompt (`MindRush_AI_V1_Master_Prompt_for_Planning.txt`)
- Evidence Audit Report (`PLANNING_EVIDENCE_AUDIT.md`)

---

## 1. Question Delivery Integration Strategy & Lifecycle Limitations

### Problem Statement
How do approved questions become available to MindRush Educational Mode without introducing gameplay latency, breaking arcade mechanics, or producing silent data desynchronization?

### Architectural Tension & Reality
- Express writing `public/js/game/educational-questions-published.js` at runtime is **server-side runtime file writing**, NOT a true build-time process.
- **Explicit Limitations of Feature 001 Delivery**:
  - The companion-file generation approach is intended *strictly for local development and offline desktop play*.
  - It is **not suitable for read-only container filesystems** (`readOnlyRootFilesystem: true`), serverless architectures, CDN-backed static hosting (e.g. Firebase Hosting, S3/CloudFront), or multi-instance deployments behind a load balancer.
  - Filesystem replacement (`fs.renameSync`) and MongoDB updates do **not form a single atomic cross-system transaction**. A crash or system failure between file write and database commit can cause temporary inconsistency between the published file and database status. Advanced outbox reconciliation is deferred to later V1 phases.

### Consolidated Hybrid Delivery Strategy

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   FEATURE 001: LOCAL RUNTIME FILE                      │
│  • Intended strictly for local development and offline desktop play    │
│  • Express server writes educational-questions-published.js at runtime │
│  • Client engines import companion file synchronously                  │
│  • Staged temporary-file replacement (file.tmp -> rename)             │
│  • Known limit: Not an atomic distributed transaction; local dev only  │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ Phase 9b Migration
┌────────────────────────────────────────────────────────────────────────┐
│                   VERSION 1 TARGET: SERVER-SIDE API                    │
│  • Intended production architecture for all deployments                │
│  • GET /api/questions/random delivers approved questions dynamically   │
│  • Server performs randomization, topic distribution, session exclusion│
│  • In-game reporting immediately removes flagged questions from API    │
│  • EducationalEngine & EducationalInvaderEngine refactored to async    │
└────────────────────────────────────────────────────────────────────────┘
```

#### Feature 001 Publication, Disabling & Failure Handling
1. **Trigger**: Authorized administrator invokes `POST /api/admin/questions/publish` with approved question IDs.
2. **Locking**: An in-memory publication mutex ensures strictly one publication executes at any time.
3. **ID Assignment**: Unique integer IDs (1001+) are assigned sequentially via an atomic MongoDB sequence counter (`$inc` on `counters`).
4. **Staging & Rename**: Staged to `educational-questions-published.js.tmp` and renamed via `fs.renameSync`.
5. **Database Commit**: Database records are updated to `status: 'published'`.
6. **Failure Handling**: If the file write or rename fails, the database is untouched; question statuses remain in `approved`, returning `500 Internal Server Error`. If the database commit fails after rename, the file contains the questions but MongoDB records remain `approved`; manual republish or later V1 reconciliation resolves the state.
7. **Disabling & Withdrawal Lifecycle**:
   - In Feature 001, invoking `POST /api/admin/questions/:id/disable` immediately updates the question status to `disabled` in MongoDB and excludes it from `/api/questions/random`.
   - The existing local companion file (`educational-questions-published.js`) will continue to contain that question until the **next publication run**, which strictly filters out disabled questions. Disabling does NOT immediately withdraw questions from companion-file gameplay without re-publication.
   - In Phase 9b, once engines are migrated to async API delivery, disabling immediately removes the question from active gameplay without republishing files.

---

## 2. EducationalEngine Adapter Design & Answer Validation

### Verified Runtime Flow & Defect Analysis
1. **`EducationalInvaderEngine` (`educational-invader-engine.js`)**:
   - Consumes `QuestionDeck`, which yields `{ ...q, shuffledOptions }`.
   - Renders Answer UFO badges strictly from `shuffledOptions` (lines 436–450).
   - Validates correctness by string matching: `String(opt).trim() === String(this.currentQuestion.correctAnswer).trim()` (line 451).
   - Displays HUD question text from `this.currentQuestion.question` (line 1275).
   - **Conclusion**: 100% compatible with canonical format. Ignores `correctIndex` and `questionText`.

2. **`EducationalEngine` (`educational-engine.js` & `edu-app.js`)**:
   - `edu-app.js` falls back to raw `EDUCATIONAL_QUESTIONS` because `validateQuestionBank()` does not return a `.questions` property.
   - Does NOT shuffle options via `QuestionDeck`. Instantiates `new EducationalEngine(sessionQuestions, categoryName)`.
   - In `_prepareAnswerObjects()` (lines 208–218): renders options from `q.options[i]` and checks `_isCorrect: i === q.correctIndex`.
   - In HUD rendering (line 557): displays `this.currentQuestion.questionText`.
   - In feedback (lines 357, 399): looks up correct text via `q.options[q.correctIndex]`.
   - **Pre-Existing Bug**: In the existing repository, `correctIndex` and `questionText` are `undefined` on all 100 original questions.

### Strict Adapter Validation & Normalization Rules
To prevent silent corruption, misaligned answers, or displaying one option while validating against another:
1. **Strict Correctness Matching (No Silent Defaulting)**:
   - The adapter must **NEVER silently default to `correctIndex = 0`** if `correctAnswer` cannot be resolved.
   - It must verify that `correctAnswer` matches **exactly one** option in `q.options`.
   - If `correctAnswer` is missing, does not match any option, or matches multiple options ambiguously, the question MUST be rejected with a clear validation error (`INVALID_CORRECT_ANSWER`).
2. **Consistency of Existing `correctIndex`**:
   - If a question already supplies `correctIndex`, it must be validated:
     - Must be an integer within range `[0, q.options.length - 1]`.
     - The option at `q.options[q.correctIndex]` must strictly match `q.correctAnswer`.
     - If it conflicts, the question is flagged and rejected (`CORRECT_INDEX_MISMATCH`).
3. **Coupled Array Calculation**:
   - The array used to compute `correctIndex` must be **the exact array consumed by the engine's option renderer** (`q.options`).
4. **Canonical Field Preservation**:
   - The canonical fields (`question`, `options`, `correctAnswer`, `topic`) are preserved unmutated so `EducationalInvaderEngine` continues functioning untouched.
5. **Engine Constructor Normalizer**:
   ```javascript
   constructor(questions, categoryName) {
     this.questions = questions.map(q => {
       if (!q || !Array.isArray(q.options) || q.options.length < 2) {
         throw new Error(`[EducationalEngine] Question ${q?.id || 'unknown'} has invalid options array`);
       }
       
       const targetAnswer = String(q.correctAnswer || '').trim();
       if (!targetAnswer) {
         throw new Error(`[EducationalEngine] Question ${q.id} missing correctAnswer`);
       }

       // Find exact matching indices
       const matchingIndices = [];
       q.options.forEach((opt, idx) => {
         if (String(opt).trim() === targetAnswer) matchingIndices.push(idx);
       });

       if (matchingIndices.length === 0) {
         throw new Error(`[EducationalEngine] Question ${q.id} correctAnswer "${q.correctAnswer}" not found in options`);
       }
       if (matchingIndices.length > 1) {
         throw new Error(`[EducationalEngine] Question ${q.id} has duplicate options matching correctAnswer`);
       }

       const resolvedIndex = matchingIndices[0];

       // Validate existing correctIndex if present
       if (q.correctIndex !== undefined) {
         if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
           throw new Error(`[EducationalEngine] Question ${q.id} has out-of-range correctIndex: ${q.correctIndex}`);
         }
         if (q.correctIndex !== resolvedIndex) {
           throw new Error(`[EducationalEngine] Question ${q.id} correctIndex ${q.correctIndex} conflicts with correctAnswer "${q.correctAnswer}"`);
         }
       }

       return {
         ...q,
         questionText: q.questionText || q.question || '',
         correctIndex: resolvedIndex
       };
     });
     // ... rest of constructor initialization
   }
   ```

### Planned Acceptance Test Coverage (To Be Executed During Implementation)
1. **All 100 existing questions**: Every question in `EDUCATIONAL_QUESTIONS` produces non-empty `questionText` and `q.options[q.correctIndex] === q.correctAnswer`.
2. **All 4 Option Positions**: Verification that correct answers at indices 0, 1, 2, and 3 are correctly resolved.
3. **Missing `correctAnswer`**: Question rejected with descriptive error.
4. **No matching option**: Question rejected when `correctAnswer` does not match any option.
5. **Invalid/Out-of-range `correctIndex`**: Question rejected if `correctIndex < 0`, `correctIndex >= 4`, or not a number.
6. **Conflicting `correctIndex`**: Question rejected if `q.options[q.correctIndex] !== q.correctAnswer`.
7. **Duplicate matching options**: Question rejected if multiple options match `correctAnswer`.
8. **Shuffled options test**: Verifies that option shuffling in `QuestionDeck` preserves answer-to-option mapping.

---

## 3. MongoDB Ownership & Service Responsibility Boundaries

### Strict Division of Responsibilities
To prevent split-brain schema discrepancies and conflicting connection pools between Mongoose (Node.js) and PyMongo (Python):

| System / Boundary | Responsibility | Technologies | Authoritative Ownership |
|---|---|---|---|
| **Node.js Application Backend** | • Client-facing API & authentication<br>• Session validation & admin role checks<br>• Single writer to MongoDB<br>• Game question delivery & reporting<br>• Publication file generation & sequence counters | Node.js, Express, Mongoose | **SOLE AUTHORITATIVE OWNER of MongoDB collections** |
| **Python AI Microservice** | • Source document text parsing (PDF)<br>• LLM prompt engineering & Ollama inference<br>• Deterministic arithmetic validation<br>• Local vector indexing (Phase 4)<br>• Stateless compute over HTTP | Python, FastAPI, PyMuPDF, Pydantic | **NO DIRECT WRITE ACCESS to MongoDB**. Operates as a stateless calculation engine. |

---

## 4. ChromaDB & RAG Governance Conflict Resolution

- **Constitution §1.2**: Classifies ChromaDB as *"Optional; subject to requirements"* and mandates: *"ChromaDB MUST NOT be introduced unless semantic retrieval provides a clear benefit."*
- **Master Prompt Phase 4**: Defines ChromaDB with persistent local storage and `sentence-transformers/all-MiniLM-L6-v2` as a mandatory Version 1 requirement.
- **Resolved Governance Path**:
  1. **Feature 001**: Defer ChromaDB and embedding models. Standard 1 Mathematics has only 4 CMO papers; direct text extraction satisfies all criteria without introducing vector database overhead.
  2. **Phase 4 Mandatory Scope**: ChromaDB remains an explicit, mandatory component of the complete Version 1 roadmap.
  3. **Governance Reconciliation**: Prior to executing Phase 4 task generation, a minor administrative Constitution amendment (or explicit user approval) will be recorded updating ChromaDB from "Optional" to "Planned" based on the proven benefit of multi-standard semantic filtering.

---

## 5. Document Ingestion Security & Path Traversal Prevention

### The Security Contract
1. **Canonical Path Containment**:
   - The path is resolved canonically using `os.path.realpath`.
   - Containment is asserted: `target_path == canonical_root or target_path.startswith(canonical_root + os.sep)`.
   - String prefix traps (e.g. `dataset_secret/` matching `dataset`) are prevented by enforcing directory separators.
   - Traversal tokens (`..`), symlinks, hidden files, and null bytes are rejected with `400 Bad Request`.
2. **Feature 001 Scope**:
   - Size strictly limited to 25 MB max.
   - Allowed extensions for Feature 001: strictly `.pdf`.
   - Consistent path convention: paths are passed relative to `DATASET_ROOT` (e.g. `standard 1/mathematics/CMO-Sample-Paper-for-Class-1.pdf`).

---

## 6. Asynchronous Generation Lifecycle, Idempotency & Recovery

### Minimum Viable Implementation Constraints (Feature 001)
- Supports strictly **one Node.js process and one generation worker**.
- No distributed locking, no message brokers, and no automatic resume of partially completed LLM tokens.
- **Persistent Batch States**: `pending` → `generating` → `validating` → `completed` or `failed`.

### Persisted Idempotency & Request Hashing
- Each generation request accepts an `idempotency_key` (String).
- A SHA-256 hash of the normalized request payload (`request_hash`) is stored alongside the key.
- **Uniqueness & Matching Rules**:
  - `generation_batches` enforces a unique index on `idempotency_key`.
  - If a request is received with an existing `idempotency_key`:
    - If `request_hash` matches: Return the existing batch record (`200 OK` or `202 Accepted`).
    - If `request_hash` differs: Reject with `409 Conflict` (`IDEMPOTENCY_PAYLOAD_MISMATCH`).

### Recovery & Timeout Handling
- **Timeout**: Maximum execution window of 120 seconds. If Ollama fails to respond, batch transitions to `failed` (`timeout_exceeded`).
- **Startup Reconciliation**: On Node.js boot, any batch found in `pending`, `generating`, or `validating` is transitioned to `failed` with `error_message: "Job interrupted by server restart"`. A new request can then be submitted safely.
