# Feature Specification: AI-Assisted Question Generation and Question Bank Expansion

**Feature Branch**: `001-ai-question-generation`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "Develop an AI-assisted question-generation subsystem that expands the existing MindRush educational question bank using source material such as previous-year questions and approved references, with validation, human review, and controlled publication to the production question bank."

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories are PRIORITIZED as user journeys ordered by importance.
  Each user story/journey is INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
-->

### User Story 1 - Content Administrator Generates Questions from Source Material (Priority: P1)

A content administrator wants to expand the MindRush educational question bank without manually writing every question. The administrator selects a subject, topic, educational standard, and difficulty level, provides or selects approved source material (such as previous-year Olympiad questions), and requests the system to generate a specified number of new questions. The system uses the source material to understand question patterns, subject matter, and educational standards, and produces new, original questions that follow the existing MindRush question format. The administrator receives the generated questions for review.

**Why this priority**: This is the fundamental value proposition of the entire feature. Without the ability to generate questions from source material, no other workflow (validation, review, publication) has purpose. It directly reduces the manual effort of question creation while maintaining educational quality.

**Independent Test**: Can be fully tested by providing source material and generation parameters, triggering generation, and verifying that the output contains well-formed questions that follow the MindRush question format, are relevant to the requested subject/topic/standard/difficulty, and are meaningfully different from the source questions.

**Acceptance Scenarios**:

1. **Given** approved source material exists for Standard 1 Mathematics (e.g., CMO previous-year papers in `MindRush-AI/dataset/standard 1/mathematics/`), **When** the administrator requests generation of 10 new questions for Standard 1 Mathematics at a specified difficulty, **Then** the system produces 10 questions, each with question text, four answer options, a correct answer, subject, topic, standard, and difficulty metadata.
2. **Given** source material for a specific topic (e.g., "Addition"), **When** the administrator requests questions restricted to that topic, **Then** all generated questions are relevant to "Addition" and do not drift into unrelated topics.
3. **Given** the generation service encounters a failure or produces incomplete output, **When** the administrator views the results, **Then** the system clearly indicates which questions failed generation and does not silently accept invalid output.

---

### User Story 2 - Content Administrator Validates Generated Questions (Priority: P1)

After questions are generated, the content administrator needs confidence that every question meets quality standards before it reaches human review. The system automatically validates each generated question for completeness, structural correctness, answer consistency, subject/topic relevance, difficulty appropriateness, and duplicate detection against the existing question bank. Questions that fail validation are flagged with specific reasons and excluded from the review queue.

**Why this priority**: Validation is essential to prevent invalid, incomplete, or duplicate questions from entering the review pipeline. Without automated validation, the review burden on humans increases dramatically and question quality cannot be guaranteed. This is tightly coupled with generation and equally critical for MVP.

**Independent Test**: Can be tested by providing a set of questions (some valid, some deliberately flawed) and verifying that the validator correctly identifies and rejects questions with missing fields, incorrect correct-answer references, duplicate content, or inappropriate subject/topic assignments.

**Acceptance Scenarios**:

1. **Given** a generated question with a correct answer value that does not match any of its answer options, **When** validation runs, **Then** the question is rejected with a clear error indicating correct-answer inconsistency.
2. **Given** a generated question that is substantially similar to an existing question in the production question bank (currently 100 questions in `educational-questions.js`), **When** validation runs, **Then** the question is flagged as a potential duplicate.
3. **Given** a generated question with all required fields present, correct answer matching one of the options, appropriate subject/topic/standard/difficulty, and no duplicates detected, **When** validation runs, **Then** the question passes validation and is marked as ready for human review.

---

### User Story 3 - Content Reviewer Approves or Rejects Generated Questions (Priority: P2)

A content reviewer (educator or administrator) examines generated questions that have passed automated validation. The reviewer inspects the question text, answer options, correct answer, source reference, and metadata. The reviewer can approve the question (making it eligible for publication), reject it (with a reason), or request corrections. Only approved questions may proceed to publication. The system maintains clear status distinctions: generated, pending-review, approved, and rejected.

