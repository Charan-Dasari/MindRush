# Data Model: AI-Assisted Question Generation and Question Bank Expansion

**Feature Branch**: `001-ai-question-generation`  
**Date**: 2026-11-20 (Final Targeted Correction Pass)  
**Governing Context**: Reconciled against `MindRush_AI_V1_Master_Prompt_for_Planning.txt` Phase 2, Constitution v1.1.0, and Feature 001 Spec.

---

## 1. Logical Entities vs. Physical MongoDB Collections

The Master Implementation Prompt defines 13 logical data entities. To prevent operational complexity and connection contention while guaranteeing schema integrity, these are mapped to **11 physical MongoDB collections**.

| Logical Entity | Physical Collection Name | Representation / Consolidation Strategy | Authoritative Write Owner |
|---|---|---|---|
| **1. Curricula** | `curricula` | Physical Collection (Hierarchical tree) | Node.js / Mongoose |
| **2. Standards** | `curricula` (embedded) | Embedded in `curricula.standards` | Node.js / Mongoose |
| **3. Subjects** | `curricula` (embedded) | Embedded in `curricula.standards.subjects` | Node.js / Mongoose |
| **4. Topics** | `curricula` (embedded) | Embedded in `curricula.standards.subjects.topics` | Node.js / Mongoose |
| **5. Learning Outcomes** | `curricula` (embedded) | Embedded in `topics.subtopics.learning_outcomes` & difficulty rules | Node.js / Mongoose |
| **6. Source Documents** | `source_documents` | Physical Collection | Node.js / Mongoose |
| **7. Source Questions** | `source_questions` | Physical Collection | Node.js / Mongoose |
| **8. Generation Batches** | `generation_batches` | Physical Collection | Node.js / Mongoose |
| **9. Generated Questions** | `generated_questions` | Physical Collection | Node.js / Mongoose |
| **10. Validation Results** | `validation_results` | Physical Collection | Node.js / Mongoose |
| **11. Question Reports** | `question_reports` | Physical Collection | Node.js / Mongoose |
| **12. Admin Users** | `users` | Consolidated into `users` collection via `role: 'admin'` | Node.js / Mongoose |
| **13. Audit Logs** | `audit_logs` | Physical Collection | Node.js / Mongoose |
| *Infrastructure Helper* | `counters` | Physical Collection for atomic sequence generation | Node.js / Mongoose |

> [!IMPORTANT]
> **STRICT DATABASE OWNERSHIP**:
> Node.js / Express (via Mongoose) is the **sole writer** to MongoDB. Python FastAPI operates as a stateless computational microservice and does NOT connect directly to MongoDB.

---

## 2. Existing Collections (Modified / Unchanged)

### User (`users` collection)
Defined in `server/models/User.js`. Reused for session authentication and administrative authorization.

| Field | Type | Required | Constraints | Description |
|---|---|---|---|---|
| `_id` | ObjectId | Yes | Primary Key | User identifier |
| `fullName` | String | Yes | Max 100 | Cadet's full name |
| `username` | String | Yes | Unique, 3–16 chars, Lowercase | Unique handle |
| `dob` | Date | Yes | Valid date | Date of birth |
| `gender` | String | Yes | Enum: `male`, `female` | Gender |
| `passwordHash` | String | Yes | Never selected by default | Argon2id hash |
| **`role`** | **String** | **Yes** | **Enum: `player`, `admin`, Default: `player`** | **Authorization role** |
| `badges` | [String] | No | Default: [] | Player badges |
| `highScore` | Number | No | Default: 0 | Global high score |
| `insaneUnlocked` | Boolean | No | Default: false | Difficulty unlock flag |
| `createdAt` | Date | Auto | Current timestamp | Creation timestamp |
| `updatedAt` | Date | Auto | Current timestamp | Modification timestamp |

**Security Rules for `User.role`**:
- Public signup (`POST /api/auth/signup`) strictly sets `role: 'player'`. Untrusted client payloads cannot assign roles.
- Administrator accounts are provisioned exclusively via CLI: `node server/scripts/create-admin.js`.

