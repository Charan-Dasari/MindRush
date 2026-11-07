/**
 * MindRush — Educational Invader Game Engine
 * Retro arcade Space Invader mechanic tailored for Std. 1 Maths Olympiad.
 *
 * Core Capabilities & Fixes:
 * - Std. 1 Maths Olympiad question bank (100 verified questions, no repeats before exhaustion)
 * - Space Invader horizontal spaceship controls (bottom lane locked, keyboard & hand gestures, mouse disabled)
 * - Multi-key state capture (keysDown map) with browser scroll prevention (e.preventDefault on Space)
 * - Fully wired UI and Pause manager (pause button, resume, restart, exit, next-level modals)
 * - Clean two-tier HUD layout:
 *     Top Row: Exit button, Mode/Difficulty, Level/Question progress, Score, Camera status, Pause button
 *     Question Area: Dedicated centered HTML panel below top row with Topic badge, Lives hearts, Prominent question text, and Countdown timer bar
 * - Anti-overlap Answer UFO positioning:
 *     Vertical row staggering (Rows at ~190px and ~260px)
 *     Sector-bounded horizontal roaming
 *     Active pairwise collision avoidance / repulsive bouncing (labels NEVER overlap)
 * - Mini-Boss encounters:
 *     Hard: Glider (12 HP, spinning axes)
 *     Insane: Kraken (20 HP, bubble attacks)
 *     Defeat adds +30s EXTRA TIME to question timer; respawns cleanly after exactly 5.0 seconds
 * - Level progression: 5 questions per level, carries over remaining lives, >= 4/5 correct unlocks next tier
 * - Complete freeze prevention: robust state transitions, exception-free game over, cleared projectile queues
 */

import { GameState } from './state.js';
import { AudioManager } from './audio.js';
import { InputManager } from './input.js';
import { UIManager } from './ui.js';
import { GestureController } from './gesture.js';
import {
  EDU_INVADER_CONFIGS,
  getEduInvaderConfig,
  isEduDifficultyUnlocked,
  unlockEduDifficulty,
  checkEduUnlockEligibility
} from './difficulty.js';
import { EDUCATIONAL_QUESTIONS, QuestionDeck } from './educational-questions.js';
import { getScopedStorageKey, submitScoreToServer } from './storage.js';

export class EducationalInvaderEngine {
  constructor(difficultyConfig = {}) {
    const diffKey = (difficultyConfig.id || difficultyConfig.difficulty || 'easy').toLowerCase();
    this.config = getEduInvaderConfig(diffKey);
    this.difficultyKey = this.config.id;

    // Core systems
    this.state = new GameState(this.config.lives);
    this.audio = new AudioManager();
    this.input = new InputManager();
    this.ui = new UIManager();
    this.gesture = new GestureController();

    this.p5Instance = null;
    this.container = null;

    // Multi-key tracking map for fluid, freeze-free movement
    this.keysDown = {};

    // Sprite assets dictionary
    this.sprites = {
      player: null,
      ufo: [],
      laserPlayer: null,
      laserEnemy: null,
      confettiSheet: null,
      smokeSheet: null,
      // Hard mini-boss: Glider + Axes
      bossGlider: null,
      bossGliderAxes: [],
      // Insane mini-boss: Kraken + Bubbles
      bossKraken: [],
      bossKrakenBubbles: [],
      explosions: []
    };

    // Question Bank Manager
    this.deck = new QuestionDeck(difficultyConfig.questions || EDUCATIONAL_QUESTIONS);
    this.currentQuestion = null;

    // Level & Session progression metrics
    this.level = 1;
    this.questionIndex = 0; // 0 to 4 within current level
    this.questionsPerLevel = this.config.questionsPerLevel || 5;
    this.levelCorrectCount = 0;
    this.totalCorrectCount = 0;
    this.totalQuestionsAnswered = 0;

    // Question Timer (in seconds)
    this.questionTimeMax = this.config.timer;
    this.questionTimeRemaining = this.config.timer;
    this.timerTickCounter = 0;

    // Answer UFOs
    this.ufos = [];

    // Entities & Projectiles
    this.playerLasers = [];
    this.enemyLasers = [];
    this.bossProjectiles = [];
    this.confettiEffects = [];
    this.smokeEffects = [];
    this.floatingTexts = [];
    this.stars = [];

    // Mini-Boss state
    this.boss = null;
    this.bossRespawnTimer = 0; // 5-second respawn timer (300 ticks)

    // Player state
    this.player = null;
    this.lastFireTime = 0;
    this.fireCooldown = 200; // ms

    // Control flags
    this.isPaused = false;
    this.feedbackPauseTicks = 0; // brief delay after correct answer
    this.pendingNextQuestion = false;
    this.gameLoopRunning = true;
    this.unlockedNextTier = null;

    // Initialize systems
    this._setupUI();
    this._setupKeyboard();
    this._setupGesture();
  }

  // ==========================================================================
  // UI & BUTTON BINDINGS
  // ==========================================================================

  _setupUI() {
    if (typeof document === 'undefined') return;

    this.ui.bindEvents({
      onResume: () => this.resume(),
      onRestart: () => this.reset(),
      onExit: () => this.exit(),
      onNextLevelYes: () => this.proceedToNextLevel(),
      onNextLevelNo: () => this.declineNextLevel(),
      onTogglePause: () => this.togglePause()
    });

    if (this.input && typeof this.input.onPauseToggle === 'function') {
      this.input.onPauseToggle(() => this.togglePause());
    }

    // Direct header pause button binding fallback
    const headerPauseBtn = document.getElementById('btn-pause-header');
    if (headerPauseBtn) {
      headerPauseBtn.onclick = (e) => {
        e.preventDefault();
        this.togglePause();
      };
    }
  }

  resume() {
    this.isPaused = false;
    if (this.state.isPaused()) {
      this.state.resume();
    }
    this.ui.hidePauseModal();
  }

  pause() {
    this.isPaused = true;
    if (this.state.isPlaying()) {
      this.state.pause();
    }
    this.ui.showPauseModal();
  }

  togglePause() {
    if (this.state.isGameOver()) return;

    if (this.isPaused || this.state.isPaused()) {
      this.resume();
    } else {
      this.pause();
    }
  }

  exit() {
    this.destroy();
    if (typeof window !== 'undefined') {
      window.location.href = 'difficulty-select.html?mode=educational';
    }
  }

  proceedToNextLevel() {
    this.ui.hideNextLevelModal();
    const w = this.container ? this.container.clientWidth || 900 : 900;
    const h = this.container ? this.container.clientHeight || 650 : 650;
    this._advanceToNextLevel(w, h);
  }

  declineNextLevel() {
    this.exit();
  }

  // ==========================================================================
  // INPUT & KEYBOARD HANDLING
  // ==========================================================================

