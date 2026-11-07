/**
 * MindRush — Space Invader Core Game Engine (Phase 4.2 — Movement Lock & Boss Lady)
 * Autonomous fun mode featuring retro arcade spaceship combat against roaming UFO armadas.
 * 
 * Capabilities & Refinements:
 * - Strict horizontal-only player movement along a fixed bottom lane (Y is constant)
 * - Keyboard-only movement (Arrows/WASD), mouse movement disabled for spaceship
 * - Hand gesture controls affect horizontal position only, pinch to fire
 * - Finite wave target objective for Easy difficulty (10 targets) with completion modal
 * - Hostile UFO diving attacks in Medium, Hard, and Insane enabling genuine ship collisions
 * - 7-frame animated damage explosions and temporary invulnerability flash
 * - Mini-Boss UFO integration (32x32 pixel art rendered at 64x64, 3 animation frames, HP bar)
 * - Final Boss Lady integration (boss_goddess sprites at 96x96 with halo, lightning attacks)
 * - Lightning attack: telegraphed warning → lightning bolt strikes down toward player lane
 * - Difficulty scaling:
 *     Easy: Peaceful UFO targets (0 hostile attacks, 10 target completion goal)
 *     Medium: Hostile UFOs with lasers and diving attacks
 *     Hard: Hostile UFOs + Mini-Boss UFO encounter
 *     Insane: Hostile UFOs + Mini-Boss + Final Boss Lady with lightning attacks
 * - Mode-isolated score persistence ('space-invader' category) and verified progression
 */

import { GameState } from './state.js';
import { AudioManager } from './audio.js';
import { InputManager } from './input.js';
import { UIManager } from './ui.js';
import { GestureController } from './gesture.js';
import { unlockInsane, isInsaneUnlocked } from './difficulty.js';
import { getScopedStorageKey, submitScoreToServer } from './storage.js';

// Configuration presets for all 4 difficulty tiers
export const INVADER_CONFIGS = {
  easy: {
    id: 'easy',
    name: 'Easy',
    maxUFOs: 6,
    ufoSpeed: 1.8,
    ufoAttackInterval: 0, // 0 = peaceful, no hostile attacks
    playerSpeed: 7,
    fireCooldown: 180, // ms
    scorePerUFO: 50,
    hasHostileFire: false,
    hasDivingUFOs: false,
    targetObjective: 10, // 10 finite targets to complete Easy
    hasMiniBoss: false,
    hasFinalBoss: false,
    // Reactive AI settings (Easy = minimal reaction)
    ai: {
      evadeEnabled: false,        // UFOs do not dodge in Easy
      evadeSpeed: 0,
      evadeCooldown: 0,
      evadeDetectRadius: 0,
      diveChance: 0,              // no dives in Easy
      diveSpeed: 0,
      diveWarningTicks: 0,
      roamVariation: 0.3,         // mild directional variety
      recoverTicks: 30,
      awarenessRadius: 0,         // no player tracking
      maxSimultaneousDivers: 0
    }
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    maxUFOs: 8,
    ufoSpeed: 2.5,
    ufoAttackInterval: 120, // frames (~2 sec)
    playerSpeed: 7.5,
    fireCooldown: 170,
    scorePerUFO: 75,
    hasHostileFire: true,
    hasDivingUFOs: true,
    diveInterval: 180, // frames between dive runs (~3 sec)
    hasMiniBoss: false,
    hasFinalBoss: false,
    ai: {
      evadeEnabled: true,
      evadeSpeed: 3.5,            // moderate dodge speed
      evadeCooldown: 90,          // ~1.5 sec between dodge attempts
      evadeDetectRadius: 80,      // detect lasers within 80px horizontal
      diveChance: 0.008,          // per-frame chance per UFO to initiate dive
      diveSpeed: 4.0,
      diveWarningTicks: 20,       // ~0.33s telegraph before dive
      roamVariation: 0.5,
      recoverTicks: 40,
      awarenessRadius: 200,       // track player within 200px
      maxSimultaneousDivers: 1
    }
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    maxUFOs: 10,
    ufoSpeed: 3.2,
    ufoAttackInterval: 80, // frames (~1.3 sec)
    playerSpeed: 8,
    fireCooldown: 160,
    scorePerUFO: 100,
    hasHostileFire: true,
    hasDivingUFOs: true,
    diveInterval: 120,
    hasMiniBoss: true,
    miniBossSpawnThreshold: 8, // spawns after 8 regular UFOs destroyed
    hasFinalBoss: false,
    ai: {
      evadeEnabled: true,
      evadeSpeed: 5.0,
      evadeCooldown: 60,          // ~1 sec cooldown
      evadeDetectRadius: 110,
      diveChance: 0.012,
      diveSpeed: 5.0,
      diveWarningTicks: 15,       // ~0.25s telegraph (faster)
      roamVariation: 0.7,
      recoverTicks: 35,
      awarenessRadius: 300,
      maxSimultaneousDivers: 2
    }
  },
  insane: {
    id: 'insane',
    name: 'Insane',
    maxUFOs: 12,
    ufoSpeed: 4.0,
    ufoAttackInterval: 55, // frames (~0.9 sec)
    playerSpeed: 8.5,
    fireCooldown: 150,
    scorePerUFO: 150,
    hasHostileFire: true,
    hasDivingUFOs: true,
    diveInterval: 80,
    hasMiniBoss: true,
    miniBossSpawnThreshold: 6,
    hasFinalBoss: true,
    ai: {
      evadeEnabled: true,
      evadeSpeed: 6.5,
      evadeCooldown: 40,          // ~0.67 sec cooldown
      evadeDetectRadius: 140,
      diveChance: 0.015,
      diveSpeed: 6.0,
      diveWarningTicks: 12,       // ~0.2s telegraph (very fast)
      roamVariation: 1.0,
      recoverTicks: 25,
      awarenessRadius: 400,
      maxSimultaneousDivers: 3
    }
  }
};

/**
 * UFO AI States:
 *   ROAM    — Default patrol with varied movement
 *   EVADE   — Horizontal dodge away from incoming player projectile
 *   DIVE    — Warning telegraph then descend toward player lane
 *   RECOVER — Return to patrol position after evade or dive
 */
export const UFO_AI_STATE = {
  ROAM: 'ROAM',
  EVADE: 'EVADE',
  DIVE: 'DIVE',
  RECOVER: 'RECOVER'
};

export class SpaceInvaderEngine {
  constructor(difficultyConfig = {}) {
    const diffKey = (difficultyConfig.id || 'easy').toLowerCase();
    this.config = INVADER_CONFIGS[diffKey] || INVADER_CONFIGS.easy;
    this.difficultyKey = diffKey;

    this.state = new GameState(3);
    this.audio = new AudioManager();
    this.input = new InputManager();
    this.ui = new UIManager();
    this.gesture = new GestureController();

    this.p5Instance = null;
    this.container = null;

    // Sprite assets dictionary
    this.sprites = {
      player: null,
      ufo: [],
      laserPlayer: null,
      laserEnemy: null,
      miniBoss: [],
      finalBoss: [],
      finalBossHalo: null,
      lightning: [],
      explosions: []
    };
    this.spritesLoaded = false;

    // Entity collections
    this.player = null;
    this.ufos = [];
    this.playerLasers = [];
    this.enemyLasers = [];
    this.explosions = [];
    this.particles = [];

    // Boss entities
    this.miniBoss = null;
    this.miniBossDefeated = false;
    this.finalBoss = null;
    this.finalBossDefeated = false;

    // Lightning bolt entities (Final Boss Lady attack)
    this.lightningBolts = [];

    // Gameplay metrics & throttles
    this.targetsDestroyed = 0;
    this.easyCompleted = false;
    this.lastPlayerShotTick = 0;
    this.enemyShootTimer = 0;
    this.diveTimer = 0;
    this.animTick = 0;
    this._flightRecordSaved = false;

    // Active keyboard state for multi-key fluid movement
    this.keysDown = {};

    this._setupUI();
    this._setupKeyboard();
    this._setupGesture();
    this._setupVisibilityChange();
  }

