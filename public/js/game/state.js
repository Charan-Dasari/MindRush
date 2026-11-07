/**
 * MindRush — Game State Management
 * Clean state machine managing scores, lives, transitions, and achievement unlocks
 */

export const GAME_STATES = {
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over'
};

export class GameState {
  constructor(initialLives = 3) {
    this.initialLives = initialLives;
    this.current = GAME_STATES.PLAYING;
    this.score = 0;
    this.lives = this.initialLives;
    this.gameOverHandled = false;
    this.unlockedAchievements = new Set();
    this.nextLevelShown = false;
    this.listeners = [];
  }

  /**
   * Resets all game metrics to initial clean state
   */
  reset() {
    this.current = GAME_STATES.PLAYING;
    this.score = 0;
    this.lives = this.initialLives;
    this.gameOverHandled = false;
    this.unlockedAchievements.clear();
    this.nextLevelShown = false;
    this._notify();
  }

  isPlaying() {
    return this.current === GAME_STATES.PLAYING;
  }

  isPaused() {
    return this.current === GAME_STATES.PAUSED;
  }

  isGameOver() {
    return this.current === GAME_STATES.GAME_OVER;
  }

  pause() {
    if (this.current === GAME_STATES.PLAYING) {
      this.current = GAME_STATES.PAUSED;
      this._notify();
    }
  }

  resume() {
    if (this.current === GAME_STATES.PAUSED) {
      this.current = GAME_STATES.PLAYING;
      this._notify();
    }
  }

  togglePause() {
    if (this.current === GAME_STATES.PLAYING) {
      this.pause();
    } else if (this.current === GAME_STATES.PAUSED) {
      this.resume();
    }
  }

  setGameOver() {
    this.current = GAME_STATES.GAME_OVER;
    this._notify();
  }

  triggerGameOver() {
    this.setGameOver();
  }

  addScore(amount) {
    const val = Number(amount);
    if (!isNaN(val)) {
      this.score = Math.max(0, Math.floor(this.score + val));
      this._notify();
    }
  }

  modifyLives(amount) {
    const val = Number(amount);
    if (!isNaN(val)) {
      this.lives = Math.max(0, Math.floor(this.lives + val));
      if (this.lives === 0) {
        this.setGameOver();
      }
      this._notify();
    }
  }

  /**
   * Attempts to unlock an achievement. Returns true if newly unlocked.
   * @param {string} id
   * @returns {boolean}
   */
  unlockAchievement(id) {
    if (this.unlockedAchievements.has(id)) {
      return false;
    }
    this.unlockedAchievements.add(id);
    return true;
  }

  onChange(cb) {
    if (typeof cb === 'function') {
      this.listeners.push(cb);
    }
  }

  _notify() {
    for (const cb of this.listeners) {
      cb(this);
    }
  }
}