  _setupKeyboard() {
    if (typeof window === 'undefined') return;

    this._keyDownHandler = (e) => {
      this.keysDown[e.code] = true;
      this.keysDown[e.key] = true;

      // Prevent page scrolling on Space and Arrow keys
      if (e.code === 'Space' || e.key === ' ' || e.code === 'KeyK') {
        e.preventDefault();
        if (this.state.isPlaying() && !this.isPaused) {
          this.firePlayerLaser();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
      } else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        this.togglePause();
      }
    };

    this._keyUpHandler = (e) => {
      this.keysDown[e.code] = false;
      this.keysDown[e.key] = false;
    };

    this._blurHandler = () => {
      this.keysDown = {};
    };

    window.addEventListener('keydown', this._keyDownHandler);
    window.addEventListener('keyup', this._keyUpHandler);
    window.addEventListener('blur', this._blurHandler);
  }

  _setupGesture() {
    if (!this.gesture || typeof this.gesture.onUpdate !== 'function') return;

    this.gesture.onUpdate(({ normX, normY, isPinching, isHandPresent }) => {
      if (!isHandPresent || !this.player || !this.state.isPlaying() || this.isPaused) return;

      const canvasWidth = this.container ? this.container.clientWidth || 900 : 900;
      const targetX = normX * canvasWidth - this.player.width / 2;
      this.player.x += (targetX - this.player.x) * 0.35;

      const minX = 15;
      const maxX = canvasWidth - this.player.width - 15;
      this.player.x = Math.max(minX, Math.min(this.player.x, maxX));
      this.player.y = this.player.fixedY;

      if (isPinching) {
        this.firePlayerLaser();
      }
    });
  }

  firePlayerLaser() {
    if (!this.player || !this.state.isPlaying() || this.isPaused) return false;

    const now = Date.now();
    if (now - this.lastFireTime < this.fireCooldown) return false;
    this.lastFireTime = now;

    // Dual laser shot originating from spaceship wings
    const leftX = this.player.x + 8;
    const rightX = this.player.x + this.player.width - 16;
    const laserY = this.player.y - 10;

    this.playerLasers.push({
      x: leftX,
      y: laserY,
      width: 6,
      height: 18,
      vy: -9
    });
    this.playerLasers.push({
      x: rightX,
      y: laserY,
      width: 6,
      height: 18,
      vy: -9
    });

    this.audio.play('paddle');
    return true;
  }

  // ==========================================================================
  // ASSET PRELOAD & SETUP
  // ==========================================================================

  preload(p) {
    if (!p || typeof p.loadImage !== 'function') return;

    try {
      // 1. Player ship & basic lasers
      this.sprites.player = p.loadImage('SpaceShooterGFX/player_ship_blue.png');
      this.sprites.laserPlayer = p.loadImage('SpaceShooterGFX/laser_blue.png');
      this.sprites.laserEnemy = p.loadImage('SpaceShooterGFX/laser_red.png');

      // 2. Roaming Answer UFOs (2 animation frames)
      this.sprites.ufo = [
        p.loadImage('SpaceShooterGFX/enemy_UFO_0.png'),
        p.loadImage('SpaceShooterGFX/enemy_UFO_1.png')
      ];

      // 3. Effects: Confetti burst & grey smoke strip
      this.sprites.confettiSheet = p.loadImage('SpaceShooterGFX/confetti_burst_01.png');
      this.sprites.smokeSheet = p.loadImage('SpaceShooterGFX/explosion-32px_strip10.png');

      // 4. Hard Mode Mini-Boss (Glider + Axes)
      this.sprites.bossGlider = p.loadImage('SpaceShooterGFX/boss_glider.png');
      this.sprites.bossGliderAxes = [
        p.loadImage('SpaceShooterGFX/boss_glider_axe_0.png'),
        p.loadImage('SpaceShooterGFX/boss_glider_axe_1.png')
      ];

      // 5. Insane Mode Mini-Boss (Kraken + Bubbles)
      this.sprites.bossKraken = [
        p.loadImage('SpaceShooterGFX/boss_kraken_0.png'),
        p.loadImage('SpaceShooterGFX/boss_kraken_1.png'),
        p.loadImage('SpaceShooterGFX/boss_kraken_2.png')
      ];
      this.sprites.bossKrakenBubbles = [
        p.loadImage('SpaceShooterGFX/boss_kraken_bubble_0.png'),
        p.loadImage('SpaceShooterGFX/boss_kraken_bubble_1.png'),
        p.loadImage('SpaceShooterGFX/boss_kraken_bubble_2.png')
      ];

      // 6. Generic explosion frames
      this.sprites.explosions = [];
      for (let i = 0; i <= 6; i++) {
        this.sprites.explosions.push(p.loadImage(`SpaceShooterGFX/explosion_${i}.png`));
      }
    } catch (e) {
      console.warn('[EducationalInvaderEngine] Asset preloading warning:', e);
    }
  }

  setup(p) {
    if (!p) return;
    const w = this.container ? this.container.clientWidth || 900 : 900;
    const h = this.container ? this.container.clientHeight || 650 : 650;
    p.createCanvas(w, h);
    p.frameRate(60);

    // Cosmic background starfield
    this._initStars(w, h);

    // Player spaceship locked to bottom horizontal line
    this._initPlayer(w, h);

    // Initial question & Answer UFO fleet
    this._loadNextQuestion(w, h);

    // Spawn Boss if configured for difficulty
    if (this.config.hasBoss) {
      this._spawnBoss(w, h);
    }

    // Dismiss loading overlay
    this._dismissLoadingScreen();
    this._updateHUD();
  }

  _initStars(w, h) {
    this.stars = [];
    const count = 75;
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 0.3 + Math.random() * 0.9,
        size: Math.random() < 0.25 ? 2.5 : 1.5,
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }

  _initPlayer(w, h) {
    const shipW = 44;
    const shipH = 44;
    const fixedY = h - shipH - 45; // strictly constant bottom lane
    this.player = {
      x: w / 2 - shipW / 2,
      y: fixedY,
      fixedY: fixedY,
      width: shipW,
      height: shipH,
      vx: 0,
      speed: 7.5,
      invulnerableTicks: 0
    };
  }

