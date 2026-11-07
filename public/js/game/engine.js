/**
 * MindRush — Core Game Engine
 * Orchestrates loop, collision, state, audio, paddle, spawner, and HUD
 */

import { GameState } from './state.js';
import { Paddle } from './paddle.js';
import { ObjectSpawner } from './objects.js';
import { CollisionSystem } from './collision.js';
import { AudioManager } from './audio.js';
import { InputManager } from './input.js';
import { UIManager } from './ui.js';
import { unlockInsane, isInsaneUnlocked } from './difficulty.js';
import { getUnlockedBadges } from './badges.js';
import { getScopedStorageKey, submitScoreToServer } from './storage.js';

export class GameEngine {
  constructor(difficultyConfig) {
    this.config = difficultyConfig;
    this.state = new GameState(3);
    this.audio = new AudioManager();
    this.input = new InputManager();
    this.ui = new UIManager();
    this.collision = new CollisionSystem();
    this.spawner = new ObjectSpawner(this.config);

    this.balls = [];
    this.paddle = null;
    this.p5Instance = null;
    this.floatingPopups = [];

    // Readiness & lifecycle management
    this.isReady = typeof window === 'undefined'; // Ready immediately in headless Node environments
    this.initError = null;
    this._isMounted = false;

    this._setupUI();
    this._setupVisibilityChange();
  }

