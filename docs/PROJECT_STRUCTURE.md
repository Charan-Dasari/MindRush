# MindRush Project Structure

This directory map outlines the primary directories, responsibilities, and key architectural components of MindRush.

```
MindRush/
├── .agent/                             # Antigravity agent configuration and project rules
├── .specify/                           # Spec Kit memory, constitution, templates, and specifications
│   ├── memory/constitution.md          # Non-negotiable architectural principles
│   └── templates/                      # Standardized planning and task templates
├── docs/                               # Developer, architecture, and security documentation
│   ├── ARCHITECTURE.md                 # System architecture and data flow diagrams
│   ├── DEVELOPMENT_SETUP.md            # Fresh workstation setup guide
│   ├── SECURITY_AUDIT.md               # Security and credential audit report
│   ├── API_REFERENCE.md                # Complete API endpoint specifications
│   ├── DATABASE_SCHEMA.md              # MongoDB collections and Mongoose models
│   ├── AI_QUESTION_GENERATION.md       # AI question generation pipeline guide
│   ├── KNOWN_ISSUES.md                 # Recorded limitations and non-blocking issues
│   ├── ANTIGRAVITY_GUIDE.md            # Workflow guide for Antigravity IDE users
│   └── PROJECT_STATUS.md               # Real-time implementation verification status
├── MindRush-AI/                        # Python AI Microservice (Stateless compute)
│   ├── ai_service/                     # FastAPI application package
│   │   ├── app.py                      # FastAPI server shell & internal endpoints
│   │   ├── config.py                   # Environment configuration & loopback secret enforcement
│   │   ├── generator/                  # Ollama client and few-shot prompt builder
│   │   ├── validator/                  # Math AST, duplicate, and schema validators
│   │   └── extractor/                  # PyMuPDF extractor with path containment
│   ├── dataset/                        # Source material directory (CMO competition papers)
│   ├── requirements.txt                # Python dependencies
│   └── tests/                          # Python pytest test suites
├── public/                             # Static frontend web assets
│   ├── admin/                          # Content Administrator Flight Deck interfaces
│   │   ├── index.html                  # Admin governance & analytics overview
│   │   ├── generate.html               # Batch question generation console
│   │   ├── review.html                 # Human review queue
│   │   ├── publish.html                # Publication manager
│   │   └── documents.html              # Source documents catalog
│   ├── css/                            # Global CSS styling
│   ├── js/                             # Game engine and client-side logic
│   │   ├── game/                       # p5.js games, arcade engines, and normalizers
│   │   │   ├── educational-engine.js   # Normalizer and falling object logic
│   │   │   ├── educational-questions.js# Canonical question bank (100 verified items)
│   │   │   └── educational-questions-published.js # Dynamically published companion file
│   │   └── starfield.js                # Ambient space visual effects
│   ├── index.html                      # Game landing page
│   └── login.html                      # Cadet authentication portal
├── server/                             # Node.js authoritative backend
│   ├── middleware/                     # Express middleware (auth, admin role, CSRF defense)
│   ├── models/                         # Mongoose data models with memory fallbacks
│   │   ├── User.js                     # Cadet/Admin credentials and role authorization
│   │   ├── Curriculum.js               # Syllabus hierarchy (CMO Math Olympiad)
│   │   ├── Counter.js                  # Atomic sequence generator for published question IDs
│   │   ├── GenerationBatch.js          # Batch metadata, idempotency keys, and request hashes
│   │   ├── GeneratedQuestion.js        # AI-generated question documents
│   │   ├── ValidationResult.js         # Automated validation reports
│   │   ├── AuditLog.js                 # Append-only governance audit register
│   │   ├── SourceDocument.js           # PDF source document metadata
│   │   ├── SourceQuestion.js           # Extracted source reference questions
│   │   └── QuestionReport.js           # In-game player feedback & problem reports
│   ├── routes/                         # Express API route modules
│   │   ├── admin.js                    # Admin generation, review, publication, and audit routes
│   │   ├── auth.js                     # Signup, login, logout, and session check
│   │   ├── progress.js                 # Scores and badge progress
│   │   └── questions.js                # Gameplay question delivery and report endpoints
│   ├── scripts/                        # Administrative CLI utility scripts
│   │   ├── create-admin.js             # Interactive CLI admin provisioning script
│   │   ├── seed-curriculum.js          # Curriculum and atomic counter initializer
│   │   └── seed-source-documents.js    # PDF paper extraction seed script
│   ├── services/                       # Application services
│   │   ├── ai-client.js                # HTTP client for Python FastAPI service
│   │   ├── batch-processor.js          # Orchestrator for question validation pipeline
│   │   ├── question-adapter.js         # Document adapter for EducationalEngine game format
│   │   └── question-publisher.js       # Atomic publication service with staged file writes
│   └── utils/                          # Authentication utilities (Argon2id hashing)
├── tests/                              # Node.js unit and integration test suites
├── .env.example                        # Safe environment variable configuration template
├── .gitignore                          # Comprehensive Git ignore rules
├── package.json                        # Node.js project manifest & script definitions
└── server.js                           # Node.js main application bootstrap entrypoint
```
