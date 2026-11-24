# MindRush — Major Project Presentation Content & Speaker Guide

**Project Title:** MindRush: Interactive Gesture Arcade & AI-Assisted Educational Gaming Platform  
**Target:** Final Year Major Project / Capstone Defense & Technical Presentation  
**Format:** 12-Slide Comprehensive Deck Outline, Slide Text, Visual Guides, and Speaker Scripts  

---

## Slide 1: Title Slide

### Slide Metadata
- **Slide Number:** 1
- **Slide Type:** Title & Identification
- **Visual & Layout Guidance:** Dark cosmic / cyberpunk space background (`#0a0e17`) with cyan (`#00f0ff`) and amber accents. Display the MindRush logo, Space Invader pixel art assets, and webcam gesture icons.

### Slide Content (Copy & Paste to PPT)
# MindRush
### Interactive Gesture-Controlled Arcade & AI-Assisted Educational Gaming Platform

- **Domain:** Computer Vision • Local Generative AI • Full-Stack Web Development • EdTech Governance
- **Presented By:** [Student Name(s) / Roll Number(s)]
- **Project Supervisor:** [Supervisor Name & Designation]
- **Department:** Department of Computer Science and Engineering
- **Institution:** [College / University Name]
- **Academic Year:** 2025–2026

### Speaker Presentation Script
> "Respected evaluators and faculty members, good morning. Today, I am proud to present **MindRush** — an interactive web platform that merges hands-free computer vision gesture recognition with local, privacy-preserving Generative AI to deliver a 60 FPS arcade gaming experience tailored for primary school mathematics education."

---

## Slide 2: Introduction

### Slide Metadata
- **Slide Number:** 2
- **Slide Type:** Conceptual Introduction
- **Visual & Layout Guidance:** Three high-level pillar cards side-by-side:
  1. *Webcam Vision* (MediaPipe hand tracking icon)
  2. *Dual-Mode Arcade* (Space shooter & falling object graphics)
  3. *Local Generative AI* (Quantized LLM & safe AST math validation)

### Slide Content (Copy & Paste to PPT)
### What is MindRush?
- **Next-Generation EdTech:** An interactive web-based gaming and learning platform built for Standard 1 primary school mathematics (aligned with Crest Mathematics Olympiad syllabus).
- **Physical Gesture-Driven Interaction:** Eliminates passive mouse/touch clicking by utilizing real-time webcam hand tracking (MediaPipe) to steer gameplay objects.
- **Autonomous & Governed AI Pipeline:** Integrates a local, open-weights large language model (`Qwen3.5 4B`) to automatically generate grade-appropriate mathematics questions from syllabus documents.
- **Core Technology Stack:**
  - **Frontend:** HTML5 Canvas, p5.js, MediaPipe Hands WebAssembly/WebGL, Web Audio API
  - **Backend Server:** Node.js, Express.js, MongoDB (Mongoose), Argon2id, Express-Session
  - **AI Compute Microservice:** Python 3.11+, FastAPI, Ollama Runtime, PyMuPDF, Safe Python AST Parser

### Speaker Presentation Script
> "MindRush was conceived to transform passive screen time into an active, kinesthetic learning experience. Rather than reading dry multiple-choice worksheets, a 6-year-old student uses natural hand motions in front of their webcam to play arcade games, dodging hazards and catching correct mathematical answers. Behind the scenes, an isolated local AI microservice continuously creates new syllabus questions under strict automated and human governance."

---

## Slide 3: Abstract

### Slide Metadata
- **Slide Number:** 3
- **Slide Type:** Executive Summary & Formal Abstract
- **Visual & Layout Guidance:** Clean central card layout flanked by three key metric badges:
  - `60 FPS Guaranteed`
  - `Zero In-Game AI Latency`
  - `Deterministic AST Math Truth`

### Slide Content (Copy & Paste to PPT)
### Abstract
- MindRush implements a decoupled, multi-tier software architecture that bridges real-time computer vision input with localized generative language modeling.
- The platform provides two distinct gaming modes running consistently at **60 FPS**:
  - **Fun Mode:** Breakout physics and multi-phase Space Invader combat with hostile UFO armadas.
  - **Educational Mode:** Curriculum-aligned falling answer interception with anti-overlap physics.
