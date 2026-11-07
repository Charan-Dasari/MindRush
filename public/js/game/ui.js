/**
 * MindRush — UI Manager
 * Handles responsive overlays for Pause, Game Over, Next Level, and Achievement Toasts
 */

export class UIManager {
  constructor() {
    if (typeof document !== 'undefined') {
      this.pauseModal = document.getElementById('pause-modal');
      this.gameOverModal = document.getElementById('game-over-modal');
      this.nextLevelModal = document.getElementById('next-level-modal');
      this.achievementToast = document.getElementById('achievement-toast');
      this.achievementNameEl = document.getElementById('achievement-toast-name');
      this.finalScoreEl = document.getElementById('final-score-val');
      this.pauseBtn = document.getElementById('btn-pause-header');
    } else {
      this.pauseModal = null;
      this.gameOverModal = null;
      this.nextLevelModal = null;
      this.achievementToast = null;
      this.achievementNameEl = null;
      this.finalScoreEl = null;
      this.pauseBtn = null;
    }

    this.toastTimer = null;
  }

  /**
   * Binds UI events for buttons
   * @param {object} handlers
   */
  bindEvents({ onResume, onRestart, onExit, onNextLevelYes, onNextLevelNo, onTogglePause }) {
    if (typeof document === 'undefined') return;
    // Header Pause button
    if (this.pauseBtn) {
      this.pauseBtn.addEventListener('click', () => onTogglePause());
    }

    // Pause Modal Buttons
    const resumeBtn = document.getElementById('btn-pause-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', () => onResume());

    const restartBtn = document.getElementById('btn-pause-restart');
    if (restartBtn) restartBtn.addEventListener('click', () => onRestart());

    const exitBtn = document.getElementById('btn-pause-exit');
    if (exitBtn) exitBtn.addEventListener('click', () => onExit());

    // Game Over Modal Buttons
    const playAgainBtn = document.getElementById('btn-gameover-restart');
    if (playAgainBtn) playAgainBtn.addEventListener('click', () => onRestart());

    const gameOverExitBtn = document.getElementById('btn-gameover-exit');
    if (gameOverExitBtn) gameOverExitBtn.addEventListener('click', () => onExit());

    // Next Level Modal Buttons
    const nextYesBtn = document.getElementById('btn-nextlevel-yes');
    if (nextYesBtn) nextYesBtn.addEventListener('click', () => onNextLevelYes());

    const nextNoBtn = document.getElementById('btn-nextlevel-no');
    if (nextNoBtn) nextNoBtn.addEventListener('click', () => onNextLevelNo());
  }

  showPauseModal() {
    if (this.pauseModal) this.pauseModal.classList.add('active');
  }

  hidePauseModal() {
    if (this.pauseModal) this.pauseModal.classList.remove('active');
  }

  showGameOverModal(finalScore) {
    if (this.finalScoreEl) {
      this.finalScoreEl.textContent = String(finalScore);
    }
    if (this.gameOverModal) {
      this.gameOverModal.classList.add('active');
    }
  }

  hideGameOverModal() {
    if (this.gameOverModal) this.gameOverModal.classList.remove('active');
  }

  showNextLevelModal(message) {
    if (typeof document === 'undefined') return;
    const msgEl = document.getElementById('next-level-message');
    if (msgEl && message) {
      msgEl.textContent = message;
    }
    if (this.nextLevelModal) {
      this.nextLevelModal.classList.add('active');
    }
  }

  hideNextLevelModal() {
    if (this.nextLevelModal) this.nextLevelModal.classList.remove('active');
  }

  /**
   * Displays an achievement toast for 3 seconds
   * @param {string} title
   */
  showAchievementToast(title) {
    if (!this.achievementToast) return;
    if (this.achievementNameEl) {
      this.achievementNameEl.textContent = title;
    }

    this.achievementToast.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);

    this.toastTimer = setTimeout(() => {
      this.achievementToast.classList.remove('show');
    }, 3000);
  }

  hideAllModals() {
    this.hidePauseModal();
    this.hideGameOverModal();
    this.hideNextLevelModal();
  }
}