  _dismissLoadingScreen() {
    if (typeof document === 'undefined') return;
    const loadingScreen = document.getElementById('p5_loading');
    if (loadingScreen) {
      loadingScreen.style.opacity = '0';
      loadingScreen.style.pointerEvents = 'none';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 350);
    }
  }

  // ==========================================================================
  // QUESTION MANAGEMENT & ANTI-OVERLAP UFO SPAWNING
  // ==========================================================================

  _loadNextQuestion(w = 900, h = 650) {
    this.currentQuestion = this.deck.drawNextQuestion();
    this.questionTimeRemaining = this.config.timer;
    this.timerTickCounter = 0;
    this.pendingNextQuestion = false;

    // Clear lingering lasers so they don't immediately hit newly spawned UFOs
    this.playerLasers = [];

    // Spawn 4 Answer UFOs with guaranteed anti-overlap spacing
    this._spawnAnswerUFOs(w, h);
    this._updateHUD();
  }

  _spawnAnswerUFOs(w, h) {
    this.ufos = [];
    if (!this.currentQuestion || !Array.isArray(this.currentQuestion.shuffledOptions)) {
      return;
    }

    const options = this.currentQuestion.shuffledOptions;
    const ufoCount = options.length;

    // UFO area starts strictly below HUD (Y >= 180px)
    // Row 0 (Upper row): Y = 190px (UFO 0, 2)
    // Row 1 (Lower row): Y = 260px (UFO 1, 3) - 70px vertical difference prevents horizontal badge collisions
    const rowY = [190, 260, 190, 260];

    // Divide horizontal space into 4 dedicated non-overlapping sectors
    const sideMargin = 60;
    const availableWidth = w - sideMargin * 2;
    const sectorWidth = availableWidth / ufoCount;

    for (let i = 0; i < ufoCount; i++) {
      const opt = options[i];
      const isCorrect = String(opt).trim() === String(this.currentQuestion.correctAnswer).trim();

      // Estimate badge width based on text length (char count * 9 + 26px padding, minimum 70px)
      const badgeW = Math.max(70, String(opt).length * 9 + 28);
      const badgeH = 24;

      const sectorCenter = sideMargin + i * sectorWidth + sectorWidth / 2;
      const initialX = sectorCenter - 22; // centered in sector
      const initialY = rowY[i % rowY.length];
      const dir = (i % 2 === 0 ? 1 : -1);

      this.ufos.push({
        id: `ufo_${i}`,
        index: i,
        option: String(opt),
        isCorrect: isCorrect,
        x: initialX,
        y: initialY,
        baseY: initialY,
        width: 44,
        height: 44,
        vx: dir * (this.config.ufoSpeed || 1.8),
        phase: i * (Math.PI / 2),
        isAlive: true,
        respawnTimer: 0,
        badgeW: badgeW,
        badgeH: badgeH,
        // Patrol bounds within this UFO's sector to prevent crowding
        sectorCenter: sectorCenter,
        patrolMinX: Math.max(25, sectorCenter - sectorWidth * 0.42),
        patrolMaxX: Math.min(w - 65, sectorCenter + sectorWidth * 0.42)
      });
    }
  }

  // ==========================================================================
  // MINI-BOSS MANAGEMENT (GLIDER & KRAKEN)
  // ==========================================================================

  _spawnBoss(w, h) {
    if (this.boss) return; // Prevent duplicate boss

    const bossType = this.config.bossType; // 'glider' or 'kraken'
    const hp = this.config.bossHp || (bossType === 'kraken' ? 20 : 12);

    this.boss = {
      type: bossType,
      name: bossType === 'kraken' ? 'Kraken Flagship' : 'Glider Mini-Boss',
      x: w / 2 - 32,
      y: 135, // Positioned in upper airspace safely between HUD and Answer UFOs
      width: 64,
      height: 64,
      hp: hp,
      maxHp: hp,
      vx: bossType === 'kraken' ? 2.2 : 1.8,
      attackCooldown: 60,
      attackInterval: this.config.bossAttackInterval || 90,
      hitFlashTicks: 0,
      animFrame: 0,
      animTicks: 0
    };
  }

  _updateBoss(w, h) {
    // Respawn timer countdown if boss was defeated
    if (!this.boss && this.config.hasBoss) {
      if (this.bossRespawnTimer > 0) {
        this.bossRespawnTimer--;
        if (this.bossRespawnTimer === 0) {
          // Exactly 5 seconds elapsed -> respawn boss cleanly without resetting state
          this._spawnBoss(w, h);
          this.floatingTexts.push({
            text: `⚠️ ${this.config.bossType === 'kraken' ? 'KRAKEN' : 'GLIDER'} RE-ENGAGED!`,
            x: w / 2,
            y: 160,
            color: [255, 100, 100],
            alpha: 255,
            vy: -0.6
          });
        }
      }
      return;
    }

    if (!this.boss) return;

    // Movement: smooth roaming in upper playfield
    this.boss.x += this.boss.vx;
    if (this.boss.x <= 40) {
      this.boss.x = 40;
      this.boss.vx = Math.abs(this.boss.vx);
    } else if (this.boss.x >= w - this.boss.width - 40) {
      this.boss.x = w - this.boss.width - 40;
      this.boss.vx = -Math.abs(this.boss.vx);
    }

    // Animation frame cycling
    this.boss.animTicks++;
    if (this.boss.animTicks % 15 === 0) {
      this.boss.animFrame = (this.boss.animFrame + 1) % 3;
    }

    if (this.boss.hitFlashTicks > 0) {
      this.boss.hitFlashTicks--;
    }

    // Boss projectile attacks
    this.boss.attackCooldown--;
    if (this.boss.attackCooldown <= 0) {
      this.boss.attackCooldown = this.boss.attackInterval;
      this._fireBossProjectile();
    }
  }

  _fireBossProjectile() {
    if (!this.boss) return;
    const originX = this.boss.x + this.boss.width / 2;
    const originY = this.boss.y + this.boss.height;

    if (this.boss.type === 'glider') {
      // Glider throws spinning axes
      this.bossProjectiles.push({
        type: 'axe',
        x: originX - 12,
        y: originY,
        width: 24,
        height: 24,
        vy: 4.2,
        rotation: 0,
        rotSpeed: 0.22,
        spriteIndex: 0
      });
    } else {
      // Kraken fires bubble projectiles
      this.bossProjectiles.push({
        type: 'bubble',
        x: originX - 12,
        y: originY,
        width: 24,
        height: 24,
        vy: 4.8,
        vx: (Math.random() - 0.5) * 1.5,
        animFrame: 0,
        ticks: 0
      });
    }
  }

  // ==========================================================================
  // GAME LOOP & UPDATES
  // ==========================================================================

  update(w, h) {
    if (this.isPaused || !this.state.isPlaying()) return;

    // 1. Question Countdown Timer
    this._updateTimer(w, h);

    // 2. Spaceship Movement
    this._updatePlayer(w, h);

    // 3. Answer UFOs with collision avoidance & anti-overlap repulsion
    this._updateUFOs(w, h);

    // 4. Mini-Boss update & attacks
    if (this.config.hasBoss) {
      this._updateBoss(w, h);
    }

    // 5. Hostile UFO Fire (Medium, Hard, Insane)
    if (this.config.hasHostileFire) {
      this._updateHostileFire(w, h);
    }

    // 6. Projectiles
    this._updateProjectiles(w, h);

    // 7. Collisions
    this._handleCollisions(w, h);

    // 8. Visual Effects (Confetti & Smoke)
    this._updateEffects();

    // 9. Feedback delay for advancing to next question
    if (this.feedbackPauseTicks > 0) {
      this.feedbackPauseTicks--;
      if (this.feedbackPauseTicks === 0 && this.pendingNextQuestion) {
        this.pendingNextQuestion = false;
        this._loadNextQuestion(w, h);
      }
    }
  }

  _updateTimer(w, h) {
    if (this.feedbackPauseTicks > 0) return; // Freeze timer during victory feedback

    this.timerTickCounter++;
    if (this.timerTickCounter >= 60) {
      this.timerTickCounter = 0;
      this.questionTimeRemaining = Math.max(0, this.questionTimeRemaining - 1);
      this._updateHUDTimer();

      // Timer Expiry: deduct 1 life and reset timer for the same question
      if (this.questionTimeRemaining === 0) {
        this._handleTimerExpiry(w, h);
      }
    }
  }

  _handleTimerExpiry(w, h) {
    this.audio.play('redBall');
    this.state.modifyLives(-1);
    this.totalQuestionsAnswered++;

    this.floatingTexts.push({
      text: '⏱️ TIME UP! -1 LIFE',
      x: w / 2,
      y: 220,
      color: [244, 63, 94],
      alpha: 255,
      vy: -0.7
    });

    this._updateHUD();

    if (this.state.lives <= 0) {
      this._triggerGameOver();
    } else {
      // Reset timer so student can keep solving the active question
      this.questionTimeRemaining = this.config.timer;
      this.timerTickCounter = 0;
      this._updateHUDTimer();
    }
  }

  _updatePlayer(w, h) {
    if (!this.player) return;

    // Keyboard movement from multi-key map
    let moveX = 0;
    if (this.keysDown['ArrowLeft'] || this.keysDown['KeyA'] || this.keysDown['a'] || this.keysDown['A']) moveX -= 1;
    if (this.keysDown['ArrowRight'] || this.keysDown['KeyD'] || this.keysDown['d'] || this.keysDown['D']) moveX += 1;

    this.player.x += moveX * this.player.speed;

    // Strict boundary clamping
    const minX = 15;
    const maxX = w - this.player.width - 15;
    this.player.x = Math.max(minX, Math.min(this.player.x, maxX));

    // STRICT LOCK: Y coordinate is constant, cannot move up or down!
    this.player.y = this.player.fixedY;

    // Invulnerability flashing countdown
    if (this.player.invulnerableTicks > 0) {
      this.player.invulnerableTicks--;
    }
  }

  _updateUFOs(w, h) {
    // Phase 1: Update individual UFO position within sector
    for (const ufo of this.ufos) {
      if (!ufo.isAlive) {
        if (ufo.respawnTimer > 0) {
          ufo.respawnTimer--;
          if (ufo.respawnTimer === 0) {
            ufo.isAlive = true;
          }
        }
        continue;
      }

      // Horizontal roaming movement within sector
      ufo.x += ufo.vx;

      // Soft bounce at sector boundaries
      if (ufo.x <= ufo.patrolMinX) {
        ufo.x = ufo.patrolMinX;
        ufo.vx = Math.abs(ufo.vx);
      } else if (ufo.x >= ufo.patrolMaxX) {
        ufo.x = ufo.patrolMaxX;
        ufo.vx = -Math.abs(ufo.vx);
      }

      // Smooth floating bob
      ufo.phase += 0.04;
      ufo.y = ufo.baseY + Math.sin(ufo.phase) * 8;
    }

    // Phase 2: Active Pairwise Collision Avoidance / Repulsion
    // Ensures answer labels NEVER overlap horizontally when on same or nearby row
    for (let i = 0; i < this.ufos.length; i++) {
      const ufoA = this.ufos[i];
      if (!ufoA.isAlive) continue;

      for (let j = i + 1; j < this.ufos.length; j++) {
        const ufoB = this.ufos[j];
        if (!ufoB.isAlive) continue;

        const dy = Math.abs(ufoA.y - ufoB.y);
        // If UFOs are vertically close (less than 45px vertical gap)
        if (dy < 45) {
          const dx = ufoB.x - ufoA.x;
          const minSafeX = (ufoA.badgeW + ufoB.badgeW) / 2 + 18;

          if (Math.abs(dx) < minSafeX) {
            // Overlap hazard detected: bounce velocities away
            if (dx > 0) {
              ufoA.vx = -Math.abs(ufoA.vx);
              ufoB.vx = Math.abs(ufoB.vx);
            } else {
              ufoA.vx = Math.abs(ufoA.vx);
              ufoB.vx = -Math.abs(ufoB.vx);
            }

            // Immediately apply repulsive push to maintain separation
            const overlap = minSafeX - Math.abs(dx);
            const push = overlap / 2 + 1;
            if (dx >= 0) {
              ufoA.x = Math.max(15, ufoA.x - push);
              ufoB.x = Math.min(w - ufoB.width - 15, ufoB.x + push);
            } else {
              ufoA.x = Math.min(w - ufoA.width - 15, ufoA.x + push);
              ufoB.x = Math.max(15, ufoB.x - push);
            }
          }
        }
      }
    }
  }

  _updateHostileFire(w, h) {
    if (this.feedbackPauseTicks > 0) return;

    const aliveUFOs = this.ufos.filter(u => u.isAlive);
    if (aliveUFOs.length === 0) return;

    const chance = 1 / (this.config.attackInterval || 120);
    if (Math.random() < chance) {
      const shooter = aliveUFOs[Math.floor(Math.random() * aliveUFOs.length)];
      this.enemyLasers.push({
        x: shooter.x + shooter.width / 2 - 3,
        y: shooter.y + shooter.height,
        width: 6,
        height: 16,
        vy: 5.2
      });
    }
  }

  _updateProjectiles(w, h) {
    // 1. Player lasers
    for (let i = this.playerLasers.length - 1; i >= 0; i--) {
      if (i >= this.playerLasers.length) continue;
      const l = this.playerLasers[i];
      if (!l || typeof l.y !== 'number') continue;
      l.y += (l.vy || -9);
      if (l.y < -20) {
        this.playerLasers.splice(i, 1);
      }
    }

    // 2. Enemy lasers
    for (let i = this.enemyLasers.length - 1; i >= 0; i--) {
      if (i >= this.enemyLasers.length) continue;
      const l = this.enemyLasers[i];
      if (!l || typeof l.y !== 'number') continue;
      l.y += (l.vy || 5.2);
      if (l.y > h + 20) {
        this.enemyLasers.splice(i, 1);
      }
    }

    // 3. Boss projectiles (axes or bubbles)
    for (let i = this.bossProjectiles.length - 1; i >= 0; i--) {
      if (i >= this.bossProjectiles.length) continue;
      const p = this.bossProjectiles[i];
      if (!p || typeof p.y !== 'number') continue;
      p.y += (p.vy || 4.2);
      if (p.vx) p.x += p.vx;
      if (p.type === 'axe') {
        p.rotation = (p.rotation || 0) + (p.rotSpeed || 0.22);
        p.spriteIndex = ((p.spriteIndex || 0) + 1) % 2;
      } else if (p.type === 'bubble') {
        p.ticks = (p.ticks || 0) + 1;
        if (p.ticks % 10 === 0) {
          p.animFrame = ((p.animFrame || 0) + 1) % 3;
        }
      }

      if (p.y > h + 30 || p.x < -30 || p.x > w + 30) {
        this.bossProjectiles.splice(i, 1);
      }
    }
  }

  // ==========================================================================
  // COLLISIONS & HIT RESOLUTIONS
  // ==========================================================================

  _handleCollisions(w, h) {
    if (!this.player || !this.state.isPlaying() || this.isPaused || this.feedbackPauseTicks > 0) return;

    // A. Player Lasers vs Answer UFOs & Mini-Boss
    for (let li = this.playerLasers.length - 1; li >= 0; li--) {
      // If lasers were cleared or question transition started, stop immediately
      if (this.feedbackPauseTicks > 0 || this.playerLasers.length === 0) {
        break;
      }
      if (li >= this.playerLasers.length) {
        continue;
      }

      const laser = this.playerLasers[li];
      if (!laser || typeof laser.x !== 'number' || typeof laser.y !== 'number') {
        continue;
      }

      let laserUsed = false;

      // 1. Check against UFOs
      for (let ui = 0; ui < this.ufos.length; ui++) {
        const ufo = this.ufos[ui];
        if (!ufo || !ufo.isAlive || typeof ufo.x !== 'number' || typeof ufo.y !== 'number') {
          continue;
        }

        // Expanded hitbox matching UFO sprite + badge
        const badgeHalfW = (ufo.badgeW || 70) / 2;
        const ufoW = ufo.width || 44;
        const ufoH = ufo.height || 44;
        const badgeH = ufo.badgeH || 24;
        const ufoCenterX = ufo.x + ufoW / 2;
        const hitLeft = Math.min(ufo.x - 4, ufoCenterX - badgeHalfW);
        const hitRight = Math.max(ufo.x + ufoW + 4, ufoCenterX + badgeHalfW);
        const hitTop = ufo.y;
        const hitBottom = ufo.y + ufoH + badgeH + 8;

        const hit =
          laser.x + (laser.width || 6) >= hitLeft &&
          laser.x <= hitRight &&
          laser.y <= hitBottom &&
          laser.y + (laser.height || 18) >= hitTop;

        if (hit) {
          laserUsed = true;
          this.playerLasers.splice(li, 1);
          const wasCorrect = ufo.isCorrect;
          this._resolveAnswerHit(ufo, w, h);

          // If correct answer hit, feedbackPauseTicks is activated and all playerLasers
          // are cleared. Exit collision processing immediately to prevent stale laser checks.
          if (wasCorrect || this.feedbackPauseTicks > 0 || this.playerLasers.length === 0) {
            return;
          }
          break; // Incorrect answer: break UFO loop for this laser
        }
      }

      if (laserUsed) continue;

      // 2. Check against Mini-Boss
      if (this.boss && typeof this.boss.x === 'number' && typeof this.boss.y === 'number') {
        const bossHit =
          laser.x + (laser.width || 6) >= this.boss.x &&
          laser.x <= this.boss.x + (this.boss.width || 64) &&
          laser.y <= this.boss.y + (this.boss.height || 64) &&
          laser.y + (laser.height || 18) >= this.boss.y;

        if (bossHit) {
          this.playerLasers.splice(li, 1);
          this._resolveBossHit(w, h);
          continue;
        }
      }
    }

    // B. Hostile Projectiles vs Player Spaceship
    if (this.player && typeof this.player.x === 'number' && typeof this.player.y === 'number' && this.player.invulnerableTicks <= 0) {
      const pW = this.player.width || 44;
      const pH = this.player.height || 44;
      const pLeft = this.player.x + 6;
      const pRight = this.player.x + pW - 6;
      const pTop = this.player.y + 6;
      const pBottom = this.player.y + pH - 6;

      // 1. Enemy Lasers
      for (let i = this.enemyLasers.length - 1; i >= 0; i--) {
        if (i >= this.enemyLasers.length) continue;
        const el = this.enemyLasers[i];
        if (!el || typeof el.x !== 'number' || typeof el.y !== 'number') continue;

        if (
          el.x + (el.width || 6) >= pLeft &&
          el.x <= pRight &&
          el.y + (el.height || 16) >= pTop &&
          el.y <= pBottom
        ) {
          this.enemyLasers.splice(i, 1);
          this._damagePlayer(w, h, 'LASER STRIKE');
          break;
        }
      }

      // 2. Boss Projectiles
      if (this.player && this.player.invulnerableTicks <= 0) {
        for (let i = this.bossProjectiles.length - 1; i >= 0; i--) {
          if (i >= this.bossProjectiles.length) continue;
          const bp = this.bossProjectiles[i];
          if (!bp || typeof bp.x !== 'number' || typeof bp.y !== 'number') continue;

          if (
            bp.x + (bp.width || 24) >= pLeft &&
            bp.x <= pRight &&
            bp.y + (bp.height || 24) >= pTop &&
            bp.y <= pBottom
          ) {
            this.bossProjectiles.splice(i, 1);
            this._damagePlayer(w, h, bp.type === 'axe' ? 'AXE IMPACT' : 'BUBBLE BURST');
            break;
          }
        }
      }
    }
  }

  _resolveAnswerHit(ufo, w, h) {
    if (ufo.isCorrect) {
      // -------------------------------------------------------------
      // CORRECT ANSWER HIT!
      // -------------------------------------------------------------
      ufo.isAlive = false;
      this.audio.play('levelUp');

      // Clear any in-flight player lasers so they don't immediately hit the next question's UFOs
      this.playerLasers = [];

      // Trigger colorful Confetti Burst animation (35 frames)
      this.confettiEffects.push({
        x: ufo.x + ufo.width / 2,
        y: ufo.y + ufo.height / 2,
        frame: 0,
        maxFrames: 35,
        width: 140,
        height: 140
      });

      // Award points
      const pts = this.config.pointsPerCorrect || 100;
      this.state.addScore(pts);
      this.levelCorrectCount++;
      this.totalCorrectCount++;
      this.totalQuestionsAnswered++;

      this.floatingTexts.push({
        text: `CORRECT! +${pts} PTS 🎉`,
        x: ufo.x + ufo.width / 2,
        y: ufo.y - 12,
        color: [52, 211, 153],
        alpha: 255,
        vy: -0.8
      });

      this._updateHUD();

      // Feedback pause to celebrate confetti
      this.feedbackPauseTicks = 45; // ~0.75s
      this.questionIndex++;

      if (this.questionIndex >= this.questionsPerLevel) {
        // Level complete!
        this.pendingNextQuestion = false;
        setTimeout(() => this._triggerLevelComplete(w, h), 700);
      } else {
        this.pendingNextQuestion = true;
      }
    } else {
      // -------------------------------------------------------------
      // INCORRECT ANSWER HIT!
      // -------------------------------------------------------------
      ufo.isAlive = false;
      ufo.respawnTimer = 90; // Respawn after 1.5 seconds so student can retry
      this.audio.play('redBall');

      // Trigger Grey Smoke Puff (frames 5-9 of explosion-32px_strip10.png, zero orange fire)
      this.smokeEffects.push({
        x: ufo.x + ufo.width / 2,
        y: ufo.y + ufo.height / 2,
        startFrame: 5,
        endFrame: 9,
        currentProgress: 0,
        durationTicks: 30,
        width: 70,
        height: 70
      });

      // Deduct 1 life penalty
      this.state.modifyLives(-1);
      this.totalQuestionsAnswered++;

      this.floatingTexts.push({
        text: 'INCORRECT! -1 LIFE ⚠️',
        x: ufo.x + ufo.width / 2,
        y: ufo.y - 12,
        color: [244, 63, 94],
        alpha: 255,
        vy: -0.8
      });

      this._updateHUD();

      if (this.state.lives <= 0) {
        this._triggerGameOver();
      }
      // Note: Question remains active!
    }
  }

  _resolveBossHit(w, h) {
    if (!this.boss) return;

    this.boss.hp--;
    this.boss.hitFlashTicks = 8;
    this.audio.play('paddle');

    if (this.boss.hp <= 0) {
      // MINI-BOSS DEFEATED!
      const bonusScore = this.boss.type === 'kraken' ? 500 : 300;
      this.state.addScore(bonusScore);
      this.audio.play('goldenBall');

      // Add +30 SECONDS to active question timer!
      this.questionTimeRemaining += 30;
      this._updateHUDTimer();

      // Large explosion
      this.confettiEffects.push({
        x: this.boss.x + this.boss.width / 2,
        y: this.boss.y + this.boss.height / 2,
        frame: 0,
        maxFrames: 35,
        width: 180,
        height: 180
      });

      this.floatingTexts.push({
        text: `BOSS DESTROYED! +30s TIME BONUS ⏱️✨`,
        x: w / 2,
        y: 150,
        color: [250, 204, 21],
        alpha: 255,
        vy: -0.6
      });

      this.boss = null;
      // Exact 5-second respawn timer (5.0s * 60fps = 300 ticks)
      this.bossRespawnTimer = 300;
      this._updateHUD();
    }
  }

  _damagePlayer(w, h, reason = 'HIT') {
    this.state.modifyLives(-1);
    this.player.invulnerableTicks = 60; // 1-second invulnerability
    this.audio.play('losePoints');

    this.floatingTexts.push({
      text: `${reason} -1 LIFE`,
      x: this.player.x + this.player.width / 2,
      y: this.player.y - 20,
      color: [244, 63, 94],
      alpha: 255,
      vy: -0.8
    });

    this._updateHUD();

    if (this.state.lives <= 0) {
      this._triggerGameOver();
    }
  }

  // ==========================================================================
  // PROGRESSION, LEVEL ADVANCE & GAME OVER
  // ==========================================================================

  _triggerLevelComplete(w, h) {
    this.isPaused = true;
    this.audio.play('levelUp');

    // Check if player unlocks next difficulty tier (requires >= 4 of 5 correct)
    const unlockedTier = checkEduUnlockEligibility(
      this.difficultyKey,
      this.levelCorrectCount,
      this.questionsPerLevel
    );
    this.unlockedNextTier = unlockedTier;

    let unlockText = '';
    if (unlockedTier) {
      unlockText = `🔓 PROMOTED! You unlocked ${unlockedTier.toUpperCase()} Difficulty!`;
    }

    const message = `Great job! You answered ${this.levelCorrectCount} / ${this.questionsPerLevel} questions correctly. Remaining Lives: ${this.state.lives} carried over! ${unlockText}`;

    // Display modal via standard UIManager
    this.ui.showNextLevelModal(message);
  }

  _advanceToNextLevel(w, h) {
    this.level++;
    this.questionIndex = 0;
    this.levelCorrectCount = 0;
    this.isPaused = false;
    this.feedbackPauseTicks = 0;
    this.pendingNextQuestion = false;

    // Respawn boss if applicable
    if (this.config.hasBoss && !this.boss) {
      this._spawnBoss(w, h);
    }

    this._loadNextQuestion(w, h);
  }

  _triggerGameOver() {
    this.state.setGameOver();
    this.isPaused = true;
    this.audio.play('gameOver');

    // Submit score under category 'educational'
    try {
      submitScoreToServer({
        score: this.state.score,
        mode: 'educational',
        difficulty: this.difficultyKey,
        level: this.level,
        questionsCorrect: this.totalCorrectCount,
        questionsTotal: this.totalQuestionsAnswered
      });
    } catch (e) {
      console.warn('[EducationalInvaderEngine] Score submit error:', e);
    }

    // Display Game Over modal via standard UIManager
    this.ui.showGameOverModal(this.state.score);
  }

  reset() {
    this.ui.hideAllModals();
    this.state.reset();
    this.state.lives = this.config.lives;
    this.level = 1;
    this.questionIndex = 0;
    this.levelCorrectCount = 0;
    this.totalCorrectCount = 0;
    this.totalQuestionsAnswered = 0;
    this.deck.reset();
    this.playerLasers = [];
    this.enemyLasers = [];
    this.bossProjectiles = [];
    this.confettiEffects = [];
    this.smokeEffects = [];
    this.floatingTexts = [];
    this.isPaused = false;
    this.feedbackPauseTicks = 0;
    this.pendingNextQuestion = false;
    this.boss = null;
    this.bossRespawnTimer = 0;

    const w = this.container ? this.container.clientWidth || 900 : 900;
    const h = this.container ? this.container.clientHeight || 650 : 650;

    this._initPlayer(w, h);
    this._loadNextQuestion(w, h);
    if (this.config.hasBoss) {
      this._spawnBoss(w, h);
    }
    this._updateHUD();
  }

  // ==========================================================================
  // HUD & UI SYNCHRONIZATION
  // ==========================================================================

  _updateHUD() {
    if (typeof document === 'undefined') return;

    // 1. Top row: Score
    const scoreEl = document.getElementById('hud-score-val');
    if (scoreEl) scoreEl.textContent = this.state.score.toLocaleString();

    // 2. Top row: Mode & Difficulty
    const diffEl = document.getElementById('hud-diff-name');
    if (diffEl) {
      diffEl.textContent = `STD. 1 MATHS • ${this.config.name.toUpperCase()}`;
    }

    // 3. Top row: Progress pill
    const progressTag = document.getElementById('hud-progress-tag');
    const progressVal = document.getElementById('hud-progress-val');
    if (progressTag) progressTag.classList.remove('hidden');
    if (progressVal) {
      progressVal.textContent = `LVL ${this.level} • Q ${this.questionIndex + 1}/${this.questionsPerLevel}`;
    }

    // 4. Dedicated Centered Question Panel
    const eduContainer = document.getElementById('edu-hud-container');
    if (eduContainer) eduContainer.classList.remove('hidden');

    const topicBadge = document.getElementById('edu-topic-badge');
    if (topicBadge && this.currentQuestion) {
      topicBadge.textContent = this.currentQuestion.topic || 'MATHS';
    }

    const heartsEl = document.getElementById('edu-lives-hearts');
    if (heartsEl) {
      let hearts = '';
      for (let i = 0; i < this.state.lives; i++) hearts += '❤️';
      heartsEl.textContent = hearts;
    }

    const questionEl = document.getElementById('edu-hud-question-text');
    if (questionEl && this.currentQuestion) {
      questionEl.textContent = this.currentQuestion.question;
    }

    this._updateHUDTimer();
  }

  _updateHUDTimer() {
    if (typeof document === 'undefined') return;

    // Timer seconds countdown text
    const timerLabel = document.getElementById('edu-timer-label');
    if (timerLabel) {
      timerLabel.textContent = `⏱️ ${this.questionTimeRemaining}s`;
    }

    // Timer progress bar fill
    const timerBar = document.getElementById('edu-hud-timer-bar');
    if (timerBar) {
      const pct = Math.max(0, Math.min(100, (this.questionTimeRemaining / this.questionTimeMax) * 100));
      timerBar.style.width = `${pct}%`;
      if (pct > 50) timerBar.style.backgroundColor = 'var(--accent-green, #10B981)';
      else if (pct > 25) timerBar.style.backgroundColor = 'var(--gold, #FACC15)';
      else timerBar.style.backgroundColor = 'var(--danger, #EF4444)';
    }
  }

  _updateEffects() {
    // Confetti
    for (let i = this.confettiEffects.length - 1; i >= 0; i--) {
      const eff = this.confettiEffects[i];
      eff.frame++;
      if (eff.frame >= eff.maxFrames) {
        this.confettiEffects.splice(i, 1);
      }
    }

    // Smoke
    for (let i = this.smokeEffects.length - 1; i >= 0; i--) {
      const eff = this.smokeEffects[i];
      eff.currentProgress += 1 / eff.durationTicks;
      if (eff.currentProgress >= 1.0) {
        this.smokeEffects.splice(i, 1);
      }
    }

    // Floating text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 3;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  // ==========================================================================
  // RENDERING PIPELINE (P5.JS)
  // ==========================================================================

  draw(p) {
    if (!p) return;
    const w = p.width;
    const h = p.height;

    // Update game logic
    this.update(w, h);

    // Deep cosmic background
    p.background(7, 9, 15);

    // Starfield
    p.push();
    p.noStroke();
    for (const star of this.stars) {
      star.y += star.speed;
      if (star.y > h) {
        star.y = 0;
        star.x = Math.random() * w;
      }
      star.twinkle += 0.05;
      const alpha = 160 + Math.sin(star.twinkle) * 90;
      p.fill(220, 235, 255, alpha);
      p.ellipse(star.x, star.y, star.size, star.size);
    }
    p.pop();

    // Render Mini-Boss (roaming below HUD and above answer UFOs)
    if (this.boss) {
      this._drawBoss(p);
    }

    // Render Answer UFOs with distinct, non-overlapping text badges
    this._drawAnswerUFOs(p);

    // Render Lasers & Projectiles
    this._drawProjectiles(p);

    // Render Player Spaceship (with invulnerability flash)
    this._drawPlayer(p);

    // Render Confetti & Smoke effects
    this._drawEffects(p);

    // Render Floating Text
    this._drawFloatingTexts(p);
  }

  _drawAnswerUFOs(p) {
    p.push();
    for (const ufo of this.ufos) {
      if (!ufo.isAlive) continue;

      // Draw UFO Sprite (or crisp vector fallback)
      const ufoImg = this.sprites.ufo[ufo.phase % 2 > 1 ? 1 : 0];
      if (ufoImg && ufoImg.width) {
        p.image(ufoImg, ufo.x, ufo.y, ufo.width, ufo.height);
      } else {
        // Fallback vector UFO
        p.noStroke();
        p.fill(0, 210, 255);
        p.ellipse(ufo.x + ufo.width / 2, ufo.y + ufo.height / 2, ufo.width, ufo.height * 0.6);
        p.fill(255, 255, 255, 180);
        p.ellipse(ufo.x + ufo.width / 2, ufo.y + ufo.height * 0.35, ufo.width * 0.45, ufo.height * 0.35);
      }

      // High-Contrast Option Text Badge Pill
      const dynamicBadgeW = Math.max(ufo.badgeW, p.textWidth(ufo.option) + 26);
      const badgeH = 24;
      const badgeX = ufo.x + ufo.width / 2 - dynamicBadgeW / 2;
      const badgeY = ufo.y + ufo.height + 4;

      // Outer glow and border
      p.fill(15, 23, 42, 245);
      p.stroke(56, 189, 248);
      p.strokeWeight(1.8);
      p.rect(badgeX, badgeY, dynamicBadgeW, badgeH, 8);

      // Answer Option text
      p.noStroke();
      p.fill(255, 255, 255);
      p.textFont('monospace');
      p.textSize(13);
      p.textStyle(p.BOLD);
      p.textAlign(p.CENTER, p.CENTER);
      p.text(ufo.option, badgeX + dynamicBadgeW / 2, badgeY + badgeH / 2);
    }
    p.pop();
  }

  _drawBoss(p) {
    if (!this.boss) return;
    p.push();

    // Flash white on hit
    if (this.boss.hitFlashTicks > 0) {
      p.tint(255, 120, 120);
    }

    if (this.boss.type === 'glider') {
      const img = this.sprites.bossGlider;
      if (img && img.width) {
        p.image(img, this.boss.x, this.boss.y, this.boss.width, this.boss.height);
      } else {
        p.fill(250, 204, 21);
        p.rect(this.boss.x, this.boss.y, this.boss.width, this.boss.height, 12);
      }
    } else {
      const frames = this.sprites.bossKraken;
      const img = frames[this.boss.animFrame % frames.length];
      if (img && img.width) {
        p.image(img, this.boss.x, this.boss.y, this.boss.width, this.boss.height);
      } else {
        p.fill(239, 68, 68);
        p.rect(this.boss.x, this.boss.y, this.boss.width, this.boss.height, 12);
      }
    }
    p.noTint();

    // Boss Health Bar
    const barW = this.boss.width + 20;
    const barH = 7;
    const barX = this.boss.x - 10;
    const barY = this.boss.y - 12;

    p.fill(17, 24, 39, 200);
    p.stroke(55, 65, 81);
    p.strokeWeight(1);
    p.rect(barX, barY, barW, barH, 4);

    const hpPct = Math.max(0, this.boss.hp / this.boss.maxHp);
    p.noStroke();
    p.fill(239, 68, 68);
    p.rect(barX + 1, barY + 1, (barW - 2) * hpPct, barH - 2, 3);

    p.pop();
  }

  _drawProjectiles(p) {
    p.push();

    // 1. Player Lasers
    for (const l of this.playerLasers) {
      if (!l || typeof l.x !== 'number' || typeof l.y !== 'number') continue;
      if (this.sprites.laserPlayer && this.sprites.laserPlayer.width) {
        p.image(this.sprites.laserPlayer, l.x, l.y, l.width, l.height);
      } else {
        p.fill(56, 189, 248);
        p.noStroke();
        p.rect(l.x, l.y, l.width, l.height, 3);
      }
    }

    // 2. Enemy Lasers
    for (const l of this.enemyLasers) {
      if (!l || typeof l.x !== 'number' || typeof l.y !== 'number') continue;
      if (this.sprites.laserEnemy && this.sprites.laserEnemy.width) {
        p.image(this.sprites.laserEnemy, l.x, l.y, l.width, l.height);
      } else {
        p.fill(239, 68, 68);
        p.noStroke();
        p.rect(l.x, l.y, l.width, l.height, 3);
      }
    }

    // 3. Boss Projectiles
    for (const bp of this.bossProjectiles) {
      if (!bp || typeof bp.x !== 'number' || typeof bp.y !== 'number') continue;
      if (bp.type === 'axe') {
        p.push();
        p.translate(bp.x + (bp.width || 24) / 2, bp.y + (bp.height || 24) / 2);
        p.rotate(bp.rotation || 0);
        const axes = this.sprites.bossGliderAxes;
        const img = axes[(bp.spriteIndex || 0) % axes.length];
        if (img && img.width) {
          p.image(img, -(bp.width || 24) / 2, -(bp.height || 24) / 2, bp.width || 24, bp.height || 24);
        } else {
          p.fill(250, 204, 21);
          p.rect(-(bp.width || 24) / 2, -(bp.height || 24) / 2, bp.width || 24, bp.height || 24);
        }
        p.pop();
      } else if (bp.type === 'bubble') {
        const bubbles = this.sprites.bossKrakenBubbles;
        const img = bubbles[(bp.animFrame || 0) % bubbles.length];
        if (img && img.width) {
          p.image(img, bp.x, bp.y, bp.width || 24, bp.height || 24);
        } else {
          p.fill(147, 51, 234, 180);
          p.ellipse(bp.x + (bp.width || 24) / 2, bp.y + (bp.height || 24) / 2, bp.width || 24, bp.height || 24);
        }
      }
    }

    p.pop();
  }

  _drawPlayer(p) {
    if (!this.player) return;
    p.push();

    // Invulnerability blink
    if (this.player.invulnerableTicks > 0 && Math.floor(this.player.invulnerableTicks / 6) % 2 === 0) {
      p.pop();
      return;
    }

    if (this.sprites.player && this.sprites.player.width) {
      p.image(this.sprites.player, this.player.x, this.player.y, this.player.width, this.player.height);
    } else {
      p.fill(56, 189, 248);
      p.triangle(
        this.player.x + this.player.width / 2, this.player.y,
        this.player.x, this.player.y + this.player.height,
        this.player.x + this.player.width, this.player.y + this.player.height
      );
    }

    p.pop();
  }

  _drawEffects(p) {
    p.push();

    // 1. Confetti Burst Sheet (8 cols x 5 rows = 40 cells of 256x256, 35 active frames)
    const confImg = this.sprites.confettiSheet;
    for (const eff of this.confettiEffects) {
      if (confImg && confImg.width) {
        const f = Math.min(34, eff.frame);
        const col = f % 8;
        const row = Math.floor(f / 8);
        const sx = col * 256;
        const sy = row * 256;
        p.image(
          confImg,
          eff.x - eff.width / 2,
          eff.y - eff.height / 2,
          eff.width,
          eff.height,
          sx,
          sy,
          256,
          256
        );
      } else {
        // Fallback colorful sparkle
        p.noStroke();
        p.fill(250, 204, 21, 200);
        p.ellipse(eff.x, eff.y, eff.width * 0.5, eff.height * 0.5);
      }
    }

    // 2. Grey Smoke Puff (frames 5 to 9 of explosion-32px_strip10.png)
    const smokeImg = this.sprites.smokeSheet;
    for (const eff of this.smokeEffects) {
      if (smokeImg && smokeImg.width) {
        const frameIdx = eff.startFrame + Math.min(4, Math.floor(eff.currentProgress * 5));
        const sx = frameIdx * 32;
        p.image(
          smokeImg,
          eff.x - eff.width / 2,
          eff.y - eff.height / 2,
          eff.width,
          eff.height,
          sx,
          0,
          32,
          32
        );
      } else {
        // Fallback grey smoke
        p.noStroke();
        p.fill(160, 160, 175, 180 * (1 - eff.currentProgress));
        p.ellipse(eff.x, eff.y, eff.width * (0.4 + eff.currentProgress * 0.6), eff.height * (0.4 + eff.currentProgress * 0.6));
      }
    }

    p.pop();
  }

  _drawFloatingTexts(p) {
    p.push();
    p.textFont('sans-serif');
    p.textSize(14);
    p.textStyle(p.BOLD);
    p.textAlign(p.CENTER, p.CENTER);

    for (const ft of this.floatingTexts) {
      p.fill(ft.color[0], ft.color[1], ft.color[2], ft.alpha);
      p.noStroke();
      p.text(ft.text, ft.x, ft.y);
    }
    p.pop();
  }

  // ==========================================================================
  // MOUNT & TEARDOWN
  // ==========================================================================

  mount(container) {
    this.container = container;
    if (typeof p5 === 'function') {
      new p5((p) => {
        this.p5Instance = p;
        p.preload = () => this.preload(p);
        p.setup = () => this.setup(p);
        p.draw = () => this.draw(p);
      }, container);
    }
  }

  destroy() {
    this.gameLoopRunning = false;
    if (this._keyDownHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this._keyDownHandler);
    }
    if (this._keyUpHandler && typeof window !== 'undefined') {
      window.removeEventListener('keyup', this._keyUpHandler);
    }
    if (this._blurHandler && typeof window !== 'undefined') {
      window.removeEventListener('blur', this._blurHandler);
    }
    if (this.gesture) {
      this.gesture.stop();
    }
    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }
  }
}
