/**
 * MindRush — Input Manager
 * Extensible input abstraction that maps mouse, keyboard, and future gesture input to game actions
 */

export class InputManager {
  constructor() {
    this.currentX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
    this.mouseEnabled = true;
    this.pauseCallbacks = [];

    this._bindEvents();
  }

  _bindEvents() {
    if (typeof window === 'undefined') return;

    // Track pointer movement (supports mouse, stylus, and touch pointers)
    window.addEventListener('pointermove', (e) => {
      if (this.mouseEnabled && typeof e.clientX === 'number') {
        this.currentX = e.clientX;
      }
    });

    // Fallback track mouse movement
    window.addEventListener('mousemove', (e) => {
      if (this.mouseEnabled && typeof e.clientX === 'number') {
        this.currentX = e.clientX;
      }
    });

    // Touch movement for mobile and tablet testing
    window.addEventListener('touchmove', (e) => {
      if (this.mouseEnabled && e.touches && e.touches.length > 0) {
        this.currentX = e.touches[0].clientX;
      }
    }, { passive: true });

    // Listen for Escape key to pause
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        this.triggerPauseToggle();
      }
    });
  }

  /**
   * Registers a callback for when pause is triggered via Escape key
   * @param {Function} cb
   */
  onPauseToggle(cb) {
    if (typeof cb === 'function') {
      this.pauseCallbacks.push(cb);
    }
  }

  /**
   * Triggers registered pause listeners
   */
  triggerPauseToggle() {
    for (const cb of this.pauseCallbacks) {
      cb();
    }
  }

  /**
   * Returns current paddle X target position, constrained to canvas width
   * @param {number} canvasWidth
   * @param {number} paddleWidth
   * @returns {number}
   */
  getPaddleX(canvasWidth, paddleWidth) {
    const rawX = this.currentX - paddleWidth / 2;
    return Math.max(0, Math.min(rawX, canvasWidth - paddleWidth));
  }

  /**
   * Enable/disable mouse input (for future gesture or keyboard overrides)
   * @param {boolean} enabled
   */
  setMouseEnabled(enabled) {
    this.mouseEnabled = !!enabled;
  }

  /**
   * Direct coordinate override (for future gesture controller)
   * @param {number} x
   */
  setTargetX(x) {
    this.currentX = x;
  }
}