  _setupUI() {
    if (typeof document === 'undefined') return;
    this.ui.bindEvents({
      onResume: () => this.resume(),
      onRestart: () => this.restart(),
      onExit: () => this.exit(),
      onNextLevelYes: () => this.proceedToNextLevel(),
      onNextLevelNo: () => this.declineNextLevel(),
      onTogglePause: () => this.togglePause()
    });

    this.input.onPauseToggle(() => this.togglePause());
  }

  _setupKeyboard() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      this.keysDown[e.code] = true;
      this.keysDown[e.key] = true;

      // Spacebar or 'K' to fire
      if (e.code === 'Space' || e.key === ' ' || e.code === 'KeyK') {
        e.preventDefault();
        if (this.state.isPlaying()) {
          this.firePlayerLaser();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown[e.code] = false;
      this.keysDown[e.key] = false;
    });
  }

  _setupGesture() {
    this.gesture.onUpdate(({ normX, normY, isPinching, isHandPresent }) => {
      if (!this.player || !this.p5Instance || !this.state.isPlaying()) return;

      const w = this.p5Instance.width;

      // Map horizontal only: entire canvas width with margin
      const targetX = normX * (w - this.player.width - 20) + 10;
      this.player.x = Math.max(10, Math.min(targetX, w - this.player.width - 10));

      // Vertical position is strictly LOCKED — gesture does not affect Y
      this.player.y = this.player.fixedY;

      // Gesture pinch to fire
      if (isPinching) {
        this.firePlayerLaser();
      }
    });
  }

  _setupVisibilityChange() {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state.isPlaying()) {
        this.pause();
      }
    });
  }

  /**
   * Mounts the p5.js canvas
   * @param {HTMLElement} container
   */
  mount(container) {
    this.container = container;
    const sketch = (p) => {
      this.p5Instance = p;

      p.preload = () => {
        this._loadSprites(p);
      };

      p.setup = () => {
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        canvas.parent(container);

        // Nearest-neighbor scaling for crisp retro pixel art
        if (p.drawingContext) {
          p.drawingContext.imageSmoothingEnabled = false;
        }

        // Hide centered loading indicator once setup is complete
        if (typeof document !== 'undefined') {
          const loadEl = document.getElementById('p5_loading');
          if (loadEl) loadEl.style.display = 'none';
        }

        this._initPlayer(p.width, p.height);
        this._initUFOFleet(p.width, p.height);

        // Update HUD mode text
        const diffNameEl = document.getElementById('hud-diff-name');
        if (diffNameEl) {
          diffNameEl.textContent = `SPACE INVADER • ${this.config.name.toUpperCase()}`;
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        if (p.drawingContext) {
          p.drawingContext.imageSmoothingEnabled = false;
        }
        if (this.player) {
          this._clampPlayerToBounds(p.width, p.height);
        }
      };

      p.draw = () => {
        this._gameLoop(p);
      };
    };

    if (typeof window !== 'undefined' && window.p5) {
      new window.p5(sketch);
    }
  }

  _loadSprites(p) {
    if (!p || typeof p.loadImage !== 'function') return;

    try {
      // 1. Player ship (16x16)
      this.sprites.player = p.loadImage('SpaceShooterGFX/player_ship_blue.png');

      // 2. Regular UFOs (16x16, 2 animation frames)
      this.sprites.ufo = [
        p.loadImage('SpaceShooterGFX/enemy_UFO_0.png'),
        p.loadImage('SpaceShooterGFX/enemy_UFO_1.png')
      ];

      // 3. Projectiles (16x16)
      this.sprites.laserPlayer = p.loadImage('SpaceShooterGFX/laser_blue.png');
      this.sprites.laserEnemy = p.loadImage('SpaceShooterGFX/laser_red.png');

      // 4. Mini-Boss UFO (32x32, right-side row of spritesheet, 3 animation frames)
      this.sprites.miniBoss = [
        p.loadImage('SpaceShooterGFX/boss_UFO_0.png'),
        p.loadImage('SpaceShooterGFX/boss_UFO_1.png'),
        p.loadImage('SpaceShooterGFX/boss_UFO_2.png')
      ];

      // 5. Final Boss Goddess (32x32, bottom-center boss lady character, 3 animation frames + halo)
      this.sprites.finalBoss = [
        p.loadImage('SpaceShooterGFX/boss_goddess_0.png'),
        p.loadImage('SpaceShooterGFX/boss_goddess_1.png'),
        p.loadImage('SpaceShooterGFX/boss_goddess_2.png')
      ];
      this.sprites.finalBossHalo = p.loadImage('SpaceShooterGFX/boss_goddess_halo.png');

      // 6. Explosions (7 frames)
      this.sprites.explosions = [];
      for (let i = 0; i <= 6; i++) {
        this.sprites.explosions.push(p.loadImage(`SpaceShooterGFX/explosion_${i}.png`));
      }

      // 7. Lightning bolt sprites (purple, 3 animation frames — for Final Boss Lady attack)
      this.sprites.lightning = [
        p.loadImage('SpaceShooterGFX/lightning_purple_0.png'),
        p.loadImage('SpaceShooterGFX/lightning_purple_1.png'),
        p.loadImage('SpaceShooterGFX/lightning_purple_2.png')
      ];

      this.spritesLoaded = true;
    } catch (err) {
      console.warn('[SpaceInvaderEngine] Sprites loading fallback to canvas renderers:', err);
      this.spritesLoaded = false;
    }
  }

  _initPlayer(w, h) {
    const shipW = 44;
    const shipH = 44;
    // Fixed Y: spaceship locked to a constant horizontal lane near the bottom
    const fixedY = h - shipH - 40;
    this.player = {
      x: w / 2 - shipW / 2,
      y: fixedY,
      fixedY: fixedY, // constant — never changes during gameplay
      width: shipW,
      height: shipH,
      vx: 0,
      vy: 0,
      speed: this.config.playerSpeed,
      invulnerableTicks: 0
    };
  }

  _initUFOFleet(w, h) {
    this.ufos = [];
    const count = this.config.maxUFOs;
    const cols = Math.min(count, Math.max(3, Math.floor(w / 100)));
    const spacingX = (w - 120) / cols;
    const startY = 80;
    const ai = this.config.ai || {};

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ufoX = 60 + col * spacingX + (row % 2 === 0 ? 0 : 25);
      const ufoY = startY + row * 65;

      // Per-UFO personality variation (±20% speed/timing variance)
      const personality = 0.8 + Math.random() * 0.4;

      this.ufos.push({
        id: `ufo_${Date.now()}_${i}`,
        x: ufoX,
        y: ufoY,
        baseY: ufoY,
        width: 40,
        height: 40,
        vx: (i % 2 === 0 ? 1 : -1) * this.config.ufoSpeed * personality,
        phase: Math.random() * Math.PI * 2,
        isAlive: true,
        isDiving: false,
        diveVy: 0,
        diveTargetX: null,
        type: 'regular',

        // Reactive AI state
        aiState: UFO_AI_STATE.ROAM,
        aiTicks: 0,                 // ticks spent in current state
        evadeCooldown: 0,           // ticks until next evade is allowed
        evadeDir: 0,                // -1 or +1 dodge direction
        diveWarningTicks: 0,        // telegraph countdown before actual dive
        recoverTargetY: ufoY,       // Y to return to after dive/evade
        personality: personality,    // unique speed/timing modifier
        roamDirTimer: Math.floor(Math.random() * 60), // varied direction changes
        roamDirInterval: 60 + Math.floor(Math.random() * 60) // unique per UFO
      });
    }
  }

  _clampPlayerToBounds(w, h) {
    const minX = 10;
    const maxX = w - this.player.width - 10;

    // Horizontal clamping only — Y is strictly locked
    this.player.x = Math.max(minX, Math.min(this.player.x, maxX));
    // Re-enforce fixed Y position (never changes)
    this.player.y = this.player.fixedY;
  }

  firePlayerLaser() {
    if (!this.player || !this.state.isPlaying()) return;

    const now = Date.now();
    if (now - this.lastPlayerShotTick < this.config.fireCooldown) return;
    this.lastPlayerShotTick = now;

    // Laser originates from spaceship nose
    const laserW = 12;
    const laserH = 26;
    const laserX = this.player.x + this.player.width / 2 - laserW / 2;
    const laserY = this.player.y - 10;

    this.playerLasers.push({
      x: laserX,
      y: laserY,
      width: laserW,
      height: laserH,
      dy: -12, // Moves rapidly upward
      isAlive: true
    });

    this.audio.play('paddle');
  }

  spawnEnemyLaser(source, spreadDx = 0) {
    if (!source || !this.config.hasHostileFire) return;

    const laserW = 12;
    const laserH = 26;
    const laserX = source.x + source.width / 2 - laserW / 2;
    const laserY = source.y + source.height;

    const laserSpeed = this.difficultyKey === 'insane' ? 8.5 : this.difficultyKey === 'hard' ? 7.0 : 5.5;

    this.enemyLasers.push({
      x: laserX,
      y: laserY,
      width: laserW,
      height: laserH,
      dx: spreadDx,
      dy: laserSpeed, // Moves downward towards player zone
      isAlive: true
    });
  }

  spawnExplosion(x, y, size = 48) {
    this.explosions.push({
      x,
      y,
      size,
      currentFrame: 0,
      maxFrames: 7,
      ticksPerFrame: 3,
      frameCounter: 0,
      isFinished: false
    });
  }

  _gameLoop(p) {
    this.animTick++;

    // 1. Game Over State
    if (this.state.isGameOver()) {
      if (!this.state.gameOverHandled) {
        this.state.gameOverHandled = true;
        this.audio.play('gameOver');
        this._saveFlightRecord();
        this.ui.showGameOverModal(this.state.score);
      }
      this._renderBackground(p);
      this._renderEntities(p);
      this._renderHUD(p);
      return;
    }

    // 2. Paused State
    if (this.state.isPaused()) {
      this.ui.showPauseModal();
      this._renderBackground(p);
      this._renderEntities(p);
      this._renderHUD(p);
      return;
    }

    // 3. Active Play Updates
    this._updatePlayer(p);
    this._updateUFOs(p);
    this._updateBosses(p);
    this._updateLasers(p);
    this._checkCollisions(p);
    this._updateExplosions();
    this._checkObjectives(p);

    // 4. Render
    this._renderBackground(p);
    this._renderEntities(p);
    this._renderHUD(p);

    // Sync score in DOM HUD topbar
    const scoreValEl = document.getElementById('hud-score-val');
    if (scoreValEl) {
      scoreValEl.textContent = this.state.score.toLocaleString();
    }
  }

  _updatePlayer(p) {
    if (!this.player) return;

    // Keyboard movement — horizontal only
    let moveX = 0;

    if (this.keysDown['ArrowLeft'] || this.keysDown['KeyA']) moveX -= 1;
    if (this.keysDown['ArrowRight'] || this.keysDown['KeyD']) moveX += 1;
    // Up/Down/W/S keys are deliberately ignored — strictly horizontal movement

    this.player.x += moveX * this.player.speed;

    // Mouse movement is disabled for spaceship — keyboard only
    // (gesture horizontal tracking still applies via _setupGesture)

    // Strict boundary enforcement: horizontal clamping + fixed Y lock
    this._clampPlayerToBounds(p.width, p.height);

    // Decay invulnerability
    if (this.player.invulnerableTicks > 0) {
      this.player.invulnerableTicks--;
    }
  }

  _updateUFOs(p) {
    const minY = 60;
    const maxY = p.height * 0.52; // Upper boundary during patrol
    const minX = 15;
    const maxX = p.width - 55;
    const ai = this.config.ai || {};

    // --- Global timers for hostile fire and dive orchestration ---

    // Hostile regular enemy fire check (Medium, Hard, Insane)
    if (this.config.hasHostileFire && this.ufos.length > 0) {
      this.enemyShootTimer++;
      if (this.enemyShootTimer >= this.config.ufoAttackInterval) {
        this.enemyShootTimer = 0;
        const shooters = this.ufos.filter(u => u.isAlive && u.aiState === UFO_AI_STATE.ROAM);
        if (shooters.length > 0) {
          const shooter = shooters[Math.floor(Math.random() * shooters.length)];
          this.spawnEnemyLaser(shooter);
        }
      }
    }

    // Count current divers for max simultaneous limit
    const currentDivers = this.ufos.filter(u => u.isAlive && (u.aiState === UFO_AI_STATE.DIVE)).length;

    // --- Per-UFO AI State Machine ---
    for (const ufo of this.ufos) {
      if (!ufo.isAlive) continue;

      // Decrement evade cooldown
      if (ufo.evadeCooldown > 0) ufo.evadeCooldown--;
      ufo.aiTicks++;

      switch (ufo.aiState) {
        case UFO_AI_STATE.ROAM:
          this._aiRoam(ufo, p, minX, maxX, minY, maxY, ai, currentDivers);
          break;
        case UFO_AI_STATE.EVADE:
          this._aiEvade(ufo, p, minX, maxX, ai);
          break;
        case UFO_AI_STATE.DIVE:
          this._aiDive(ufo, p, minX, maxX, ai);
          break;
        case UFO_AI_STATE.RECOVER:
          this._aiRecover(ufo, p, minX, maxX, minY, maxY, ai);
          break;
        default:
          ufo.aiState = UFO_AI_STATE.ROAM;
          ufo.aiTicks = 0;
          break;
      }
    }

    // Controlled respawn if all UFOs cleared and no boss currently active
    const livingCount = this.ufos.filter(u => u.isAlive).length;
    if (livingCount === 0 && !this.miniBoss && !this.finalBoss && !this.easyCompleted) {
      this._initUFOFleet(p.width, p.height);
    }
  }

  // ─── AI STATE: ROAM ───────────────────────────────────────────────
  _aiRoam(ufo, p, minX, maxX, minY, maxY, ai, currentDivers) {
    // 1. Varied horizontal movement with periodic direction changes
    ufo.roamDirTimer++;
    if (ufo.roamDirTimer >= ufo.roamDirInterval) {
      ufo.roamDirTimer = 0;
      // Occasional random direction flip for variety
      if (Math.random() < (ai.roamVariation || 0.3)) {
        ufo.vx = -ufo.vx;
      }
      // Randomize next interval for non-uniform behavior
      ufo.roamDirInterval = 50 + Math.floor(Math.random() * 70);
    }

    // Horizontal patrol with edge bounce
    ufo.x += ufo.vx;
    if (ufo.x <= minX) {
      ufo.x = minX;
      ufo.vx = Math.abs(ufo.vx);
    } else if (ufo.x >= maxX) {
      ufo.x = maxX;
      ufo.vx = -Math.abs(ufo.vx);
    }

    // Sinusoidal vertical bobbing within upper zone
    ufo.phase += 0.04;
    ufo.y = ufo.baseY + Math.sin(ufo.phase) * 16;
    ufo.y = Math.max(minY, Math.min(ufo.y, maxY));

    // 2. Player awareness — drift toward player's X if within awareness radius
    if (ai.awarenessRadius > 0 && this.player) {
      const dxToPlayer = this.player.x + this.player.width / 2 - (ufo.x + ufo.width / 2);
      if (Math.abs(dxToPlayer) < ai.awarenessRadius) {
        // Gentle drift toward player (much slower than evade)
        ufo.x += Math.sign(dxToPlayer) * 0.4 * ufo.personality;
      }
    }

    // 3. Check for projectile evasion trigger
    if (ai.evadeEnabled && ufo.evadeCooldown <= 0) {
      const threat = this._detectIncomingProjectile(ufo, ai.evadeDetectRadius || 80);
      if (threat) {
        ufo.aiState = UFO_AI_STATE.EVADE;
        ufo.aiTicks = 0;
        // Dodge away from the projectile's X center
        const laserCenterX = threat.x + threat.width / 2;
        const ufoCenterX = ufo.x + ufo.width / 2;
        ufo.evadeDir = (ufoCenterX >= laserCenterX) ? 1 : -1;
        // Avoid dodging into wall
        if (ufo.x + ufo.evadeDir * 60 > maxX || ufo.x + ufo.evadeDir * 60 < minX) {
          ufo.evadeDir = -ufo.evadeDir;
        }
        ufo.evadeCooldown = ai.evadeCooldown || 60;
        return;
      }
    }

    // 4. Per-UFO dive initiation (replaces the old global diveTimer)
    if (this.config.hasDivingUFOs && ai.diveChance > 0 && this.player) {
      const maxDivers = ai.maxSimultaneousDivers || 1;
      if (currentDivers < maxDivers && Math.random() < ai.diveChance * ufo.personality) {
        ufo.aiState = UFO_AI_STATE.DIVE;
        ufo.aiTicks = 0;
        ufo.diveWarningTicks = ai.diveWarningTicks || 20;
        ufo.isDiving = false; // not yet — still in telegraph
        ufo.diveTargetX = this.player.x + (Math.random() - 0.5) * 40;
        ufo.diveVy = ai.diveSpeed || 4.0;
        ufo.recoverTargetY = ufo.baseY;
        return;
      }
    }
  }

  // ─── AI STATE: EVADE ──────────────────────────────────────────────
  _aiEvade(ufo, p, minX, maxX, ai) {
    const evadeSpeed = ai.evadeSpeed || 3.5;
    const evadeDuration = 12; // frames of active dodge

    ufo.x += ufo.evadeDir * evadeSpeed;

    // Clamp to play area
    if (ufo.x <= minX) { ufo.x = minX; ufo.evadeDir = 1; }
    if (ufo.x >= maxX) { ufo.x = maxX; ufo.evadeDir = -1; }

    // Transition to RECOVER after dodge completes
    if (ufo.aiTicks >= evadeDuration) {
      ufo.aiState = UFO_AI_STATE.RECOVER;
      ufo.aiTicks = 0;
      ufo.recoverTargetY = ufo.baseY;
    }
  }

  // ─── AI STATE: DIVE ───────────────────────────────────────────────
  _aiDive(ufo, p, minX, maxX, ai) {
    // Phase 1: Warning telegraph (UFO blinks / pauses before diving)
    if (ufo.diveWarningTicks > 0) {
      ufo.diveWarningTicks--;
      // UFO hovers and flashes during telegraph — no movement
      return;
    }

    // Phase 2: Active dive
    ufo.isDiving = true;
    ufo.y += ufo.diveVy;

    // Horizontal tracking toward target
    if (typeof ufo.diveTargetX === 'number') {
      const dx = ufo.diveTargetX - ufo.x;
      ufo.x += Math.sign(dx) * Math.min(Math.abs(dx), 2.5);
    }

    // Check if reached screen bottom → transition to RECOVER
    if (ufo.y > p.height + 40) {
      ufo.isDiving = false;
      ufo.aiState = UFO_AI_STATE.RECOVER;
      ufo.aiTicks = 0;
      ufo.y = ufo.baseY;
      ufo.x = Math.max(minX, Math.min(ufo.x, maxX));
    }
  }

  // ─── AI STATE: RECOVER ────────────────────────────────────────────
  _aiRecover(ufo, p, minX, maxX, minY, maxY, ai) {
    const recoverDuration = ai.recoverTicks || 40;

    // Smoothly interpolate back to patrol position
    const targetY = Math.max(minY, Math.min(ufo.recoverTargetY || ufo.baseY, maxY));
    const dyRecover = targetY - ufo.y;
    ufo.y += dyRecover * 0.1;

    // Resume gentle horizontal patrol during recovery
    ufo.x += ufo.vx * 0.5;
    if (ufo.x <= minX) { ufo.x = minX; ufo.vx = Math.abs(ufo.vx); }
    if (ufo.x >= maxX) { ufo.x = maxX; ufo.vx = -Math.abs(ufo.vx); }

    // Transition back to ROAM after recovery duration or close enough to target
    if (ufo.aiTicks >= recoverDuration || Math.abs(dyRecover) < 3) {
      ufo.aiState = UFO_AI_STATE.ROAM;
      ufo.aiTicks = 0;
      ufo.isDiving = false;
    }
  }

  // ─── PROJECTILE DETECTION ─────────────────────────────────────────
  /**
   * Detects if any player laser is heading toward this UFO within a horizontal radius.
   * Returns the closest threatening laser, or null.
   */
  _detectIncomingProjectile(ufo, detectRadius) {
    if (!this.playerLasers || this.playerLasers.length === 0) return null;

    const ufoCX = ufo.x + ufo.width / 2;
    let closestThreat = null;
    let closestDist = Infinity;

    for (const laser of this.playerLasers) {
      // Laser must be below the UFO (approaching from below since dy is negative)
      if (laser.y > ufo.y + ufo.height && laser.y < ufo.y + ufo.height + 200) {
        const laserCX = laser.x + laser.width / 2;
        const horizDist = Math.abs(laserCX - ufoCX);
        if (horizDist < detectRadius && horizDist < closestDist) {
          closestDist = horizDist;
          closestThreat = laser;
        }
      }
    }
    return closestThreat;
  }

  _updateBosses(p) {
    const minX = 20;
    const maxX = p.width - 80;

    // 1. Mini-Boss Lifecycle (Hard & Insane)
    if (this.miniBoss && this.miniBoss.isAlive) {
      this.miniBoss.x += this.miniBoss.vx;
      if (this.miniBoss.x <= minX) {
        this.miniBoss.x = minX;
        this.miniBoss.vx = Math.abs(this.miniBoss.vx);
      } else if (this.miniBoss.x >= maxX) {
        this.miniBoss.x = maxX;
        this.miniBoss.vx = -Math.abs(this.miniBoss.vx);
      }

      this.miniBoss.phase += 0.03;
      this.miniBoss.y = 80 + Math.sin(this.miniBoss.phase) * 20;

      // Mini-Boss dual laser attacks
      this.miniBoss.shootTimer = (this.miniBoss.shootTimer || 0) + 1;
      if (this.miniBoss.shootTimer >= 55) {
        this.miniBoss.shootTimer = 0;
        this.spawnEnemyLaser(this.miniBoss, -1.5);
        this.spawnEnemyLaser(this.miniBoss, 1.5);
      }
    }

    // 2. Final Boss Lady Lifecycle (Insane only — distinct from Mini-Boss)
    if (this.finalBoss && this.finalBoss.isAlive) {
      // Slow sinusoidal horizontal patrol
      this.finalBoss.x += this.finalBoss.vx;
      if (this.finalBoss.x <= minX) {
        this.finalBoss.x = minX;
        this.finalBoss.vx = Math.abs(this.finalBoss.vx);
      } else if (this.finalBoss.x >= p.width - this.finalBoss.width - 20) {
        this.finalBoss.x = p.width - this.finalBoss.width - 20;
        this.finalBoss.vx = -Math.abs(this.finalBoss.vx);
      }

      this.finalBoss.phase += 0.025;
      this.finalBoss.y = 70 + Math.sin(this.finalBoss.phase) * 24;

      // Final Boss triple laser spread attack (slower cadence than Mini-Boss)
      this.finalBoss.shootTimer = (this.finalBoss.shootTimer || 0) + 1;
      if (this.finalBoss.shootTimer >= 50) {
        this.finalBoss.shootTimer = 0;
        this.spawnEnemyLaser(this.finalBoss, -2.5);
        this.spawnEnemyLaser(this.finalBoss, 0);
        this.spawnEnemyLaser(this.finalBoss, 2.5);
      }

      // Lightning attack: telegraphed bolt strikes toward player lane
      this.finalBoss.lightningTimer = (this.finalBoss.lightningTimer || 0) + 1;
      const lightningCooldown = 120; // ~2 sec between strikes
      if (this.finalBoss.lightningTimer >= lightningCooldown && this.player) {
        this.finalBoss.lightningTimer = 0;
        this._spawnLightningBolt(p);
      }
    }

    // 3. Update active lightning bolts
    this._updateLightningBolts(p);
  }

  /**
   * Spawns a telegraphed lightning bolt from the Final Boss Lady toward the player lane.
   * Phase 1: warning indicator appears at target X for ~30 frames
   * Phase 2: lightning bolt descends and strikes (damages player on collision)
   */
  _spawnLightningBolt(p) {
    if (!this.player || !this.finalBoss) return;

    // Target X: aim at player's current horizontal position with slight random offset
    const offsetX = (Math.random() - 0.5) * 60;
    const targetX = Math.max(20, Math.min(this.player.x + this.player.width / 2 + offsetX, p.width - 20));

    this.lightningBolts.push({
      x: targetX - 16,          // bolt centered on target
      y: this.finalBoss.y + this.finalBoss.height, // starts at boss bottom
      targetY: this.player.fixedY + this.player.height, // strikes down to player lane
      width: 32,
      height: 64,               // rendered height of each bolt segment
      phase: 'telegraph',       // 'telegraph' -> 'strike' -> 'fade'
      telegraphTicks: 0,
      telegraphDuration: 30,    // ~0.5s warning
      strikeTicks: 0,
      strikeDuration: 20,       // ~0.33s active bolt
      fadeTicks: 0,
      fadeDuration: 10,         // ~0.16s fade out
      hasHit: false,            // prevents multi-hit
      animFrame: 0,
      isAlive: true
    });
  }

  /**
   * Updates active lightning bolts through telegraph → strike → fade lifecycle
   */
  _updateLightningBolts(p) {
    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const bolt = this.lightningBolts[i];
      if (!bolt.isAlive) {
        this.lightningBolts.splice(i, 1);
        continue;
      }

      if (bolt.phase === 'telegraph') {
        bolt.telegraphTicks++;
        if (bolt.telegraphTicks >= bolt.telegraphDuration) {
          bolt.phase = 'strike';
        }
      } else if (bolt.phase === 'strike') {
        bolt.strikeTicks++;
        bolt.animFrame = Math.floor(bolt.strikeTicks / 3) % 3;

        // Check collision with player during strike phase
        if (!bolt.hasHit && this.player && this.player.invulnerableTicks === 0) {
          const boltHitbox = {
            x: bolt.x + 6,       // narrower hitbox than visual
            y: this.player.fixedY - 10,
            width: bolt.width - 12,
            height: 30
          };
          if (this._rectIntersect(boltHitbox, this.player)) {
            bolt.hasHit = true;
            this.spawnExplosion(this.player.x, this.player.y, this.player.width);
            this.state.modifyLives(-1);
            this.player.invulnerableTicks = 70;
            this.audio.play('redBall');
          }
        }

        if (bolt.strikeTicks >= bolt.strikeDuration) {
          bolt.phase = 'fade';
        }
      } else if (bolt.phase === 'fade') {
        bolt.fadeTicks++;
        if (bolt.fadeTicks >= bolt.fadeDuration) {
          bolt.isAlive = false;
        }
      }
    }
  }

  _updateLasers(p) {
    // 1. Player lasers (moving up)
    for (let i = this.playerLasers.length - 1; i >= 0; i--) {
      const laser = this.playerLasers[i];
      laser.y += laser.dy;
      if (laser.y < -30) {
        this.playerLasers.splice(i, 1);
      }
    }

    // 2. Enemy lasers (moving down with optional spread dx)
    for (let i = this.enemyLasers.length - 1; i >= 0; i--) {
      const laser = this.enemyLasers[i];
      laser.y += laser.dy;
      if (typeof laser.dx === 'number') {
        laser.x += laser.dx;
      }
      if (laser.y > p.height + 30) {
        this.enemyLasers.splice(i, 1);
      }
    }
  }

  _checkCollisions(p) {
    // 1. Player Lasers vs UFOs
    for (let i = this.playerLasers.length - 1; i >= 0; i--) {
      const laser = this.playerLasers[i];
      let laserUsed = false;

      // 1.1 Laser vs Regular UFOs
      for (const ufo of this.ufos) {
        if (!ufo.isAlive) continue;

        if (this._rectIntersect(laser, ufo)) {
          ufo.isAlive = false;
          laser.isAlive = false;
          laserUsed = true;
          this.playerLasers.splice(i, 1);

          this.targetsDestroyed++;
          this.spawnExplosion(ufo.x, ufo.y, ufo.width);
          this.state.addScore(this.config.scorePerUFO);
          this.audio.play('goldenBall');
          break;
        }
      }

      if (laserUsed) continue;

      // 1.2 Laser vs Mini-Boss
      if (this.miniBoss && this.miniBoss.isAlive && this._rectIntersect(laser, this.miniBoss)) {
        this.playerLasers.splice(i, 1);
        this.miniBoss.hp--;
        this.spawnExplosion(laser.x - 10, laser.y - 10, 28);
        this.audio.play('paddle');

        if (this.miniBoss.hp <= 0) {
          this.miniBoss.isAlive = false;
          this.miniBossDefeated = true;
          this.state.addScore(300);
          this.audio.play('goldenBall');

          // Cascading explosion for Mini-Boss
          for (let k = 0; k < 4; k++) {
            this.spawnExplosion(this.miniBoss.x + (k % 2) * 25, this.miniBoss.y + Math.floor(k / 2) * 25, 52);
          }

          // In Hard mode, defeating the Mini-Boss conquers Hard and unlocks Insane!
          if (this.difficultyKey === 'hard') {
            unlockInsane();
            this.ui.showNextLevelModal('VICTORY! Mini-Boss UFO eradicated. Hard difficulty conquered! INSANE mode is now permanently UNLOCKED!');
          }
        }
        continue;
      }

      // 1.3 Laser vs Final Boss
      if (this.finalBoss && this.finalBoss.isAlive && this._rectIntersect(laser, this.finalBoss)) {
        this.playerLasers.splice(i, 1);
        this.finalBoss.hp--;
        this.spawnExplosion(laser.x - 12, laser.y - 12, 32);
        this.audio.play('paddle');

        if (this.finalBoss.hp <= 0) {
          this.finalBoss.isAlive = false;
          this.finalBossDefeated = true;
          this.state.addScore(1000);
          this.audio.play('levelUp');

          // Massive cascading explosion for Final Boss
          for (let k = 0; k < 6; k++) {
            this.spawnExplosion(this.finalBoss.x + (k % 3) * 30, this.finalBoss.y + Math.floor(k / 3) * 30, 68);
          }

          this.ui.showNextLevelModal('SUPREME VICTORY! Boss Lady annihilated. You have mastered MindRush Space Invader!');
        }
      }
    }

    // 2. Enemy Lasers vs Player
    if (this.player && this.player.invulnerableTicks === 0) {
      for (let i = this.enemyLasers.length - 1; i >= 0; i--) {
        const laser = this.enemyLasers[i];
        if (this._rectIntersect(laser, this.player)) {
          laser.isAlive = false;
          this.enemyLasers.splice(i, 1);

          this.spawnExplosion(this.player.x, this.player.y, this.player.width);
          this.state.modifyLives(-1);
          this.player.invulnerableTicks = 70; // ~1.2s invulnerability
          this.audio.play('losePoints');
          break;
        }
      }
    }

    // 3. UFO body vs Player body (Direct Hull Collision)
    if (this.player && this.player.invulnerableTicks === 0) {
      for (const ufo of this.ufos) {
        if (!ufo.isAlive) continue;
        if (this._rectIntersect(ufo, this.player)) {
          ufo.isAlive = false;
          this.targetsDestroyed++;
          this.spawnExplosion(ufo.x, ufo.y, ufo.width);
          this.spawnExplosion(this.player.x, this.player.y, this.player.width);
          this.state.modifyLives(-1);
          this.player.invulnerableTicks = 70;
          this.audio.play('redBall');
          break;
        }
      }

      // 3.1 Mini-Boss vs Player collision
      if (this.miniBoss && this.miniBoss.isAlive && this._rectIntersect(this.miniBoss, this.player)) {
        this.spawnExplosion(this.player.x, this.player.y, this.player.width);
        this.state.modifyLives(-1);
        this.player.invulnerableTicks = 70;
        this.audio.play('redBall');
      }

      // 3.2 Final Boss vs Player collision
      if (this.finalBoss && this.finalBoss.isAlive && this._rectIntersect(this.finalBoss, this.player)) {
        this.spawnExplosion(this.player.x, this.player.y, this.player.width);
        this.state.modifyLives(-1);
        this.player.invulnerableTicks = 70;
        this.audio.play('redBall');
      }
    }
  }

  _rectIntersect(r1, r2) {
    return (
      r1.x < r2.x + r2.width &&
      r1.x + r1.width > r2.x &&
      r1.y < r2.y + r2.height &&
      r1.y + r1.height > r2.y
    );
  }

  _checkObjectives(p) {
    // Easy mode finite objective (10 targets)
    if (this.difficultyKey === 'easy' && !this.easyCompleted && this.config.targetObjective) {
      if (this.targetsDestroyed >= this.config.targetObjective) {
        this.easyCompleted = true;
        this.audio.play('levelUp');
        this._saveFlightRecord();
        this.pause();
        this.ui.showNextLevelModal('EASY SECTOR CLEARED! Outstanding flight control. All 10 alien reconnaissance targets destroyed. Proceed to Medium difficulty?');
        return;
      }
    }

    // Hard mode Mini-Boss spawn check
    if (this.difficultyKey === 'hard' && !this.miniBoss && !this.miniBossDefeated) {
      if (this.targetsDestroyed >= (this.config.miniBossSpawnThreshold || 8)) {
        this._spawnMiniBoss(p.width, p.height);
      }
    }

    // Insane mode progression: Mini-Boss then Final Boss
    if (this.difficultyKey === 'insane') {
      if (!this.miniBoss && !this.miniBossDefeated && this.targetsDestroyed >= (this.config.miniBossSpawnThreshold || 6)) {
        this._spawnMiniBoss(p.width, p.height);
      } else if (this.miniBossDefeated && !this.finalBoss && !this.finalBossDefeated) {
        this._spawnFinalBoss(p.width, p.height);
      }
    }
  }

  _spawnMiniBoss(w, h) {
    this.miniBoss = {
      x: w / 2 - 32,
      y: 80,
      width: 64,
      height: 64,
      hp: this.difficultyKey === 'insane' ? 20 : 15,
      maxHp: this.difficultyKey === 'insane' ? 20 : 15,
      vx: 2.8,
      phase: 0,
      isAlive: true,
      shootTimer: 0,
      type: 'miniBoss'
    };
    this.audio.play('redBall');
  }

  _spawnFinalBoss(w, h) {
    this.finalBoss = {
      x: w / 2 - 48,
      y: 70,
      width: 96,
      height: 96,
      hp: 35,
      maxHp: 35,
      vx: 2.4, // slower, more menacing patrol than Mini-Boss
      phase: 0,
      isAlive: true,
      shootTimer: 0,
      lightningTimer: 0, // separate cooldown for lightning attack
      type: 'finalBoss'
    };
    this.lightningBolts = []; // clear any stale bolts
    this.audio.play('levelUp');
  }

  _updateExplosions() {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.frameCounter++;
      if (exp.frameCounter >= exp.ticksPerFrame) {
        exp.frameCounter = 0;
        exp.currentFrame++;
        if (exp.currentFrame >= exp.maxFrames) {
          exp.isFinished = true;
          this.explosions.splice(i, 1);
        }
      }
    }
  }

  _renderBackground(p) {
    p.background(7, 9, 14);

    // Subtle starry space grid (no dotted horizontal line)
    p.push();
    p.stroke(22, 25, 38, 120);
    p.strokeWeight(1);
    for (let x = 0; x < p.width; x += 60) {
      p.line(x, 0, x, p.height);
    }
    for (let y = 0; y < p.height; y += 60) {
      p.line(0, y, p.width, y);
    }
    p.pop();
  }

  _renderEntities(p) {
    p.push();

    // 1. Draw Regular UFOs with AI state visual cues
    const ufoFrame = Math.floor(this.animTick / 15) % 2;
    const ufoImg = this.sprites.ufo[ufoFrame];

    for (const ufo of this.ufos) {
      if (!ufo.isAlive) continue;

      // Dive telegraph flash: blink the UFO during warning phase
      if (ufo.aiState === UFO_AI_STATE.DIVE && ufo.diveWarningTicks > 0) {
        if (Math.floor(this.animTick / 4) % 2 === 0) continue; // flash by skipping render
        // Draw warning exclamation
        p.fill(250, 204, 21, 200);
        p.noStroke();
        p.textFont('Press Start 2P');
        p.textSize(8);
        p.textAlign(p.CENTER);
        p.text('!', ufo.x + ufo.width / 2, ufo.y - 6);
        p.textAlign(p.LEFT);
      }

      if (ufoImg && ufoImg.width > 0) {
        // Tint evading UFOs cyan-white for visual feedback
        if (ufo.aiState === UFO_AI_STATE.EVADE) {
          p.tint(180, 220, 255, 200);
        }
        p.image(ufoImg, ufo.x, ufo.y, ufo.width, ufo.height);
        if (ufo.aiState === UFO_AI_STATE.EVADE) {
          p.noTint();
        }
      } else {
        // Procedural UFO fallback
        const evading = ufo.aiState === UFO_AI_STATE.EVADE;
        p.fill(evading ? 180 : 244, evading ? 220 : 63, evading ? 255 : 94);
        p.stroke(255);
        p.strokeWeight(1.5);
        p.ellipse(ufo.x + ufo.width / 2, ufo.y + ufo.height / 2, ufo.width, ufo.height * 0.6);
        p.fill(56, 189, 248);
        p.ellipse(ufo.x + ufo.width / 2, ufo.y + ufo.height * 0.35, ufo.width * 0.45, ufo.height * 0.35);
      }
    }

    // 2. Draw Mini-Boss UFO
    if (this.miniBoss && this.miniBoss.isAlive) {
      const mbFrame = Math.floor(this.animTick / 12) % 3;
      const mbImg = this.sprites.miniBoss[mbFrame] || this.sprites.miniBoss[0];

      if (mbImg && mbImg.width > 0) {
        p.image(mbImg, this.miniBoss.x, this.miniBoss.y, this.miniBoss.width, this.miniBoss.height);
      } else {
        p.fill(250, 204, 21);
        p.stroke(244, 63, 94);
        p.strokeWeight(2);
        p.rect(this.miniBoss.x, this.miniBoss.y, this.miniBoss.width, this.miniBoss.height, 8);
      }

      // Mini-Boss Health Bar
      const barW = this.miniBoss.width + 10;
      const barH = 6;
      const barX = this.miniBoss.x - 5;
      const barY = this.miniBoss.y - 12;
      const fillW = Math.max(0, (this.miniBoss.hp / this.miniBoss.maxHp) * barW);

      p.fill(17, 19, 29, 200);
      p.stroke(56, 189, 248, 180);
      p.strokeWeight(1);
      p.rect(barX, barY, barW, barH, 3);
      p.noStroke();
      p.fill(250, 204, 21);
      p.rect(barX + 1, barY + 1, Math.max(0, fillW - 2), barH - 2, 2);

      p.textFont('Press Start 2P');
      p.textSize(7);
      p.fill(250, 204, 21);
      p.text(`MINI-BOSS: ${this.miniBoss.hp}/${this.miniBoss.maxHp}`, barX - 10, barY - 4);
    }

    // 3. Draw Final Boss Lady (distinct from Mini-Boss — uses boss_goddess sprites)
    if (this.finalBoss && this.finalBoss.isAlive) {
      const fbFrame = Math.floor(this.animTick / 14) % 3;
      const fbImg = this.sprites.finalBoss[fbFrame] || this.sprites.finalBoss[0];

      // Draw floating halo above boss with pulsing glow
      if (this.sprites.finalBossHalo && this.sprites.finalBossHalo.width > 0) {
        const haloY = this.finalBoss.y - 22 + Math.sin(this.animTick * 0.1) * 3;
        const haloScale = 1.0 + Math.sin(this.animTick * 0.08) * 0.1;
        const haloW = 44 * haloScale;
        const haloH = 22 * haloScale;
        p.image(this.sprites.finalBossHalo, this.finalBoss.x + this.finalBoss.width / 2 - haloW / 2, haloY, haloW, haloH);
      }

      if (fbImg && fbImg.width > 0) {
        p.image(fbImg, this.finalBoss.x, this.finalBoss.y, this.finalBoss.width, this.finalBoss.height);
      } else {
        p.fill(192, 132, 252);
        p.stroke(250, 204, 21);
        p.strokeWeight(3);
        p.rect(this.finalBoss.x, this.finalBoss.y, this.finalBoss.width, this.finalBoss.height, 12);
      }

      // Grand Centered Top Health Bar for Final Boss Lady
      const topBarW = Math.min(320, p.width * 0.6);
      const topBarH = 12;
      const topBarX = p.width / 2 - topBarW / 2;
      const topBarY = 24;
      const fbFillW = Math.max(0, (this.finalBoss.hp / this.finalBoss.maxHp) * topBarW);

      p.fill(17, 19, 29, 230);
      p.stroke(192, 132, 252);
      p.strokeWeight(1.5);
      p.rect(topBarX, topBarY, topBarW, topBarH, 4);
      p.noStroke();
      p.fill(192, 132, 252);
      p.rect(topBarX + 1.5, topBarY + 1.5, Math.max(0, fbFillW - 3), topBarH - 3, 3);

      p.textFont('Press Start 2P');
      p.textSize(8);
      p.fill(243, 232, 255);
      p.textAlign(p.CENTER);
      p.text(`FINAL BOSS: BOSS LADY (${this.finalBoss.hp}/${this.finalBoss.maxHp})`, p.width / 2, topBarY - 6);
      p.textAlign(p.LEFT);
    }

    // 3.5 Draw Lightning Bolts
    for (const bolt of this.lightningBolts) {
      if (!bolt.isAlive) continue;

      if (bolt.phase === 'telegraph') {
        // Warning indicator: pulsing purple crosshair on the player lane
        const pulseAlpha = 120 + Math.sin(this.animTick * 0.4) * 80;
        p.noFill();
        p.stroke(192, 132, 252, pulseAlpha);
        p.strokeWeight(2);
        // Vertical warning line from boss area to player lane
        p.line(bolt.x + bolt.width / 2, bolt.y, bolt.x + bolt.width / 2, this.player ? this.player.fixedY : p.height - 60);
        // Target reticle at player lane
        const reticleY = this.player ? this.player.fixedY : p.height - 60;
        p.ellipse(bolt.x + bolt.width / 2, reticleY + 22, 30 + Math.sin(this.animTick * 0.5) * 6);
        // Warning text
        p.textFont('Press Start 2P');
        p.textSize(6);
        p.fill(250, 204, 21, pulseAlpha);
        p.noStroke();
        p.textAlign(p.CENTER);
        p.text('⚡', bolt.x + bolt.width / 2, reticleY + 40);
        p.textAlign(p.LEFT);
      } else if (bolt.phase === 'strike') {
        // Active lightning bolt: animated sprite descending from boss to player lane
        const lFrame = bolt.animFrame % 3;
        const lImg = this.sprites.lightning[lFrame];
        const boltStartY = bolt.y;
        const boltEndY = this.player ? this.player.fixedY + this.player.height : p.height - 20;
        const boltSegH = 48;

        // Draw multiple bolt segments vertically to span the gap
        for (let sy = boltStartY; sy < boltEndY; sy += boltSegH) {
          const segH = Math.min(boltSegH, boltEndY - sy);
          if (lImg && lImg.width > 0) {
            p.image(lImg, bolt.x, sy, bolt.width, segH);
          } else {
            // Procedural fallback: jagged purple line
            p.stroke(192, 132, 252, 230);
            p.strokeWeight(3);
            const midX = bolt.x + bolt.width / 2;
            const jag = (Math.random() - 0.5) * 14;
            p.line(midX + jag, sy, midX - jag, sy + segH);
          }
        }

        // Impact flash at player lane
        const impactAlpha = 200 - bolt.strikeTicks * 8;
        if (impactAlpha > 0) {
          p.fill(250, 204, 21, impactAlpha);
          p.noStroke();
          p.ellipse(bolt.x + bolt.width / 2, boltEndY, 36, 16);
        }
      } else if (bolt.phase === 'fade') {
        // Fading afterglow
        const fadeAlpha = Math.max(0, 150 - bolt.fadeTicks * 15);
        p.stroke(192, 132, 252, fadeAlpha);
        p.strokeWeight(1.5);
        const midX = bolt.x + bolt.width / 2;
        p.line(midX, bolt.y, midX, this.player ? this.player.fixedY + this.player.height : p.height - 20);
      }
    }

    // 4. Draw Player Lasers
    const pLaserImg = this.sprites.laserPlayer;
    for (const laser of this.playerLasers) {
      if (pLaserImg && pLaserImg.width > 0) {
        p.image(pLaserImg, laser.x, laser.y, laser.width, laser.height);
      } else {
        p.fill(56, 189, 248);
        p.noStroke();
        p.rect(laser.x, laser.y, laser.width, laser.height, 3);
      }
    }

    // 5. Draw Enemy Lasers
    const eLaserImg = this.sprites.laserEnemy;
    for (const laser of this.enemyLasers) {
      if (eLaserImg && eLaserImg.width > 0) {
        p.image(eLaserImg, laser.x, laser.y, laser.width, laser.height);
      } else {
        p.fill(239, 68, 68);
        p.noStroke();
        p.rect(laser.x, laser.y, laser.width, laser.height, 3);
      }
    }

    // 6. Draw Player Ship
    if (this.player) {
      const isFlashing = this.player.invulnerableTicks > 0 && Math.floor(this.animTick / 4) % 2 === 0;
      if (!isFlashing) {
        const shipImg = this.sprites.player;
        if (shipImg && shipImg.width > 0) {
          p.image(shipImg, this.player.x, this.player.y, this.player.width, this.player.height);
        } else {
          p.fill(56, 189, 248);
          p.stroke(255);
          p.strokeWeight(1.5);
          p.triangle(
            this.player.x + this.player.width / 2, this.player.y,
            this.player.x, this.player.y + this.player.height,
            this.player.x + this.player.width, this.player.y + this.player.height
          );
        }
      }
    }

    // 7. Draw Explosions
    for (const exp of this.explosions) {
      const frameImg = this.sprites.explosions[exp.currentFrame];
      if (frameImg && frameImg.width > 0) {
        p.image(frameImg, exp.x, exp.y, exp.size, exp.size);
      } else {
        p.fill(250, 204, 21, 200 - exp.currentFrame * 25);
        p.noStroke();
        p.ellipse(exp.x + exp.size / 2, exp.y + exp.size / 2, exp.size * (1 + exp.currentFrame * 0.15));
      }
    }

    p.pop();
  }

  _renderHUD(p) {
    p.push();
    p.textFont('Press Start 2P');
    p.textSize(10);
    p.noStroke();

    // In-canvas Lives indicator (left-aligned at y=76)
    p.fill(244, 63, 94);
    let hearts = '';
    for (let i = 0; i < this.state.lives; i++) hearts += '♥ ';
    p.text(`LIVES: ${hearts.trim()}`, 24, 76);

    // Target Objective display (for Easy mode or active objectives)
    if (this.difficultyKey === 'easy' && this.config.targetObjective) {
      p.fill(250, 204, 21);
      p.textSize(9);
      p.text(`TARGETS: ${this.targetsDestroyed} / ${this.config.targetObjective}`, 24, 98);
    } else if (this.miniBoss && this.miniBoss.isAlive) {
      p.fill(250, 204, 21);
      p.textSize(8);
      p.text(`ALERT: MINI-BOSS ENGAGED`, 24, 98);
    } else if (this.finalBoss && this.finalBoss.isAlive) {
      p.fill(192, 132, 252);
      p.textSize(8);
      p.text(`CRITICAL: BOSS LADY DETECTED`, 24, 98);
    }

    // In-canvas Controls Hint
    p.fill(148, 163, 184);
    p.textSize(8);
    const hint = this.gesture.isActive
      ? 'GESTURE CONTROL: PINCH TO SHOOT'
      : 'CONTROLS: LEFT/RIGHT + SPACEBAR TO SHOOT';
    p.text(hint, 24, p.height - 20);

    p.pop();
  }

  _saveFlightRecord() {
    if (this._flightRecordSaved) return;
    this._flightRecordSaved = true;

    try {
      if (typeof localStorage !== 'undefined') {
        const scoreKey = getScopedStorageKey('mindrush_high_score');
        const currentHigh = parseInt(localStorage.getItem(scoreKey) || '0', 10);
        if (this.state.score > currentHigh) {
          localStorage.setItem(scoreKey, String(this.state.score));
        }
      }
    } catch (e) {}

    // Dispatch verified score to backend with 'space-invader' mode
    if (this.state.score > 0 && typeof fetch !== 'undefined') {
      submitScoreToServer(this.state.score, this.config.id, 'space-invader').catch(() => {});
      try {
        fetch('/api/progress/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            highScore: this.state.score,
            insaneUnlocked: isInsaneUnlocked()
          })
        }).catch(() => {});
      } catch (e) {}
    }
  }

  pause() {
    if (this.state.isPlaying()) {
      this.state.pause();
    }
  }

  resume() {
    if (this.state.isPaused()) {
      this.ui.hidePauseModal();
      this.state.resume();
    }
  }

  togglePause() {
    if (this.state.isPlaying()) {
      this.pause();
    } else if (this.state.isPaused()) {
      this.resume();
    }
  }

  restart() {
    this._flightRecordSaved = false;
    this.targetsDestroyed = 0;
    this.easyCompleted = false;
    this.miniBoss = null;
    this.miniBossDefeated = false;
    this.finalBoss = null;
    this.finalBossDefeated = false;
    this.diveTimer = 0;

    this.state.reset();
    this.ui.hideAllModals();
    this.playerLasers = [];
    this.enemyLasers = [];
    this.explosions = [];
    this.lightningBolts = [];

    if (this.p5Instance) {
      this._initPlayer(this.p5Instance.width, this.p5Instance.height);
      this._initUFOFleet(this.p5Instance.width, this.p5Instance.height);
    }
  }

  exit() {
    if (this.state.score > 0 && !this.state.isGameOver()) {
      this._saveFlightRecord();
    }
    this.gesture.stop();
    window.location.href = 'difficulty-select.html?mode=invader';
  }

  proceedToNextLevel() {
    if (this.state.score > 0) {
      this._saveFlightRecord();
    }
    this.gesture.stop();
    const tiers = ['easy', 'medium', 'hard', 'insane'];
    const currIdx = tiers.indexOf(this.difficultyKey);
    if (currIdx >= 0 && currIdx < tiers.length - 1) {
      const nextTier = tiers[currIdx + 1];
      if (this.difficultyKey === 'hard') {
        unlockInsane();
      }
      window.location.href = `game.html?mode=invader&difficulty=${nextTier}`;
    } else {
      window.location.href = 'difficulty-select.html?mode=invader';
    }
  }

  declineNextLevel() {
    this.ui.hideNextLevelModal();
    this.state.resume();
  }
}