**Why this priority**: Human review is a mandatory quality gate required by the constitution. While the system can function without immediate review (questions remain in "pending-review"), this workflow ensures that no AI-generated question reaches students without human oversight. It is the second-priority user journey because generation and validation must work first.

**Independent Test**: Can be tested by presenting a set of validated questions to a reviewer interface, verifying that the reviewer can inspect all relevant information, and confirming that approve/reject/request-correction actions correctly update question status.

**Acceptance Scenarios**:

1. **Given** a validated question in "pending-review" status, **When** a reviewer approves it, **Then** the question status changes to "approved" and it becomes eligible for publication to the production question bank.
2. **Given** a validated question in "pending-review" status, **When** a reviewer rejects it with a reason, **Then** the question status changes to "rejected," the rejection reason is recorded, and the question does not become eligible for publication.
3. **Given** a question in "approved" status, **When** an administrator views the question bank, **Then** the question is clearly distinguishable from original questions and shows its generation metadata and approval record.

---

### User Story 4 - Content Administrator Publishes Approved Questions to the Production Question Bank (Priority: P2)

After questions are approved through human review, the content administrator publishes them to the production question bank through a controlled process. Published questions become available to MindRush Educational Mode alongside the existing original questions. The publication process preserves all existing original questions, follows the established question format, and ensures that generated and original questions remain distinguishable. No question is published automatically without explicit administrator action.

**Why this priority**: Publication is the final step that delivers actual educational value to players. Without it, generated questions remain unused. It depends on all prior stories (generation, validation, review) but is independently testable as a data transfer and integration mechanism.

**Independent Test**: Can be tested by taking an approved question, triggering publication, and verifying that the question appears in the production question bank in the correct format, that all existing questions remain unchanged, and that the question is properly served to Educational Mode.

**Acceptance Scenarios**:

1. **Given** an approved question with subject "Mathematics", topic "Addition", standard "1", and four answer options, **When** the administrator publishes it, **Then** the question is added to the production question bank in the existing MindRush question format (`{ id, question, options: [4 items], correctAnswer, topic }`), and all 100 existing original questions remain unchanged.
2. **Given** a question that has not been approved (status is "pending-review" or "rejected"), **When** the administrator attempts to publish it, **Then** the system refuses publication and indicates that only approved questions may be published.
3. **Given** a successfully published question, **When** a player starts an Educational Mode session, **Then** the published question is included in the available question pool alongside original questions.

---

### User Story 5 - Content Administrator Manages Source Material (Priority: P3)

A content administrator manages the educational source material used for question generation. The administrator can view existing source material organized by subject, topic, and educational standard. The administrator can add new approved source material for future generation sessions. Original source material is preserved without modification. The system distinguishes source material from generated questions.

**Why this priority**: Source material management enables ongoing question generation beyond the initial set. While the system can function with pre-existing source material (the PDFs already in `MindRush-AI/dataset/`), this story ensures the system can grow its reference base over time.

**Independent Test**: Can be tested by viewing existing source material, adding new material, and verifying that the new material is available for subsequent generation requests and that original material remains unchanged.

**Acceptance Scenarios**:

1. **Given** existing source material organized by standard and subject in `MindRush-AI/dataset/` (Standards 1-3, subjects: computer, logical_reasoning, mathematics, science), **When** the administrator views the source material catalog, **Then** all existing materials are listed with their standard, subject, and file identifiers.
2. **Given** new approved source material for Standard 2 Science, **When** the administrator adds it to the system, **Then** the material becomes available for future question generation targeting Standard 2 Science, and no existing materials are modified or removed.

---

### User Story 6 - Content Administrator Reviews Generation and Approval History (Priority: P3)

A content administrator reviews the history of question generation sessions, validation results, and approval decisions. The administrator can see which source materials were used, how many questions were generated, how many passed validation, and the approval status of each question. This audit trail supports quality assurance and allows the administrator to understand trends in generation quality over time.

**Why this priority**: Audit and history tracking provides operational visibility and quality assurance. While not required for the core generation-to-publication pipeline, it supports long-term management and improvement of the AI question generation process.