  _setupUI() {
    this.ui.bindEvents({
      onResume: () => this.resume(),
      onRestart: () => this.restart(),
      onExit: () => this.exit(),
      onNextLevelYes: () => this.proceedToNextLevel(),
      onNextLevelNo: () => this.declineNextLevel(),
      onTogglePause: () => this.togglePause()
    });

    // Handle Escape key via InputManager
    this.input.onPauseToggle(() => {
      this.togglePause();
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
   * Mounts and boots the p5.js game sketch with lifecycle readiness checks
   * @param {HTMLElement} container
   */
  mount(container) {
    if (this._isMounted) {
      console.warn('[GameEngine] Already mounted. Skipping duplicate initialization.');
      return;
    }
    this._isMounted = true;

    const sketch = (p) => {
      this.p5Instance = p;

      p.setup = async () => {
        try {
          // If container is not passed or missing, fallback safely
          let targetContainer = container;
          if (!targetContainer && typeof document !== 'undefined') {
            targetContainer = document.getElementById('canvas-container') || document.body;
          }

          const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
          if (targetContainer) {
            canvas.parent(targetContainer);
          }

          this.paddle = new Paddle(this.config, p.width, p.height);

          // Verify document font readiness in browser if available
          if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.ready?.then === 'function') {
            try {
              await document.fonts.ready;
            } catch (fontErr) {
              console.warn('[GameEngine] Font readiness check warning (non-fatal):', fontErr);
            }
          }

          // Mark game engine as genuinely ready
          this.isReady = true;

          // Dismiss loading screen overlay
          this._dismissLoadingScreen();

          // Trigger welcome achievement after initial mount
          this._triggerOnLoadAchievement();
        } catch (err) {
          console.error('[GameEngine] Critical mounting error:', err);
          this.initError = err;
          this.isReady = false;
          this._showLoadingError(err);
        }
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        if (this.paddle) {
          this.paddle.update(this.input, p.width, p.height);
        }
      };

      p.draw = () => {
        this._gameLoop(p);
      };
    };

    // Instantiate p5 instance safely
    if (typeof window !== 'undefined' && window.p5) {
      new window.p5(sketch);
    }
  }

  /**
   * Dismisses the centered loading overlay smoothly
   */
  _dismissLoadingScreen() {
    if (typeof document === 'undefined') return;
    const loadEl = document.getElementById('p5_loading');
    if (!loadEl) return;
    loadEl.style.transition = 'opacity 0.25s ease, visibility 0.25s ease';
    loadEl.style.opacity = '0';
    loadEl.style.pointerEvents = 'none';
    setTimeout(() => {
      loadEl.style.display = 'none';
    }, 250);
  }

  /**
   * Renders a clear error and retry action in the loading container if initialization fails
   * @param {Error} err
   */
  _showLoadingError(err) {
    if (typeof document === 'undefined') return;
    const loadEl = document.getElementById('p5_loading');
    if (!loadEl) return;
    loadEl.style.display = 'flex';
    loadEl.style.opacity = '1';
    loadEl.style.pointerEvents = 'auto';

    const errorMsg = (err && err.message) ? err.message : 'Flight systems initialization failure';
    const box = loadEl.querySelector('.loading-box') || loadEl;
    box.innerHTML = `
      <div class="loading-orbit-spinner" style="filter: hue-rotate(140deg);">
        <div class="orbit-ring" style="border-top-color: #ef4444; border-bottom-color: #f59e0b;"></div>
        <div class="orbit-core">⚠️</div>
      </div>
      <div class="loading-title" style="color: #ef4444; text-shadow: 0 0 10px rgba(239, 68, 68, 0.5);">INITIALIZATION FAILED</div>
      <div class="loading-subtitle" style="margin-bottom: 20px; color: #cbd5e1;">${errorMsg}</div>
      <button id="btn-retry-loading" class="btn-game btn-primary" style="padding: 10px 24px; font-family: var(--font-arcade, monospace); font-size: 11px; cursor: pointer;">
        RETRY MISSION
      </button>
    `;
    const retryBtn = document.getElementById('btn-retry-loading');
    if (retryBtn) {
      retryBtn.onclick = () => window.location.reload();
    }
  }

  _triggerOnLoadAchievement() {
    if (this.config.achievements?.onLoad) {
      setTimeout(() => {
        const ach = this.config.achievements.onLoad;
        if (this.state.unlockAchievement(ach.id)) {
          this.ui.showAchievementToast(ach.name);
          this.audio.play('start');
        }
      }, 400);
    }
  }

  _gameLoop(p) {
    // Prevent gameplay loop from advancing invisibly behind active loading screen
    if (!this.isReady) {
      return;
    }

    p.background(0);

    // State 1: Game Over
    if (this.state.isGameOver()) {
      if (!this.state.gameOverHandled) {
        this.state.gameOverHandled = true;
        this.audio.play('gameOver');
        this._saveFlightRecord();
        this.ui.showGameOverModal(this.state.score);
      }

      // Render static snapshot
      this._renderScene(p);
      this._renderHUD(p);
      return;
    }

    // State 2: Paused
    if (this.state.isPaused()) {
      this.ui.showPauseModal();
      this._renderScene(p);
      this._renderHUD(p);
      return;
    }

    // State 3: Active Playing
    this.ui.hidePauseModal();

    // Check Next Level milestone
    if (
      this.config.nextLevel &&
      this.state.score >= this.config.nextLevel.threshold &&
      !this.state.nextLevelShown
    ) {
      this.state.nextLevelShown = true;
      if (this.config.id === 'hard') {
        unlockInsane();
      }
      this.pause();
      this.audio.play('levelUp');
      this.ui.showNextLevelModal(this.config.nextLevel.message);
      return;
    }

    // Check Score Milestones for Achievements
    this._checkScoreAchievements();

    // Update paddle
    if (this.paddle) {
      this.paddle.update(this.input, p.width, p.height);
    }

    // Spawn falling objects
    const newBall = this.spawner.spawnIfReady(p.frameCount, this.balls.length, p.width, this.state.score);
    if (newBall) {
      this.balls.push(newBall);
    }

    // Update & check collisions with reverse iteration (Fixes forward-splice skipping bug)
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];
      ball.update();

      // Check offscreen
      if (ball.isOffscreen(p.height)) {
        this.balls.splice(i, 1);
        continue;
      }

      // Check paddle collision
      if (this.paddle && this.collision.checkCollision(this.paddle, ball)) {
        const outcome = this.collision.resolveCollision(ball, this.state, this.audio);
        this.balls.splice(i, 1);
        if (outcome && !outcome.ignored) {
          let text = '';
          let color = [255, 255, 255];
          if (outcome.points > 0) {
            text = `+${outcome.points}`;
            color = [0, 255, 180];
          } else if (outcome.points < 0) {
            text = `${outcome.points}`;
            color = [255, 60, 80];
          }
          if (outcome.lifeDelta > 0) {
            text = `+${outcome.lifeDelta} LIFE ❤️`;
            color = [255, 100, 180];
          } else if (outcome.lifeDelta < 0) {
            text = `${outcome.lifeDelta} LIFE 💔`;
            color = [255, 40, 50];
          }
          if (text) {
            this.floatingPopups.push({
              text,
              x: ball.x,
              y: this.paddle.y - 12,
              color,
              alpha: 255,
              ticks: 0
            });
          }
        }
        continue;
      }

      // Render falling object
      ball.draw(p);
    }

    // Render paddle & HUD
    if (this.paddle) {
      this.paddle.display(p);
    }
    this._renderHUD(p);
  }

