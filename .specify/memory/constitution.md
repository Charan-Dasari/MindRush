# MindRush Constitution

## Core Principles

### 1. Preserve Existing Project (NON-NEGOTIABLE)

- MindRush is an existing gaming and educational platform. New features MUST extend the existing project without unnecessarily disrupting its established functionality.
- Before modifying existing code, agents MUST inspect the relevant files, understand their purpose, and identify dependencies.
- Existing game mechanics, question banks, datasets, generated questions, user data, and project resources MUST NOT be deleted, overwritten, renamed, or moved without explicit approval.
- New features MUST integrate with the existing architecture rather than unnecessarily replacing or duplicating working functionality.
- Refactoring MUST be limited to what is necessary for the approved feature or improvement.
- Existing functionality MUST be tested after modifications to ensure unrelated features continue working.

### 2. Gesture-Based Interaction

- Gesture-based interaction is a planned fundamental capability of MindRush gameplay.
- The platform SHOULD support webcam-based gesture recognition for controlling gameplay.
- New gameplay mechanics SHOULD be designed with future gesture-based interaction in mind.
- Gesture recognition MUST be responsive and reliable when implemented, minimizing false detections and unintended actions.
- Camera access MUST require appropriate user permission.
- Camera-related failures, permission denial, and unavailable devices MUST be handled gracefully.
- Gesture processing MUST NOT unnecessarily interrupt gameplay or other user interactions.
- Gesture recognition technologies MUST be selected and integrated only after evaluating their compatibility with the existing project.

### 3. Gameplay and Educational Quality

- MindRush MUST maintain a balance between entertainment and educational value.
- The platform MUST preserve its two primary modes:
  - **Fun Mode:** Arcade-style gameplay, including falling-object catching and space-shooter-inspired gameplay.
  - **Educational Mode:** Interactive educational gameplay in which players solve questions through game mechanics.
- Game mechanics MUST be intuitive, engaging, and appropriate for their intended mode.
- Educational questions and answers MUST be accurate, unambiguous, and appropriate for their intended subject, standard, and difficulty level.
- Correct and incorrect player actions MUST receive clear and meaningful feedback.
- Difficulty progression SHOULD provide a fair challenge without making gameplay unnecessarily frustrating.
- New features MUST improve the player experience without compromising the educational purpose of the platform.
- Game concepts may take inspiration from existing games but MUST use original implementations and avoid copying protected assets or distinctive intellectual property.

### 4. Modular Architecture and Separation of Responsibilities

- Features MUST be developed using clear, maintainable, and appropriately separated modules.
- Gameplay logic, gesture recognition, educational content, question generation, validation, and data management SHOULD remain separate responsibilities.
- Communication between components MUST follow clearly defined interfaces and data formats.
- New functionality MUST avoid unnecessary coupling with existing components.
- Technology choices MUST remain consistent with the verified project architecture unless an approved architectural change is required.
- Reusable functionality SHOULD be preferred over duplicated implementations.

### 5. Performance and User Experience

- MindRush MUST provide a responsive and smooth gameplay experience.
- Game rendering, input processing, and game logic MUST minimize unnecessary processing overhead.
- Background operations MUST NOT unnecessarily block gameplay or the user interface.
- AI question generation and other resource-intensive operations MUST NOT be required to execute during active gameplay.
- Loading, processing, and error states MUST be communicated clearly to users.
- New features MUST be evaluated for their impact on performance, usability, and resource consumption.

### 6. Data Integrity (NON-NEGOTIABLE)

- Existing and newly created data MUST be handled consistently and reliably.
- Question records MUST follow a clearly defined and validated data structure.
- Question data MUST contain the required information, including question text, answer options, correct answer, subject, topic, standard, and difficulty wherever applicable.
- Correct answers MUST be stored as actual answer values rather than option-position identifiers wherever the data format requires it.
- Original, generated, reviewed, and approved questions MUST remain distinguishable.
- Duplicate questions SHOULD be detected and prevented wherever reasonably possible.
- Data imports, exports, updates, and migrations MUST preserve existing records and their relationships.
- Invalid, incomplete, or corrupted data MUST NOT silently enter the production question bank.