**Independent Test**: Can be tested by running a generation session, reviewing some questions, and verifying that the history accurately reflects the generation parameters, validation results, and review decisions.

**Acceptance Scenarios**:

1. **Given** a completed generation session that produced 10 questions, 8 passed validation, 6 were approved, and 2 were rejected, **When** the administrator views the session history, **Then** all these counts and statuses are accurately reflected.

---

### Edge Cases

- What happens when the source material is insufficient or empty for the requested subject/topic/standard combination? The system MUST inform the administrator that insufficient source material is available rather than generating low-quality or off-topic questions.
- What happens when the AI model produces malformed output (e.g., missing answer options, nonsensical text, partial JSON)? The system MUST reject malformed output during validation and report the failure clearly.
- What happens when the AI model is unavailable or fails to respond? The system MUST report the failure to the administrator and not silently skip generation.
- What happens when a generated question is an exact or near-exact copy of a source question? The system MUST detect substantial similarity during validation and flag the question.
- What happens when the administrator attempts to publish a question whose format does not match the existing production question bank format? The system MUST reject the publication and report the format incompatibility.
- What happens when the production question bank already contains a question substantially similar to the one being published? The system MUST warn the administrator and prevent silent duplication.
- What happens when generation is requested during active gameplay? AI question generation MUST NOT be required to execute during active gameplay sessions (Constitution §5). The generation process operates independently of live gameplay.
- What happens when the existing question bank file (`educational-questions.js`) is modified externally between publication operations? The system MUST re-read and validate the current state of the production question bank before each publication operation.
- What happens when the production question bank grows beyond the original 100 questions? The `QuestionDeck` must handle variable-length question arrays. Published question `id` values must remain unique across original and published questions and must not collide with existing IDs (currently 1–100).
- What happens when Educational Mode gameplay sessions involving published questions generate scores? The existing `Score` model's `mode` enum (`skyfall`, `space-invader`, `multiplayer`) does not include an `educational` value. The `EducationalInvaderEngine` currently submits scores with `mode: 'educational'`, which may be rejected by Mongoose validation. This is a pre-existing backend limitation that exists independently of this feature and should be addressed during the planning phase without silently expanding the scope of this specification.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate new educational questions using approved source material and specified generation parameters (subject, topic, standard, difficulty, quantity).
- **FR-002**: System MUST produce questions that follow the existing MindRush canonical question storage format: an object with `id` (number), `question` (string), `options` (array of exactly 4 strings), `correctAnswer` (string matching one of the options), and `topic` (string). Note: The existing game engines derive additional runtime fields from this storage format. The `EducationalInvaderEngine` consumes questions via `QuestionDeck.drawNextQuestion()`, which produces `shuffledOptions` and compares `correctAnswer` by text value. The `EducationalEngine` (falling-object mode) uses `correctIndex` (a numeric index into `options`) and `questionText`. Published questions MUST be stored in the canonical format and MUST remain compatible with the runtime transformations applied by both engines.
- **FR-003**: Generated questions MUST be original and meaningfully different from their source questions, not simple word substitutions or trivial rearrangements.
- **FR-004**: System MUST validate every generated question before it is eligible for human review, checking: completeness of all required fields, correctAnswer consistency with options, subject/topic/standard/difficulty relevance, readability, and duplicate detection against the existing question bank.
- **FR-005**: Questions that fail validation MUST be rejected with specific, actionable error descriptions rather than silently accepted.
- **FR-006**: System MUST support human review of validated questions before publication, allowing reviewers to approve, reject (with reason), or request corrections.
- **FR-007**: System MUST maintain distinguishable question statuses: generated, validated, pending-review, approved, and rejected.
- **FR-008**: Only questions with "approved" status MUST be eligible for publication to the production question bank.
- **FR-009**: System MUST transfer approved questions to the production question bank through a controlled, explicit publication process, not automatically.
- **FR-010**: Publication MUST preserve all existing original questions in the production question bank without modification.
- **FR-011**: System MUST distinguish between original questions (currently 100 Std. 1 Maths Olympiad questions) and AI-generated questions in the production question bank.
- **FR-012**: System MUST ensure published questions are included in the `QuestionDeck` source array and are compatible with both the `EducationalEngine` (falling-object catching mode) and the `EducationalInvaderEngine` (space-invader mode) question-consumption patterns, so that published questions are served to players alongside original questions.
- **FR-013**: System MUST detect and flag questions that are duplicates of or substantially similar to existing questions in the production question bank during validation.
- **FR-014**: System MUST support batch generation of multiple questions in a single generation request.
- **FR-015**: System MUST handle generation failures, incomplete AI responses, and invalid output gracefully, reporting errors to the administrator rather than silently failing.
- **FR-016**: System MUST support organizing and retrieving source material by subject, topic, and educational standard.
- **FR-017**: System MUST preserve original source material without modification or deletion.
- **FR-018**: System MUST support adding new approved source material for future generation sessions.
- **FR-019**: System MUST maintain an audit trail of generation sessions, including parameters used, source material referenced, number of questions generated, validation results, and review decisions.
- **FR-020**: System MUST support filtering and viewing questions by status (generated, validated, pending-review, approved, rejected), subject, topic, standard, and difficulty.
- **FR-021**: AI question generation MUST NOT be required to execute during active MindRush gameplay sessions.
- **FR-022**: System MUST store the correct answer as the actual answer text value, not as an option-position index, consistent with the existing question format where `correctAnswer` is a string matching one of the `options` array values.
- **FR-023**: System MUST support generation for all subjects and educational standards for which approved source material is available. The directory structure in `MindRush-AI/dataset/` covers Standards 1-3 and subjects Mathematics, Science, Computer, and Logical Reasoning, but only combinations with actual source files are eligible for generation.
- **FR-024**: System MUST ensure published questions are compatible with both existing Educational Mode engines (`EducationalEngine` and `EducationalInvaderEngine`) and their respective question-consumption patterns, without requiring modifications to those engines.
- **FR-025**: System MUST ensure published questions are included in the `QuestionDeck` source array when Educational Mode sessions are initialized, so that the existing shuffle-and-draw-without-repeats delivery mechanism serves both original and published questions.
- **FR-026**: System MUST assign unique, non-conflicting `id` values to published questions. Published question IDs MUST NOT collide with existing original question IDs (currently 1–100) or with other previously published question IDs.

