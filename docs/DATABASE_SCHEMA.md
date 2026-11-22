# MindRush Database Schema Reference

MindRush persists application data in MongoDB via **Mongoose**. All models include dual implementations (physical MongoDB Atlas / local MongoDB with in-memory stores for isolated unit testing).

---

## 1. Physical Collections & Models

### `users` (`server/models/User.js`)
Stores player cadets and administrators.
- `username` *(String, unique, lowercase, 3-16 chars)*
- `fullName` *(String, required)*
- `dob` *(Date, required, calendar validated)*
- `gender` *(String, enum: `['male', 'female']`)*
- `passwordHash` *(String, select: false, Argon2id hash)*
- `role` *(String, enum: `['player', 'admin']`, default: `'player'`)*
- `highScore` *(Number, default: 0)*
- `badges` *(Array of Strings, default: `[]`)*

### `curricula` (`server/models/Curriculum.js`)
Stores hierarchical syllabus structures.
- `curriculum_id` *(String, unique, e.g. `'cmo-math-olympiad'`)*
- `name` *(String, e.g. `'Crest Mathematics Olympiad'`)*
- `board` *(String, e.g. `'CREST'`)*
- `country` *(String, e.g. `'India'`)*
- `standards` *(Array of Standard objects with subjects, topics, and difficulty definitions)*

### `counters` (`server/models/Counter.js`)
Monotonic atomic sequence generator for publication IDs.
- `_id` *(String, e.g. `'published_question_id'`)*
- `seq` *(Number, initialized to 1000)*
- **Atomic Method:** `Counter.getNextSequence(name)` executes `$inc: { seq: 1 }` returning sequential integers (&ge; 1001).

### `generation_batches` (`server/models/GenerationBatch.js`)
Tracks generation batch runs and deduplication.
- `batch_id` *(String, unique UUID)*
- `idempotency_key` *(String, unique, sparse)*
- `request_hash` *(String, sha256 checksum of request parameters)*
- `status` *(String, enum: `['pending', 'generating', 'validating', 'completed', 'failed']`)*
- `requested_count` *(Number, 1 to 50)*
- `generated_count` *(Number, default: 0)*

### `generated_questions` (`server/models/GeneratedQuestion.js`)
Stores AI-generated question items and their review lifecycle.
- `question_id` *(String, unique UUID)*
- `batch_id` *(String, ref: GenerationBatch)*
- `question_text` *(String, required)*
- `question_type` *(String, enum: `['multiple_choice', 'true_false', 'fill_in_blank', 'numeric', 'short_answer']`, default: `'multiple_choice'`)*
- `options` *(Array of 4 `{ id: String, text: String }` objects)*
- `correct_option_id` *(String, matches one option id, e.g. `'A'`)*
- `correct_answer` *(`{ value: Mixed, type: 'number'|'string'|'boolean' }`)*
- `status` *(String, enum: `['pending_validation', 'validation_failed', 'pending_review', 'approved', 'rejected', 'correction_requested', 'published', 'disabled']`)*
- `published_id` *(Number, unique, sparse, allocated upon publication)*
- `rejection_reason` *(String, default null)*

### `validation_results` (`server/models/ValidationResult.js`)
Automated multi-tier validation findings.
- `question_id` *(String, unique, ref: GeneratedQuestion)*
- `schema_valid` *(Boolean)*
- `answer_valid` *(Boolean, math verification)*
- `recalculated_value` *(Mixed, deterministic ground-truth calculated value)*
- `duplicate_check` *(String, enum: `['passed', 'flagged_near', 'flagged_exact']`)*
- `similarity_score` *(Number, 0.0 to 1.0)*
- `overall_status` *(String, enum: `['pending_review', 'validation_failed']`)*

### `audit_logs` (`server/models/AuditLog.js`)
Application-level append-only governance trail.
- `actor_id` *(Mixed, User ID or 'SYSTEM_CLI')*
- `action` *(String, enum: `['DOCUMENT_UPLOAD', 'BATCH_GENERATE', 'QUESTION_EDIT', 'QUESTION_APPROVE', 'QUESTION_REJECT', 'QUESTION_PUBLISH', 'QUESTION_DISABLE', 'ADMIN_CREATE', 'ADMIN_ROLE_ELEVATE']`)*
- `target_collection` *(String)*
- `target_id` *(String)*
- `details` *(Object)*
- *Immutability:* Update and delete query and document hooks throw errors at the application layer.

### `source_documents` & `source_questions` (`server/models/SourceDocument.js`, `SourceQuestion.js`)
Metadata and extracted question banks from ingested PDF papers.