### Score (`scores` collection)
Defined in `server/models/Score.js`. Unchanged by Feature 001.

---

## 3. New Collections: Schemas & Indexes

### Collection: `curricula` (Future-Proof V1 Design)
Stores curriculum definitions and hierarchical syllabus metadata. Avoids hardcoded academic-year defaults to support multiple boards, regions, and syllabus versions.

```javascript
const curriculumSchema = new mongoose.Schema({
  curriculum_id: { type: String, required: true, unique: true, trim: true }, // e.g. "cmo-math-olympiad"
  name: { type: String, required: true, trim: true }, // e.g. "Crest Mathematics Olympiad"
  board: { type: String, required: true, trim: true }, // e.g. "CREST"
  country: { type: String, required: true, trim: true }, // e.g. "India", "International"
  academic_year: { type: String, default: null }, // e.g. "2025-2026" (Optional, no fixed default)
  syllabus_version: { type: String, default: null }, // e.g. "v1.2" (Optional)
  standards: [{
    standard: { type: Number, required: true }, // 1, 2, 3
    subjects: [{
      subject_id: { type: String, required: true, trim: true }, // e.g. "mathematics"
      name: { type: String, required: true }, // e.g. "Mathematics"
      topics: [{
        topic_id: { type: String, required: true, trim: true }, // e.g. "addition"
        name: { type: String, required: true }, // e.g. "Addition & Subtraction"
        subtopics: [{
          subtopic_id: { type: String, required: true, trim: true }, // e.g. "single-digit-addition"
          name: { type: String, required: true },
          learning_outcomes: [{ type: String }], // ["understand addition", "solve word problems"]
          allowed_concepts: [{ type: String }], // ["numbers 0-9", "plus sign"]
          prerequisite_concepts: [{ type: String }] // ["number recognition"]
        }],
        difficulty_definitions: {
          easy: { type: String, required: true },
          medium: { type: String, required: true },
          hard: { type: String, required: true }
        }
      }]
    }]
  }]
}, { timestamps: true });
```
**Indexes**:
- `{ curriculum_id: 1 }` (Unique)

---

### Collection: `source_documents`
Tracks educational source documents uploaded or discovered in the workspace.

```javascript
const sourceDocumentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  file_path: { type: String, required: true, unique: true }, // Relative path inside dataset/
  file_hash: { type: String, required: true, index: true }, // SHA-256 for change/duplicate detection
  file_format: { type: String, required: true, enum: ['pdf', 'xlsx', 'xls', 'docx'] },
  curriculum_id: { type: String, required: true, ref: 'Curriculum' },
  standard: { type: Number, required: true, enum: [1, 2, 3] },
  subject: { type: String, required: true },
  source_organization: { type: String, default: "Educational Reference" },
  license_info: { type: String, required: true }, // Provenance / permissions
  processing_status: { type: String, required: true, enum: ['pending', 'extracted', 'error'], default: 'pending' },
  extracted_question_count: { type: Number, default: 0 },
  extraction_errors: [String]
}, { timestamps: true });
```
**Indexes**:
- `{ file_hash: 1 }` (Duplicate upload lookup)
- `{ standard: 1, subject: 1 }` (Material filtering)
- `{ file_path: 1 }` (Unique)

---

### Collection: `source_questions`
Stores reference questions extracted from source documents. Serves as the trusted few-shot reference pool.

```javascript
const sourceQuestionSchema = new mongoose.Schema({
  document_id: { type: mongoose.Schema.Types.ObjectId, ref: 'SourceDocument', required: true },
  question_text: { type: String, required: true },
  options: [{ type: String }],
  correct_answer: { type: String, default: null }, // Null if answer key was missing
  has_answer_key: { type: Boolean, required: true, default: false },
  source_page: { type: Number, default: null },
  curriculum_id: { type: String, required: true },
  standard: { type: Number, required: true },
  subject: { type: String, required: true },
  topic: { type: String, required: true },
  is_verified: { type: Boolean, default: false }, // Human verified flag
  embedding_id: { type: String, default: null } // ChromaDB vector ID (Phase 4)
}, { timestamps: true });
```
**Indexes**:
- `{ standard: 1, subject: 1, topic: 1 }` (Reference lookup)
- `{ document_id: 1 }`