### Key Entities

- **Source Material**: Educational reference documents (PDFs, question banks) used as context for AI question generation. Organized by educational standard and subject. Key attributes: standard, subject, file identifier, date added, material type.
- **Generated Question**: A question produced by the AI subsystem. Key attributes: question text, answer options (exactly 4), correct answer (text value), subject, topic, educational standard, difficulty level, generation session reference, source material references, current status, creation timestamp.
- **Question Status**: The lifecycle state of a generated question: generated → validated → pending-review → approved or rejected. Only approved questions are eligible for publication.
- **Generation Session**: A record of a single generation request. Key attributes: requested parameters (subject, topic, standard, difficulty, quantity), source materials used, questions produced, validation summary, session timestamp, administrator who initiated it.
- **Production Question**: A question in the active MindRush Educational Mode question bank. Currently structured as `{ id, question, options, correctAnswer, topic }`. Includes both original manually-created questions and published AI-generated questions, which must remain distinguishable.
- **Review Decision**: A human reviewer's action on a validated question: approve, reject (with reason), or request correction. Key attributes: reviewer identity, decision type, reason (for rejections), timestamp.
- **QuestionDeck**: The existing runtime question-delivery mechanism defined in `educational-questions.js`. Provides Fisher-Yates shuffle without repeats until exhaustion, `drawNextQuestion()` returning `{ ...q, shuffledOptions }`, and `drawLevelQuestions(count)` for level-based sessions. Currently initialized from the `EDUCATIONAL_QUESTIONS` array. Published questions must be includable in the `QuestionDeck` source array.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The system can generate at least 10 well-formed questions per generation request for any supported subject/standard/difficulty combination, with at least 80% passing automated validation on the first attempt.
- **SC-002**: Every generated question passes or fails automated validation with specific, actionable feedback — zero questions enter the review queue without passing validation.
- **SC-003**: A content reviewer can inspect and approve or reject a question in under 2 minutes, with all relevant information (question, options, correct answer, source reference, metadata) visible on the review interface.
- **SC-004**: Published questions integrate seamlessly with MindRush Educational Mode — players encounter both original and published questions without any difference in gameplay experience.
- **SC-005**: After publication of new questions, all 100 existing original questions in the production question bank remain intact and unmodified.
- **SC-006**: Duplicate or substantially similar questions are detected during validation with at least 90% recall — fewer than 10% of near-duplicate questions bypass the duplicate check.
- **SC-007**: The system correctly handles AI model failures or unavailability by reporting the error to the administrator within 30 seconds, with zero silent failures.
- **SC-008**: The end-to-end workflow (generate → validate → review → publish) can be completed for a batch of 10 questions within a single administrator session, reducing manual question creation effort by at least 50% compared to writing questions from scratch.