- Questions are ingested from official Crest Mathematics Olympiad (CMO) PDF documents and synthesized out-of-band using a local `Qwen3.5 4B` model running under Ollama.
- To prevent AI hallucinations from reaching young learners, questions must pass a **3-tier automated verification pipeline**:
  1. Pydantic MCQ schema integrity
  2. Deterministic Safe AST mathematical recalculation (zero `eval()` usage)
  3. 4-tier duplicate and similarity detection
- Approved questions are allocated monotonic integer sequences and published atomically using POSIX staged file replacement, ensuring zero gameplay interruption.

### Speaker Presentation Script
> "In this project, we solved the classic dilemma of combining AI with real-time gaming. Calling language models during active play introduces unacceptable latency and risk of hallucination. MindRush decouples the AI completely: questions are generated offline, verified for ground truth using Python's Abstract Syntax Tree, approved by human teachers, and delivered synchronously into pre-compiled bundles. This ensures an instantaneous 60 frames per second at zero cloud API cost."

---

## Slide 4: Why MindRush?

### Slide Metadata
- **Slide Number:** 4
- **Slide Type:** Value Proposition & Rationale
- **Visual & Layout Guidance:** 2x2 grid card layout highlighting the four core advantages.

### Slide Content (Copy & Paste to PPT)
### Why MindRush?
- **1. Kinesthetic, Active Engagement:**
  - Physical hand movement stimulates fine motor skills and maintains high attention spans in early childhood education.
- **2. 100% Mathematically Trustworthy:**
  - LLMs frequently hallucinate simple arithmetic. MindRush eliminates errors by calculating mathematical ground-truth programmatically before publication.
- **3. Zero Gameplay Latency (60 FPS Performance):**
  - Generative AI processes run completely out-of-band. Game sessions fetch pre-verified bundles synchronously, guaranteeing no network stutter or freeze.
- **4. Student Privacy & Zero Recurring Cloud Costs:**
  - Operates 100% offline using locally quantized open-weights models (`Qwen3.5 4B`).
  - Video streams are processed purely in client memory via WebAssembly; no webcam data is ever sent across the network.

### Speaker Presentation Script
> "Why does MindRush matter? First, kinesthetic gestures keep children physically engaged. Second, we cannot allow an AI to teach a child that 5 plus 3 equals 9; our deterministic validation mathematically guarantees ground truth. Third, our decoupled architecture ensures students experience zero latency during gaming. And fourth, running everything locally guarantees complete data privacy for children and zero server billing."

---

## Slide 5: Project Objectives

### Slide Metadata
- **Slide Number:** 5
- **Slide Type:** Engineering Goals & Milestones
- **Visual & Layout Guidance:** Horizontal numbered progress roadmap or milestone checklist.

### Slide Content (Copy & Paste to PPT)
### Key Project Objectives
1. **Real-Time Webcam Spatial Tracking:**
   - Implement client-side hand tracking with MediaPipe to enable horizontal navigation and pinch-to-fire actions without dedicated hardware.
2. **Dual-Engine Gameplay Mechanics:**
   - Build two modular game engines: an arcade Space Invader/Breakout engine and an educational question-answering interceptor.
3. **Local AI Generation Pipeline:**
   - Ingest Olympiad source PDFs and automate grade-appropriate MCQ creation using an open-weight local LLM via Ollama.
4. **Deterministic Multi-Tier Verification:**
   - Develop safe AST arithmetic recalculation and a 4-tier similarity engine (exact, normalized, Levenshtein, Jaccard) to eliminate errors and duplicates.
5. **Human Governance & Atomic Publication:**
   - Create an administrative flight deck featuring review workflows, audit logging, and staged file deployment.
6. **Retention Gamification:**
   - Implement persistent celestial badge unlocking, dynamic scoring, and an interactive achievement gallery.

### Speaker Presentation Script
> "We defined six explicit engineering milestones: develop real-time webcam tracking without lag, build two distinct gameplay engines, implement local AI question extraction from PDFs, construct a deterministic AST math validator, establish a secure human review and atomic publishing workflow, and gamify the entire experience with celestial badges."