---

### Collection: `generation_batches`
Tracks AI question generation requests, hardware parameters, idempotency, and batch status.

```javascript
const generationBatchSchema = new mongoose.Schema({
  batch_id: { type: String, required: true, unique: true }, // UUID string
  idempotency_key: { type: String, unique: true, sparse: true }, // Client-provided idempotency key
  request_hash: { type: String, required: true }, // SHA-256 of normalized request parameters
  worker_id: { type: String, default: "worker-1" }, // Single generation worker ID
  requested_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  curriculum_id: { type: String, required: true },
  standard: { type: Number, required: true },
  subject: { type: String, required: true },
  topic: { type: String, default: null },
  difficulty: { type: String, required: true, enum: ['easy', 'medium', 'hard'] },
  question_type: { type: String, required: true, enum: ['multiple_choice', 'true_false', 'fill_in_blank', 'numeric', 'short_answer'], default: 'multiple_choice' },
  requested_count: { type: Number, required: true, min: 1, max: 50 },
  model_name: { type: String, required: true }, // e.g. "qwen3.5:4b"
  prompt_version: { type: String, required: true, default: "1.0.0" },
  reference_question_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SourceQuestion' }],
  total_generated: { type: Number, default: 0 },
  total_validated: { type: Number, default: 0 },
  total_failed: { type: Number, default: 0 },
  status: { 
    type: String, 
    required: true, 
    enum: ['pending', 'generating', 'validating', 'completed', 'failed'], 
    default: 'pending' 
  },
  error_message: { type: String, default: null },
  duration_ms: { type: Number, default: null }
}, { timestamps: true });
```
**Indexes**:
- `{ batch_id: 1 }` (Unique)
- `{ idempotency_key: 1 }` (Unique, Sparse)
- `{ status: 1, createdAt: -1 }` (Active batch monitoring)
- `{ requested_by: 1, createdAt: -1 }` (Audit history)

**Valid Lifecycle Transitions**:
- `pending` → `generating` → `validating` → `completed`
- `pending` → `failed` (pre-validation error or immediate failure)
- `generating` → `failed` (Ollama timeout, crash, or server restart)
- `validating` → `failed` (schema/validation system failure)

---

### Collection: `generated_questions`
Authoritative master store for all AI-generated questions through their full lifecycle.

```javascript
const generatedQuestionSchema = new mongoose.Schema({
  question_id: { type: String, required: true, unique: true }, // Unique UUID
  batch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'GenerationBatch', required: true },
  curriculum_id: { type: String, required: true },
  standard: { type: Number, required: true },
  subject: { type: String, required: true },
  topic: { type: String, required: true },
  subtopic: { type: String, default: null },
  learning_outcome: { type: String, default: null },
  difficulty: { type: String, required: true, enum: ['easy', 'medium', 'hard'] },
  question_type: { type: String, required: true, enum: ['multiple_choice', 'true_false', 'fill_in_blank', 'numeric', 'short_answer'], default: 'multiple_choice' },
  language: { type: String, default: 'en' },
  question_text: { type: String, required: true },
  options: [{
    id: { type: String, required: true }, // "A", "B", "C", "D"
    text: { type: String, required: true }
  }],
  correct_answer: {
    value: { type: mongoose.Schema.Types.Mixed, required: true }, // Numeric value or text
    type: { type: String, required: true, enum: ['number', 'string', 'boolean'] }
  },
  correct_option_id: { type: String, default: null }, // "B"
  explanation: { type: String, required: true },
  source_references: [String],
  origin: { type: String, enum: ['ai_generated', 'extracted', 'manual'], default: 'ai_generated' },
  status: { 
    type: String, 
    required: true, 
    enum: ['pending_validation', 'validation_failed', 'pending_review', 'approved', 'rejected', 'correction_requested', 'published', 'reported', 'disabled', 'archived'],
    default: 'pending_validation'
  },
  published_id: { type: Number, unique: true, sparse: true, default: null }, // 1001+ assigned on publication
  reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  review_decision: { type: String, enum: ['approved', 'rejected', 'correction_requested', null], default: null },
  review_reason: { type: String, default: null },
  review_timestamp: { type: Date, default: null },
  published_at: { type: Date, default: null }
}, { timestamps: true });
```
**Indexes**:
- `{ question_id: 1 }` (Unique)
- `{ published_id: 1 }` (Unique, Sparse)
- `{ status: 1, standard: 1, subject: 1 }` (Review queue and filtering)
- `{ batch_id: 1 }`