## Assumptions

- The existing MindRush Educational Mode question bank (100 Std. 1 Maths Olympiad questions in `public/js/game/educational-questions.js`) is the current production question bank, and its format (`{ id, question, options, correctAnswer, topic }`) is the target format for all published questions.
- The source material directory structure in `MindRush-AI/dataset/` covers Standards 1-3 and subjects: computer, logical_reasoning, mathematics, and science. However, only `standard 1/mathematics/` currently contains PDF source files (4 CMO papers). All other subject and standard directories exist but are currently empty. Generation is supported only for subject/standard combinations that have actual source material.
- The existing question bank Excel files in `QuestionBank/` and `backup org/question bank/` are reference/archive materials that may serve as additional source material but are not the production question bank.
- The existing MindRush Node.js/Express backend (with MongoDB via Mongoose and in-memory fallback) will continue to handle authentication, gameplay APIs, and question delivery.
- An AI model capable of educational question generation will be available locally (the constitution proposes Ollama with a suitable LLM, but the specific model selection is an implementation decision outside this specification's scope).
- Content administrators and reviewers are trusted internal users who have authenticated access to the administration interface. The system does not need to support public or untrusted user access to generation, review, or publication features.
- The `MindRush-AI/ganerated_questions/` directory exists but is currently empty, and is intended for storing generated question output.
- Educational Mode currently loads questions entirely from the client-side JavaScript module (`educational-questions.js`) with no server-side question API. The integration strategy for serving both original and published questions to the game client is an implementation decision. [NEEDS CLARIFICATION: The specific mechanism for making published questions available to the client-side `EDUCATIONAL_QUESTIONS` array and `QuestionDeck` — whether via build-time code generation, a server-side question API, or another approach — is a critical integration decision that must be resolved during the planning phase.]
- The `EducationalEngine` (falling-object catching mode) expects runtime fields `correctIndex` (a numeric index into the `options` array) and `questionText` (the question display string) that differ from the raw storage format field names (`correctAnswer` as text, `question` as the text field). The `EducationalInvaderEngine` (space-invader mode) uses the `QuestionDeck` class and compares `correctAnswer` by text value against `shuffledOptions`. The integration strategy must account for both consumption patterns. Whether the format transformation happens during publication, during game initialization, or within the existing engine code is an implementation decision.
- The existing `edu-app.js` question-loading pathway has a known inconsistency: it references `validation.questions` (a property that `validateQuestionBank()` does not return), and falls back to the full `EDUCATIONAL_QUESTIONS` array via `getQuestionsByType()`. The existing `educational-categories.html` uses placeholder category identifiers (`TYPE_1` through `TYPE_4`) that do not map to actual topic classifications in the question bank. These pre-existing issues exist independently of this feature and should be noted as planning considerations.
- The existing `Score` model's `mode` enum is `['skyfall', 'space-invader', 'multiplayer']`. The `EducationalInvaderEngine` submits scores with `mode: 'educational'` and passes an object to `submitScoreToServer()` which expects separate parameters. This is a pre-existing backend mismatch that exists independently of this feature and is not in scope for this specification.