  _renderScene(p) {
    for (const ball of this.balls) {
      ball.draw(p);
    }
    if (this.paddle) {
      this.paddle.display(p);
    }

    // Render & animate floating score/hazard popups
    for (let j = this.floatingPopups.length - 1; j >= 0; j--) {
      const pop = this.floatingPopups[j];
      pop.y -= 1.2;
      pop.ticks++;
      pop.alpha = Math.max(0, 255 - pop.ticks * 5);

      p.push();
      p.textFont('Press Start 2P');
      p.textSize(12);
      p.textAlign(p.CENTER, p.CENTER);
      p.fill(pop.color[0], pop.color[1], pop.color[2], pop.alpha);
      p.noStroke();
      p.text(pop.text, pop.x, pop.y);
      p.pop();

      if (pop.alpha <= 0) {
        this.floatingPopups.splice(j, 1);
      }
    }
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

    // Dispatch background server sync if connected
    if (this.state.score > 0 && typeof fetch !== 'undefined') {
      submitScoreToServer(this.state.score, this.config.id).catch(() => {});
      try {
        fetch('/api/progress/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            badges: getUnlockedBadges(),
            highScore: this.state.score,
            insaneUnlocked: isInsaneUnlocked()
          })
        }).catch(() => {});
      } catch (e) {}
    }
  }

  _renderHUD(p) {
    p.push();
    p.fill(255);
    p.noStroke();
    p.textFont('Press Start 2P');

    // Lives indicator positioned clearly below the HTML topbar overlay
    // (Score is displayed in the styled #hud-score-tag in the topbar)
    p.textSize(16);
    p.textAlign(p.LEFT, p.TOP);
    p.fill(255, 90, 110);
    p.text(`Lives: ${this.state.lives}`, 24, 76);

    p.pop();

    // Synchronize HTML topbar score display immediately on change
    if (typeof document !== 'undefined') {
      const hudScoreEl = document.getElementById('hud-score-val');
      if (hudScoreEl && hudScoreEl.textContent !== String(this.state.score)) {
        hudScoreEl.textContent = String(this.state.score);
      }
    }
  }

  _checkScoreAchievements() {
    const achs = this.config.achievements;
    if (!achs) return;

    if (achs.score500 && this.state.score >= 500) {
      if (this.state.unlockAchievement(achs.score500.id)) {
        this.ui.showAchievementToast(achs.score500.name);
        this.audio.play('goldenBall');
      }
    }

    if (achs.score1000 && this.state.score >= 1000) {
      if (this.state.unlockAchievement(achs.score1000.id)) {
        this.ui.showAchievementToast(achs.score1000.name);
        this.audio.play('goldenBall');
      }
    }
  }

  pause() {
    this.state.pause();
    this.ui.showPauseModal();
  }

  resume() {
    this.state.resume();
    this.ui.hidePauseModal();
  }

  togglePause() {
    if (this.state.isGameOver()) return;
    if (this.state.isPlaying()) {
      this.pause();
    } else {
      this.resume();
    }
  }

  restart() {
    this.state.reset();
    this.balls = [];
    this.floatingPopups = [];
    this.spawner.reset();
    if (typeof document !== 'undefined') {
      const hudScoreEl = document.getElementById('hud-score-val');
      if (hudScoreEl) hudScoreEl.textContent = '0';
    }
    this.ui.hideAllModals();
    this._triggerOnLoadAchievement();
  }

  exit() {
    if (this.state.score > 0 && !this.state.isGameOver()) {
      this._saveFlightRecord();
    }
    window.location.href = 'dashboard.html';
  }

  proceedToNextLevel() {
    if (this.state.score > 0) {
      this._saveFlightRecord();
    }
    if (this.config.nextLevel?.target) {
      window.location.href = `game.html?difficulty=${this.config.nextLevel.target}`;
    }
  }

  declineNextLevel() {
    this.ui.hideNextLevelModal();
    this.resume();
  }
}
