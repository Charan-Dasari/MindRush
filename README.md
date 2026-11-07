# MindRush — Gesture-Based Arcade & Learning Platform

> **Status: Phase 1 Complete (Shared Engine, Procedural Badges, Balanced Difficulties).**  
> Modernized browser-based game engine deployed with Firebase Hosting support, procedural canvas graphics (p5.js), and future MediaPipe hand tracking.

Welcome to **MindRush** (formerly *Skyfall Gesture Game*), an immersive motion- and gesture-based arcade gaming platform designed for both high-speed arcade action (Fun Mode) and interactive question-answering challenges (Educational Mode). Catch falling collectible badges, avoid hazardous traps, unlock achievements, and climb the leaderboard!

---

## Project Structure

```
MindRush/
├── public/                     # Active client-side web application (Firebase Hosting root)
│   ├── index.html              # Landing / entry page
│   ├── dashboard.html          # Main game hub, profile, leaderboard & achievements
│   ├── game.html               # Configurable shared game engine (Easy, Medium, Hard)
│   ├── game-easy.html          # Legacy Easy difficulty canvas (preserved)
│   ├── game-medium.html        # Legacy Medium difficulty canvas (preserved)
│   ├── game-hard.html          # Legacy Hard difficulty canvas (preserved)
│   ├── login.html              # Authentication sign-in page
│   ├── register.html           # Account registration page
│   ├── forgot-password.html    # Password recovery page
│   ├── about.html              # About page & project origins
│   ├── credits.html            # Credits and team acknowledgments
│   ├── terms.html              # Terms and conditions
│   ├── contact.html            # Contact support page
│   │
│   ├── assets/
│   │   ├── images/             # Game UI images and sprites
│   │   │   └── balls/          # Collectible sprite assets
│   │   └── audio/              # Sound effects and soundtrack
│   │
│   ├── css/
│   │   ├── main.css            # Global application stylesheet and tokens
│   │   └── game.css            # HUD and shared game layout styles
│   │
│   └── js/
│       ├── app.js              # Application entry point
│       └── game/               # Modular game engine
│           ├── engine.js       # Main game loop orchestration
│           ├── difficulty.js   # Difficulty configurations, rules & badge pools
│           ├── objects.js      # Procedural badge rendering, glows & spawner
│           ├── collision.js    # Collision detection & resolution
│           ├── paddle.js       # Player paddle physics & bounds
│           ├── state.js        # Score, lives, achievements & game lifecycle
│           ├── audio.js        # Web Audio API sound management
│           ├── input.js        # Mouse & keyboard controls
│           └── ui.js           # Responsive canvas HUD & overlays
│
├── tests/                      # Automated test suites for difficulty & physics
├── legacy/                     # Archived original Skyfall implementation (reference only)
│   ├── php/                    # Original PHP authentication and MySQL endpoints
│   └── python/                 # Original desktop OpenCV / cvzone gesture tracking
│
├── database/
│   └── project.sql             # Original MySQL database schema and initial data
│
├── docs/                       # Project documentation, reviews, and architecture diagrams
│
├── firebase.json               # Firebase Hosting configuration
├── .firebaserc                 # Firebase project configuration
├── .gitignore                  # Git ignore rules
└── README.md                   # Project documentation
```

---

## Architecture & Migration Roadmap

The application is being migrated from a legacy PHP + XAMPP + Local Python desktop prototype to a modern web platform:

1. **Hosting**: Firebase Hosting
2. **Authentication**: Firebase Authentication (Email/Password, Google Sign-In)
3. **Database**: Cloud Firestore (Realtime high scores, achievements, user profiles)
4. **Gesture Tracking**: MediaPipe Hands via in-browser WebCam (zero local Python/OpenCV installs required)
5. **Game Engine**: Modular ES6 + p5.js physics, procedural badge rendering & sound effects

---

## Legacy Reference

The original desktop prototype files are safely preserved under `legacy/` for reference and verification:
- `legacy/php/`: Legacy session handling, MySQL database queries, and PHPMailer workflows.
- `legacy/python/`: Legacy Python 3 script using `cvzone.HandTrackingModule` and `pyautogui` for desktop input control.
- `database/project.sql`: Original relational table schemas for users, scores, and achievements.

---

Enjoy playing MindRush!