---

## Slide 6: Frontend Experience & Gameplay Modes

### Slide Metadata
- **Slide Number:** 6
- **Slide Type:** Gameplay Demonstration & Vision
- **Visual & Layout Guidance:** Split view showing:
  - Left: Educational falling badge mechanics with HUD.
  - Right: Space Invader boss encounter with MediaPipe landmark overlay.

### Slide Content (Copy & Paste to PPT)
### Frontend Modes & Gesture Vision
- **Educational Mode (Math Interceptor):**
  - Displays grade-level Olympiad questions in a dedicated HUD panel with a live countdown timer.
  - 4 answer options descend or roam as UFOs with **pairwise anti-collision repulsive physics** (labels never overlap).
  - Catching the correct answer preserves lives and builds score streaks; catching distractors deducts lives and applies progressive penalties.
- **Fun Mode (Retro Space Shooter & Breakout):**
  - Space Invaders mechanics: roaming UFO armadas, diving hostile attacks, Mini-Bosses (Glider, Kraken), and Final Boss Lady with telegraphed lightning attacks.
  - Breakout mechanics: paddle ball destruction physics and power-ups.
- **Webcam Computer Vision (MediaPipe Hands):**
  - Tracks Landmark 9 (middle knuckle) for smooth horizontal spaceship/paddle translation.
  - Calculates Euclidean distance between Landmark 4 (Thumb) and Landmark 8 (Index) for **pinch-to-fire** projectile triggering.
  - **Graceful Degradation:** Automatic switch to keyboard (Arrow/WASD) and mouse if webcam access is denied.

### Speaker Presentation Script
> "In Educational Mode, questions appear at the top while four answer badges descend toward the player's paddle. The badges incorporate active repulsion physics so their text labels never overlap. In Fun Mode, cadets engage in retro space combat against diving UFOs and animated multi-phase bosses. MediaPipe tracks the player's hand position across the screen, while pinching their thumb and index finger triggers laser fire. If no camera is available, the game falls back to keyboard controls automatically."

---

## Slide 7: System Architecture

### Slide Metadata
- **Slide Number:** 7
- **Slide Type:** Technical System Architecture
- **Visual & Layout Guidance:** Architectural block diagram illustrating service boundaries and data flows.

```
┌─────────────────────────────────────────────────────────────┐
│                 Client Browser (HTML5 Canvas)               │
│      p5.js Game Engine  •  MediaPipe Webcam Vision          │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / Session Cookies
                               ▼
┌─────────────────────────────────────────────────────────────┐
│          Node.js Express Backend (Port 3000)                │
│    • Sole Authoritative Database Writer                     │
│    • Session Auth (Argon2id) & Admin Governance Routes      │
│    • Atomic Staged File Publisher (.tmp -> renameSync)      │
└───────────────┬──────────────────────────────┬──────────────┘
                │ Mongoose                     │ Loopback HTTP
                ▼                              ▼ (X-Internal-Secret)
┌──────────────────────────────┐ ┌────────────────────────────┐
│      MongoDB (Port 27017)    │ │ Python FastAPI (Port 5050) │
│ Users, Curricula, Batches,   │ │ • Stateless Compute Engine │
│ Questions, AuditLogs         │ │ • Safe AST Math Validator  │
└──────────────────────────────┘ │ • 4-Tier Duplicate Check   │
                                 └─────────────┬──────────────┘
                                               │ Local REST
                                               ▼
                                 ┌────────────────────────────┐
                                 │   Ollama (Qwen3.5 4B)      │
                                 └────────────────────────────┘
```

### Slide Content (Copy & Paste to PPT)
### System Architecture & Service Boundaries
- **Strict Role Separation & Security Invariants:**
  - **Node.js Express (Port 3000):** The **SOLE authoritative database writer**. Handles user sessions (Argon2id), CSRF security, and game asset delivery.
  - **Python FastAPI (Port 5050):** A **stateless compute engine** listening only on loopback. Has **ZERO database access or credentials**.