### 7. Privacy and Security

- User authentication and personal information MUST be handled securely.
- Any future camera access MUST require appropriate user permission.
- Camera footage and gesture data MUST NOT be stored or transmitted unnecessarily.
- Sensitive user information, credentials, API keys, and configuration secrets MUST NOT be hardcoded or exposed in source control.
- External services and AI models MUST be integrated with appropriate security and access controls.
- User data and project resources MUST be protected against unauthorized access, modification, and deletion.

### 8. Testability, Maintainability, and Documentation

- New functionality MUST be testable independently wherever practical.
- Important business logic, data validation, question generation, and gameplay behavior MUST have appropriate tests.
- Existing functionality MUST be verified after significant changes.
- Code MUST follow consistent naming conventions and project coding standards.
- Complex or non-obvious logic MUST include meaningful comments or documentation.
- Dependencies MUST be introduced only when they provide clear value.
- Documentation MUST be updated when architecture, workflows, APIs, or data structures change.

## Additional Constraints

### 1. Technology Stack

MindRush MUST prioritize its established technologies while allowing justified additions for future development.

#### 1.1 Current Platform Technologies

The currently identified platform technologies are:

| Component | Technology |
|---|---|
| Runtime | Node.js (ES modules) |
| Backend Framework | Express.js |
| Database | MongoDB (via Mongoose) |
| Session Management | express-session + connect-mongo |
| Password Hashing | Argon2 (argon2id) |
| Rate Limiting | express-rate-limit |
| Frontend | HTML5, CSS3, JavaScript |
| Game Logic | JavaScript |
| Environment Configuration | dotenv |

- Existing technologies SHOULD be reused whenever they adequately support the required functionality.
- The actual repository MUST be inspected before documenting additional technologies as implemented.
- Technologies that are planned but not yet implemented MUST NOT be presented as existing dependencies.

#### 1.2 Planned and Proposed Technologies

The following technologies are candidates for future development and MUST be evaluated before adoption.

| Component | Technology | Status |
|---|---|---|
| Gesture Recognition | MediaPipe | Planned |
| AI Service / Processing | Python | Proposed |
| AI Model Runtime | Ollama | Proposed |
| Language Model | Suitable locally hosted LLM | To be evaluated |
| Data Processing | Python libraries | Proposed |
| Database | Based on verified project architecture | To be determined |
| Semantic Retrieval | ChromaDB | Optional; subject to requirements |
| Platform Integration | API-based communication | To be determined |

- Python SHOULD be considered for AI-related processing and question-generation workflows.
- Ollama MAY be used to run locally hosted language models.
- ChromaDB MUST NOT be introduced unless semantic retrieval provides a clear benefit.
- Database selection MUST consider compatibility, maintainability, data integrity, and existing project architecture.
- AI technologies SHOULD remain replaceable where practical to avoid unnecessary dependency on a particular model or provider.
- Planned technologies MUST be updated to implemented status only after they have actually been integrated and verified.

#### 1.3 Technology Selection Rules

- Technologies MUST be selected based on actual project requirements rather than trends or unnecessary complexity.
- Existing dependencies MUST be inspected before introducing alternatives.
- New dependencies MUST have a clear purpose and documented justification.
- Frameworks, databases, and services MUST NOT be assumed to exist until verified in the repository.
- Major architectural or technology changes require approval.
- All technology choices MUST support the maintainability, performance, security, and long-term development of MindRush.

### 2. AI-Assisted Question Generation

