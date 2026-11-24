/**
 * MindRush — Input Manager (Phase 3: Gesture Controls + Keyboard Safe Mode)
 * Extensible input abstraction that maps mouse, keyboard, and gesture input to game actions.
 *
 * Control modes:
 *   'keyboard' — Arrow keys / A-D move the paddle, Spacebar shoots.
 *   'gesture'  — An external gesture module drives paddle via setTargetX().
 *
 * Mouse / pointer / touch input is DISABLED during active gameplay in ALL modes
 * (mouseEnabled defaults true for backward compat; engines set it false).
 */

export class InputManager {
  constructor() {
    // --- Existing state (preserved) ---
    this.currentX = typeof window !== 'undefined' ? window.innerWidth / 2 : 400;
    this.mouseEnabled = true;          // backward-compat default; engines disable it
    this.pauseCallbacks = [];

    // --- Phase 3 additions ---
    /** @type {'gesture'|'keyboard'} */
    this.controlMode = 'keyboard';
    this.gestureActive = false;
    /** @type {Map<string, boolean>} Currently-pressed keys */
    this.keysDown = new Map();
    this.shootCallbacks = [];

    this._bindEvents();
  }

  // ---------------------------------------------------------------------------
  // Event binding
  // ---------------------------------------------------------------------------

  _bindEvents() {
    if (typeof window === 'undefined') return;

    // Track pointer movement (supports mouse, stylus, and touch pointers)
    window.addEventListener('pointermove', (e) => {
      if (this.mouseEnabled && this.controlMode === 'keyboard' && typeof e.clientX === 'number') {
        this.currentX = e.clientX;
      }
    });

    // Fallback track mouse movement
    window.addEventListener('mousemove', (e) => {
      if (this.mouseEnabled && this.controlMode === 'keyboard' && typeof e.clientX === 'number') {
        this.currentX = e.clientX;
      }
    });

    // Touch movement for mobile and tablet testing
    window.addEventListener('touchmove', (e) => {
      if (this.mouseEnabled && this.controlMode === 'keyboard' && e.touches && e.touches.length > 0) {
        this.currentX = e.touches[0].clientX;
      }
    }, { passive: true });

    // --- Keyboard tracking (Phase 3) ---
    window.addEventListener('keydown', (e) => {
      // Escape ALWAYS fires regardless of control mode
      if (e.key === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        this.triggerPauseToggle();
        return;
      }

      // In Gesture Mode: strictly ignore ALL gameplay keyboard inputs (Arrow keys, A/D, Space, etc.)
      if (this.controlMode === 'gesture') {
        return;
      }

      // Track key state by both key and code
      this.keysDown.set(e.key, true);
      if (e.code) this.keysDown.set(e.code, true);

      // Spacebar → shoot
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        this.triggerShoot();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.controlMode === 'gesture') return;
      this.keysDown.delete(e.key);
      if (e.code) this.keysDown.delete(e.code);
    });

    // Clear pressed-key map when window loses focus (prevents stuck keys)
    window.addEventListener('blur', () => {
      this.keysDown.clear();
    });
  }

  // ---------------------------------------------------------------------------
  // Pause (existing public API — preserved)
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Shoot (Phase 3)
  // ---------------------------------------------------------------------------

  /**
   * Registers a callback for when shoot is triggered (Spacebar in keyboard mode)
   * @param {Function} cb
   */
  onShoot(cb) {
    if (typeof cb === 'function') {
      this.shootCallbacks.push(cb);
    }
  }

  /**
   * Triggers registered shoot listeners
   */
  triggerShoot() {
    if (this.controlMode === 'gesture') return;
    for (const cb of this.shootCallbacks) {
      cb();
    }
  }

  // ---------------------------------------------------------------------------
  // Paddle position (existing public API — preserved)
  // ---------------------------------------------------------------------------

  /**
   * Returns current paddle X target position, constrained to canvas width
   * @param {number} canvasWidth
   * @param {number} paddleWidth
   * @returns {number}
   */
  getPaddleX(canvasWidth, paddleWidth) {
    const halfW = paddleWidth / 2;
    const minCenter = halfW;
    const maxCenter = Math.max(minCenter, canvasWidth - halfW);
    const clampedCenter = Math.max(minCenter, Math.min(this.currentX, maxCenter));
    return Math.max(0, Math.min(clampedCenter - halfW, canvasWidth - paddleWidth));
  }

  // ---------------------------------------------------------------------------
  // Keyboard movement query (Phase 3)
  // ---------------------------------------------------------------------------

  /**
   * Returns the current horizontal movement intent from the keyboard.
   * @returns {-1|0|1}  -1 = left, 0 = idle, +1 = right
   */
  getMovementDelta() {
    if (this.controlMode === 'gesture') return 0;
    const left  = this.keysDown.has('ArrowLeft')  || this.keysDown.has('KeyA') || this.keysDown.has('a') || this.keysDown.has('A');
    const right = this.keysDown.has('ArrowRight') || this.keysDown.has('KeyD') || this.keysDown.has('d') || this.keysDown.has('D');
    if (left && !right) return -1;
    if (right && !left) return  1;
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Control mode (Phase 3)
  // ---------------------------------------------------------------------------

  /**
   * Switch between 'gesture' and 'keyboard' control modes.
   * Mouse/pointer/touch input stays disabled in both modes during gameplay.
   * @param {'gesture'|'keyboard'} mode
   */
  setControlMode(mode) {
    if (mode === 'gesture') {
      this.controlMode = 'gesture';
      this.mouseEnabled = false;
      this.gestureActive = true;
      this.keysDown.clear();
    } else {
      // Default to keyboard
      this.controlMode = 'keyboard';
      this.mouseEnabled = false;   // mouse disabled during gameplay per spec
      this.gestureActive = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Mouse enable/disable (existing public API — preserved)
  // ---------------------------------------------------------------------------

  /**
   * Enable/disable mouse input (backward compat; engines disable during gameplay)
   * @param {boolean} enabled
   */
  setMouseEnabled(enabled) {
    this.mouseEnabled = !!enabled;
  }

  // ---------------------------------------------------------------------------
  // Direct coordinate override (existing public API — preserved)
  // ---------------------------------------------------------------------------

  /**
   * Direct coordinate override — gesture module calls this to position paddle
   * @param {number} x
   */
  setTargetX(x) {
    this.currentX = x;
  }

  // ---------------------------------------------------------------------------
  // Cursor helpers (Phase 3)
  // ---------------------------------------------------------------------------

  /**
   * Hides the system cursor by adding a CSS class to document.body.
   * The class 'gesture-active-cursor' should set `cursor: none` in CSS.
   */
  hideCursor() {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.add('gesture-active-cursor');
    }
  }

  /**
   * Restores the system cursor by removing the gesture-active CSS class.
   */
  restoreCursor() {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.remove('gesture-active-cursor');
    }
  }
}