- **Automated Validation Pipeline:**
  - **Tier 1:** Pydantic schema validation (4 distinct options, valid answer references).
  - **Tier 2:** Safe AST arithmetic recalculation (parses expressions via Python AST grammar; zero `eval()`).
  - **Tier 3:** 4-tier similarity check (Exact match, Normalized stem, Levenshtein ratio $\ge 0.85$, Jaccard token ratio $\ge 0.80$).
- **Atomic File Staging:**
  - Published questions are allocated atomic sequence IDs (`1001+`) and written to a `.tmp` file before an atomic POSIX `renameSync` ensures zero live gameplay read collisions.

### Speaker Presentation Script
> "MindRush enforces strict architectural boundaries. Node.js is our authoritative server and the sole database writer. The Python FastAPI service is purely a stateless compute worker on loopback that has zero database credentials. When new questions are generated, Python performs schema validation, AST math ground-truth checking, and 4-tier duplicate detection before sending reports back to Node.js for human review."

---

## Slide 8: Database Schema & Data Models

### Slide Metadata
- **Slide Number:** 8
- **Slide Type:** Database Design & Data Integrity
- **Visual & Layout Guidance:** Side-by-side ER diagrams split across two columns:
  - Left Column: [Player & Gameplay ER Diagram (PNG)](file:///c:/Users/devic/Downloads/Major_Project_2/MindRush-main/docs/diagrams/erd_player_gameplay.png)
  - Right Column: [Admin & AI Pipeline ER Diagram (PNG)](file:///c:/Users/devic/Downloads/Major_Project_2/MindRush-main/docs/diagrams/erd_admin_ai_pipeline.png)

### Slide Content (Copy & Paste to PPT)
### Database Schema & Modeling
- **Primary MongoDB Collections (Mongoose):**
  - `users`: Cadet/Admin records, Argon2id password hashes, roles (`player`, `admin`), high scores, unlocked badges.
  - `curricula`: Syllabus hierarchy (Board: CREST, Standard: 1, Subjects, Topics).
  - `generation_batches`: Tracks batch requests, status (`pending`, `completed`, `failed`), and idempotency keys.
  - `generated_questions`: Stores stems, 4 options, correct answer values, and lifecycle status (`pending_review`, `approved`, `published`).
  - `validation_results`: Schema pass/fail flags, calculated AST ground-truth values, and duplicate similarity metrics.
  - `audit_logs`: Tamper-resistant append-only governance trail with Mongoose immutability hooks.
  - `counters`: Monotonic atomic sequence generator for sequential published IDs (`1001+`).
- **Dual-Model Architectural Pattern:**
  - Every Mongoose model has a paired in-memory implementation (`MemoryStore`).
  - Enables 100% offline, isolated unit and regression testing without requiring an active database daemon.

### Speaker Presentation Script
> "Our persistence layer uses MongoDB. Questions transition through distinct lifecycle states: generation, validation, review, and publication. We record every administrative decision in an append-only audit log. Furthermore, we designed a Dual-Model pattern where every schema has an in-memory equivalent, allowing our automated test suites to execute offline with complete isolation."

---

## Slide 9: Gamification & Celestial Badge System

### Slide Metadata
- **Slide Number:** 9
- **Slide Type:** Retention & User Experience
- **Visual & Layout Guidance:** Showcase of badge assets (Silver Hexagon, Water Droplet, Golden Sunburst, Celestial Ring) alongside the Badge Gallery UI.

### Slide Content (Copy & Paste to PPT)
### Gamification & Badge System
- **Pedagogical Reward Architecture:**
  - Replaces discouraging red-pen marks with positive reinforcement and collectible cosmic artifacts.
  - Motivates continuous math revision through gameplay progression.
- **Collectible Badge Tiers:**
  - **Foundational Tier:** Silver Hexagon, Water Droplet (+10 pts) awarded for early correct answers.
  - **Solar Tier:** Golden Sunburst, Green Crystal Leaf (+20 pts) awarded for accuracy streaks.
  - **Milestone Tier:** Golden Lucky Star (+100 pts) unlocked upon reaching a 250-point score threshold.
  - **Mastery Tier:** Ancient Planetary Rings, Spiral Shells, and Boss Defeat Crests.
- **Persistence & Interactive Gallery (`/badge-gallery.html`):**
  - Unlocked badges persist in local storage and synchronize with the player's MongoDB profile.
  - Players can inspect their collection, point values, and cosmic lore in the dedicated Cadet Gallery.

### Speaker Presentation Script
> "To motivate young learners, MindRush implements a celestial badge collection system. As students solve questions quickly and build accuracy streaks, they earn cosmic badges such as the Golden Sunburst and Crystal Leaf. These badges persist in the student's profile and can be viewed inside an interactive trophy room, transforming repetitive math practice into an exciting collectible adventure."

---

## Slide 10: Challenges Encountered & Engineering Solutions

### Slide Metadata
- **Slide Number:** 10
- **Slide Type:** Technical Problem Solving & Engineering Rigor
- **Visual & Layout Guidance:** 4 challenge-solution comparison cards.

### Slide Content (Copy & Paste to PPT)
### Challenges & Engineering Solutions
- **1. LLM Reasoning Tags Breaking Structured JSON:**
  - *Challenge:* `qwen3.5:4b` defaulted to outputting internal `<think>` reasoning tags, exceeding token budgets and corrupting JSON output.
  - *Solution:* Configured Ollama parameters with `think: false`, `num_predict: 1024`, and implemented Pydantic fallback parsing.
- **2. GPU Out-of-Memory on 4 GB VRAM Hardware:**
  - *Challenge:* Simultaneous batch requests caused VRAM spikes and CUDA out-of-memory crashes on consumer laptops.
  - *Solution:* Implemented a hardware concurrency mutex lock (`threading.Lock(1)`) in FastAPI to enforce single-threaded GPU load.
- **3. Floating Answer Badge Visual Overlap:**
  - *Challenge:* Moving answer badges crossed paths on screen, making multiple-choice options unreadable for children.
  - *Solution:* Engineered sector-bounded horizontal roaming and active pairwise repulsive bounce physics.
- **4. File Corruption Risks During Active Gameplay:**
  - *Challenge:* Overwriting the published question bank during live gameplay could trigger client read errors.
  - *Solution:* Adopted staged `.tmp` file generation followed by atomic POSIX `renameSync`.

### Speaker Presentation Script
> "During development, we solved four critical engineering problems. First, we disabled the LLM's thinking mode to guarantee clean JSON parsing. Second, we added a thread-level mutex in FastAPI to prevent GPU memory crashes on 4 GB graphics cards. Third, we added repulsive physics to floating answer badges so text never collides. And fourth, we used atomic POSIX file renaming to ensure active games never crash when new questions are published."

---

## Slide 11: Future Scope

### Slide Metadata
- **Slide Number:** 11
- **Slide Type:** Project Roadmap & Scalability
- **Visual & Layout Guidance:** 4-pillar modular grid card layout:
  1. *Real-Time Multiplayer* (Room codes & synchronization)
  2. *In-Game Economy & Shop* (Point-based cosmetics & items)
  3. *Curriculum Expansion* (Multi-grade & multi-subject)
  4. *Adaptive Difficulty & Analytics* (Telemetry & DDA)

### Slide Content (Copy & Paste to PPT)
### Future Scope & Roadmap
- **1. Real-Time Multiplayer Gameplay & Infrastructure:**
  - **Lobby System:** Instant room creation with 6-character "Join-by-Code" access for classrooms and friends.
  - **Real-Time Synchronization:** Low-latency state sync via WebSockets for concurrent paddle/ship battles.
  - **Shared Game Controls:** Synchronized pause/resume functionality across connected clients.
  - **Server-Side Validation:** Authoritative server-side score calculation to prevent client tampering.
  - **Competitive Leaderboards:** Live multi-tier match rankings and global/classroom leaderboards.
- **2. In-Game Rewards Economy & Customization Shop:**
  - **Points-for-Items Economy:** Cadets redeem points scored through academic accuracy (100% non-monetary, earned through play).
  - **Unlockable Arsenal:** Purchase new ball sets (flame, plasma, cosmic), upgraded spaceships, custom lasers, and unique paddle skins.
  - **Encounter Packs:** Unlock custom enemy waves, new boss encounters, and rare cosmetic collectibles.
- **3. Curriculum & Subject Expansion:**
  - **Higher Grades:** Scaling AST validation to Standards 2–5 (Multiplication, Division, Geometry, Word Problems).
  - **Multi-Disciplinary:** Extending pipeline to Science (Astronomy, Biology), English Vocabulary, and Spatial Logic.
- **4. Advanced Statistics & Adaptive Difficulty (DDA):**
  - In-depth cadet performance dashboards tracking speed, accuracy by topic, and conceptual weaknesses.
  - Dynamic difficulty calibration adjusting falling speed, distraction density, and question complexity in real time.

### Speaker Presentation Script
> "Looking ahead, MindRush is architected for significant expansion. First, we plan to implement a robust WebSocket multiplayer system featuring room creation with join codes, shared pause states, and authoritative server-side score validation. Second, we will introduce a gamified in-game shop where students redeem points earned from correct answers to unlock custom spaceships, themed ball sets, and exclusive boss encounters. Third, we will expand our deterministic AST validation engine from Grade 1 Math to higher grades and subjects like Science and English. Finally, advanced analytics and real-time adaptive difficulty will dynamically tailor the gameplay challenge to each cadet's individual learning curve."

---

## Slide 12: Conclusion

### Slide Metadata
- **Slide Number:** 12
- **Slide Type:** Summary & Closing
- **Visual & Layout Guidance:** Elegant summary card highlighting the 4 core achievements, followed by a prominent Thank You callout and GitHub/contact information.

### Slide Content (Copy & Paste to PPT)
### Conclusion
- **Kinesthetic EdTech Innovation:** Successfully merged hands-free webcam gesture recognition with arcade gaming to create an active learning experience.
- **Guaranteed Mathematical Truth:** Solved generative AI hallucination risks through deterministic Safe AST arithmetic calculation and 4-tier duplicate checking.
- **Robust Multi-Tier Architecture:** Maintained strict database boundaries (Node.js sole writer, Python stateless compute) and achieved consistent 60 FPS gameplay.
- **Cost-Free & Privacy-Preserving:** 100% locally hosted on open-weight models with zero cloud API dependencies and full student privacy.
- **Verification Status:**
  - Python AI Test Suite: **34/34 Tests Passed (100%)**
  - Node.js Integration Suite: **27 Test Suites Passed (100%)**

### Thank You!
**Questions & Discussion Welcomed**  
*Project Repository & Documentation Available*

### Speaker Presentation Script
> "To conclude, MindRush demonstrates that generative AI and computer vision can be united into an educational platform that is engaging, fast, and mathematically trustworthy. By keeping processing local, calculating ground-truth through AST, and using physical hand gestures, we have created a safe, zero-cost, and exciting learning tool. Thank you for your time, and I am now ready to take your questions."

---

## Viva & Defense Cheat Sheet (Anticipated Questions)

| Question from Evaluator | Winning Technical Answer |
| :--- | :--- |
| **"Why use Node.js and Python together instead of just one language?"** | *"Node.js excels at asynchronous I/O, session security, and serving real-time 60 FPS game assets. Python has the native ecosystem for PyMuPDF, AST parsing, and Ollama integration. By isolating Python as a stateless compute engine with zero database credentials, we keep the architecture modular and secure."* |
| **"How does the AST Math Validator prevent code execution attacks?"** | *"We do not use `eval()`. Python's `ast` module parses the mathematical string into an Abstract Syntax Tree. It specifically allows only binary operations (`ast.BinOp`) with addition and subtraction operators and numeric literals. Any function call, variable reference, or malicious syntax is immediately rejected by the parser."* |
| **"Why not let the LLM generate questions live during gameplay?"** | *"Generating a batch on a local 4B model takes approximately 30 seconds. Calling an LLM during active gameplay would freeze the screen and destroy the 60 FPS arcade experience. Pre-generating and caching verified bundles guarantees instantaneous loading."* |
| **"How does the game handle a missing or broken webcam?"** | *"Our `GestureController` class in `gesture.js` detects camera availability and user permissions. If camera access is denied or unavailable, the game immediately switches to keyboard and mouse controls without crashing or interrupting gameplay."* |
| **"How does atomic publishing prevent race conditions?"** | *"We write the compiled questions array to a `.tmp` file first. Once writing and flushing finish, we execute an atomic POSIX `fs.renameSync()`. Because filesystem renames are atomic, a player loading the game at that exact millisecond never reads a half-written or corrupted file."* |

---

## Slide 13: References

### Slide Metadata
- **Slide Number:** 13
- **Slide Type:** Academic & Technical References
- **Visual & Layout Guidance:** Two-column formatted bibliography slide divided into *Research Papers & Technical Standards* and *Frameworks & Documentation*.

### Slide Content (Copy & Paste to PPT)
### References & Citations

#### Research Papers & Academic Literature
1. **MediaPipe Hand Tracking:**  
   Zhang, F., Bazarevsky, V., Vakunov, A., Tkachenka, A., Sung, C., Chang, C. L., & Grundmann, M. (2020). *"MediaPipe Hands: On-device Real-time Hand Tracking."* arXiv preprint arXiv:2006.10214.
2. **Perception Pipelines in Computer Vision:**  
   Lugaresi, C., Tang, J., Nash, H., McClanahan, C., Uboweja, E., Hays, M., ... & Grundmann, M. (2019). *"MediaPipe: A Framework for Building Perception Pipelines."* arXiv preprint arXiv:1906.08172.
3. **Local Large Language Models (Qwen Architecture):**  
   Qwen Team. (2024). *"Qwen2.5 Technical Report: Foundation and Instruction-Tuned Language Models."* Alibaba Group. arXiv preprint arXiv:2412.15115.
4. **LLM Mathematical Verification & Determinism:**  
   Cobbe, K., Kosaraju, V., Bavarian, M., Chen, M., Jun, H., Kaiser, L., ... & Schulman, J. (2021). *"Training Verifiers to Solve Math Word Problems."* arXiv preprint arXiv:2110.14168.
5. **Educational Gamification & Kinesthetic Learning:**  
   Deterding, S., Dixon, D., Khaled, R., & Nacke, L. (2011). *"From game design elements to gamefulness: defining 'gamification'."* In *Proceedings of the 15th International Academic MindTrek Conference*, pp. 9–15. ACM.

#### Technical Frameworks, Standards & Datasets
6. **Abstract Syntax Trees (AST) in Python:**  
   Python Software Foundation. (2024). *"ast — Abstract Syntax Trees (Python Standard Library Specification)."* Python 3.11/3.13 Documentation.
7. **Crest Mathematics Olympiad (CMO) Standard 1 Curriculum:**  
   CREST Olympiads Organization. (2024). *"Syllabus and Sample Question Pattern for Class 1 Mathematics Olympiad."* Official Syllabus Portal.
8. **p5.js Processing Foundation:**  
   McCarthy, L., Reas, C., & Fry, B. (2015). *"p5.js: A JavaScript Library for Creative Coding."* Processing Foundation.
9. **Password Hashing Standard (Argon2id):**  
   Biryukov, A., Dinu, D., & Khovratovich, A. (2016). *"Argon2: New Generation of Memory-Hard Functions for Password Hashing and Proof-of-Work."* RFC 9106, Internet Engineering Task Force (IETF).
10. **FastAPI & Asynchronous Web Services:**  
    Ramírez, S. (2024). *"FastAPI: Modern, High-Performance Web Framework for Python."* Tiangolo Open Source.

### Speaker Presentation Script
> "To conclude our defense, our implementation is grounded in peer-reviewed literature and industrial standards. Our hand gesture tracking is based on Zhang et al.'s MediaPipe research from Google, our language modeling uses the Qwen 2.5 technical architecture from Alibaba, our security adheres to RFC 9106 Argon2id password hashing standards, and our math curriculum directly aligns with the Crest Mathematics Olympiad syllabus. Thank you."