- AI question generation is a supporting subsystem of MindRush's Educational Mode, not a replacement for the existing platform or its original question bank.
- AI-generated questions SHOULD expand the available educational content while maintaining the platform's established question structure.
- Question generation SHOULD use appropriate source material, such as previous-year questions, approved question banks, or other verified educational references.
- Generated questions MUST follow the requested subject, topic, standard, difficulty, and question format.
- AI-generated content MUST NOT automatically become part of the approved production question bank.
- Question generation SHOULD operate independently of active gameplay.
- The AI subsystem MUST provide a clear mechanism for handling generation failures, incomplete responses, and invalid output.
- AI models and supporting services MUST be selected based on quality, reliability, maintainability, resource requirements, and integration feasibility.

### 3. Question Validation and Human Approval

- Every generated question MUST pass structural and content validation before being considered for approval.
- Validation MUST check required fields, answer options, correct answer, difficulty, subject, topic, and other applicable metadata.
- The correct answer MUST be checked for consistency with the question and its available options.
- Duplicate or substantially similar questions SHOULD be identified before approval.
- Questions containing ambiguous, incorrect, irrelevant, or incomplete information MUST be rejected or sent for correction.
- Human review and approval MUST be supported before generated questions are added to the production question bank.
- The system MUST maintain a clear distinction between generated, pending-review, approved, and rejected questions.

### 4. Database and Retrieval Requirements

- The existing data storage and retrieval architecture MUST be inspected before implementing database-related changes.
- New data structures MUST be compatible with the approved project architecture.
- Database schemas, collections, and retrieval mechanisms MUST be documented where applicable.
- Data retrieval MUST support the filtering and selection requirements of Educational Mode, including subject, topic, standard, and difficulty.
- Any vector database or semantic retrieval system MUST be introduced only when its benefits and integration requirements are justified.
- Database migrations and structural changes MUST preserve existing records and maintain data consistency.

### 5. Data Management and Security

- Original educational resources and question banks MUST remain preserved and traceable.
- Generated questions MUST retain appropriate source or generation metadata wherever available.
- External AI services MUST NOT receive unnecessary personal or sensitive user information.
- API credentials and service configuration MUST be stored securely.
- Data backups MUST be considered before performing significant database or question-bank modifications.
- Importing or exporting question data MUST use validated and documented formats.

## Development Workflow

All significant development work MUST follow a structured, specification-driven workflow using Spec Kit.

1. **Specify:** Define the feature's purpose, requirements, expected behavior, user scenarios, and acceptance criteria before implementation.
2. **Plan:** Inspect the existing project and prepare a technical implementation plan that respects the current architecture and constitution.
3. **Task Breakdown:** Divide the implementation into small, clear, independently verifiable tasks.
4. **Implementation:** Implement only the approved requirements and avoid unrelated modifications.
5. **Testing:** Verify the new functionality, edge cases, data integrity, and compatibility with existing features.
6. **Review:** Review code changes, dependencies, security implications, and possible regressions before considering the feature complete.
7. **Documentation:** Update relevant technical documentation, configuration instructions, and project records.

Additional workflow requirements:

- Existing files and project resources MUST be inspected before modifications.
- Destructive operations MUST require explicit approval.
- Assumptions and unresolved technical decisions MUST be documented rather than silently treated as facts.
- Implementation MUST NOT begin when essential requirements or architectural decisions remain unclear.
- Each significant implementation stage SHOULD be verified before proceeding to the next stage.

## Governance

- This constitution defines the fundamental development principles and constraints for the entire MindRush project.
- All features, specifications, implementation plans, and code changes MUST comply with this constitution.
- If a specification or implementation conflicts with this constitution, the conflict MUST be resolved before implementation proceeds.
- Any proposed amendment MUST include a clear reason and an assessment of its impact on existing functionality and project architecture.
- Amendments MUST be reviewed and approved before being applied.
- Constitution amendments MUST follow semantic versioning:
  - **MAJOR:** Backward-incompatible changes to fundamental principles or governance.
  - **MINOR:** Addition of new principles, requirements, or significant constraints.
  - **PATCH:** Clarifications, wording improvements, or non-substantive corrections.
- All amendments MUST update the version, ratification date, and last amended date.

**Version:** 1.1.0  
**Ratified:** 2026-11-18  
**Last Amended:** 2026-11-18