---

### Collection: `validation_results`
Stores automated multi-tier audit results per question.

```javascript
const validationResultSchema = new mongoose.Schema({
  question_id: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedQuestion', required: true, unique: true },
  schema_valid: { type: Boolean, required: true },
  answer_valid: { type: Boolean, required: true }, // Deterministic recalculation
  recalculated_value: { type: mongoose.Schema.Types.Mixed, default: null },
  duplicate_check: { type: String, required: true, enum: ['passed', 'flagged_near', 'flagged_exact'] },
  similarity_score: { type: Number, default: 0.0 },
  most_similar_id: { type: Number, default: null },
  curriculum_check: { type: String, required: true, enum: ['passed', 'review_required', 'failed'] },
  difficulty_check: { type: String, required: true, enum: ['passed', 'review_required'] },
  language_check: { type: String, required: true, enum: ['passed', 'flagged'] },
  option_check: { type: String, required: true, enum: ['passed', 'failed'] },
  overall_status: { type: String, required: true, enum: ['pending_review', 'validation_failed'] },
  errors: [String]
}, { timestamps: true });
```
**Indexes**:
- `{ question_id: 1 }` (Unique)
- `{ overall_status: 1 }`

---

### Collection: `question_reports`
Stores in-game player feedback on ambiguous, incorrect, or out-of-syllabus questions.

```javascript
const questionReportSchema = new mongoose.Schema({
  question_id: { type: Number, required: true, index: true }, // Published ID (1001+)
  reported_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  report_type: { 
    type: String, 
    required: true, 
    enum: ['incorrect_answer', 'ambiguous', 'incorrect_options', 'typo', 'out_of_syllabus', 'other'] 
  },
  description: { type: String, default: "" },
  status: { type: String, required: true, enum: ['pending', 'investigating', 'resolved', 'dismissed'], default: 'pending' },
  resolution: { type: String, enum: ['withdrawn', 'corrected', 'no_action', null], default: null },
  resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });
```
**Indexes**:
- `{ question_id: 1, status: 1 }`
- `{ status: 1, createdAt: -1 }`

---

### Collection: `audit_logs`
Immutable audit register recording administrative actions.

```javascript
const auditLogSchema = new mongoose.Schema({
  actor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { 
    type: String, 
    required: true, 
    enum: ['DOCUMENT_UPLOAD', 'BATCH_GENERATE', 'QUESTION_EDIT', 'QUESTION_APPROVE', 'QUESTION_REJECT', 'QUESTION_PUBLISH', 'QUESTION_DISABLE'] 
  },
  target_collection: { type: String, required: true },
  target_id: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip_address: { type: String, default: null }
}, { timestamps: true });
```
**Indexes**:
- `{ action: 1, createdAt: -1 }`
- `{ actor_id: 1, createdAt: -1 }`
- `{ target_id: 1 }`

---

### Collection: `counters` (Atomic Sequence Generator)
Guarantees sequential, non-colliding `published_id` allocation.

```javascript
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // "published_question_id"
  seq: { type: Number, default: 1000 } // Increments to 1001, 1002, etc.
});

counterSchema.statics.getNextSequence = async function(name) {
  const counter = await this.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};
```
