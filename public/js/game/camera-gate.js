/**
 * MindRush — Camera Initialization Gate & Runtime Health Manager
 *
 * Implements a strict prerequisite gate for Gesture Controls:
 * 1. Blocks game loop, object spawning, and timers until gesture recognition is verified.
 * 2. Provides sequential loading status UI:
 *    - Requesting camera permission...
 *    - Initializing camera...
 *    - Loading gesture recognition model...
 *    - Waiting for hand detection...
 *    - Gesture controls ready.
 * 3. On failure (denied, unavailable, model failure):
 *    - Cancels game start.
 *    - Keeps game loop stopped.
 *    - Displays explicit choices: RETRY CAMERA vs SWITCH TO KEYBOARD MODE.
 *    - Does NOT automatically fall back without user consent.
 * 4. Bypasses camera entirely when Keyboard Mode is configured.
 * 5. Handles runtime camera disconnection safely by pausing and preserving match state.
 * 6. Prevents race conditions with cancellation tokens and single-start guards.
 */

import { getGameSettings, saveGameSettings } from './settings.js';

export class CameraGate {
  /**
   * @param {object} opts
   * @param {object} opts.engine - GameEngine, SpaceInvaderEngine, or EducationalInvaderEngine
   * @param {object} opts.gestureInput - GestureInputManager instance
   * @param {function} [opts.onReady] - Callback when gate opens and active gameplay begins
   * @param {function} [opts.onFailure] - Callback when camera initialization fails
   */
  constructor({ engine, gestureInput, onReady, onFailure } = {}) {
    this.engine = engine;
    this.gestureInput = gestureInput || (engine ? (engine.gestureInput || engine.gesture) : null);
    this.onReady = onReady;
    this.onFailure = onFailure;

    this.isGateOpen = false;
    this.isInitializing = false;
    this.hasGameStarted = false;
    this.initSessionId = 0;

    this.status = 'idle'; // idle | requesting_permission | initializing_camera | loading_model | waiting_hand | ready | error
    this.lastError = null;

    // DOM element references
    this.loadingScreen = null;
    this.loadingBox = null;
    this.loadingTitle = null;
    this.loadingSubtitle = null;
    this.loadingSpinner = null;
    this.errorActions = null;
    this.retryBtn = null;
    this.keyboardBtn = null;
    this.disconnectModal = null;

    if (typeof document !== 'undefined') {
      this._initDOMElements();
    }
  }

  _initDOMElements() {
    this.loadingScreen = document.getElementById('p5_loading');
    this.loadingBox = document.getElementById('loading-box-content') || (this.loadingScreen ? this.loadingScreen.querySelector('.loading-box') : null);
    this.loadingTitle = document.getElementById('loading-title-el') || (this.loadingScreen ? this.loadingScreen.querySelector('.loading-title') : null);
    this.loadingSubtitle = document.getElementById('loading-subtitle-el') || (this.loadingScreen ? this.loadingScreen.querySelector('.loading-subtitle, .loading-subtext') : null);
    this.loadingSpinner = document.getElementById('loading-spinner') || (this.loadingScreen ? this.loadingScreen.querySelector('.loading-orbit-spinner') : null);
    this.errorActions = document.getElementById('loading-error-actions');
    this.retryBtn = document.getElementById('btn-gate-retry');
    this.keyboardBtn = document.getElementById('btn-gate-keyboard');
    this.disconnectModal = document.getElementById('runtime-disconnect-modal');

    if (this.retryBtn) {
      this.retryBtn.onclick = (e) => {
        e.preventDefault();
        this.retry();
      };
    }
    if (this.keyboardBtn) {
      this.keyboardBtn.onclick = (e) => {
        e.preventDefault();
        this.switchToKeyboard();
      };
    }

    const runtimeRetryBtn = document.getElementById('btn-disconnect-retry');
    const runtimeKbBtn = document.getElementById('btn-disconnect-keyboard');
    if (runtimeRetryBtn) {
      runtimeRetryBtn.onclick = (e) => {
        e.preventDefault();
        this.retryRuntimeCamera();
      };
    }
    if (runtimeKbBtn) {
      runtimeKbBtn.onclick = (e) => {
        e.preventDefault();
        this.switchToKeyboardRuntime();
      };
    }
  }

  /**
   * Evaluates control settings and starts either the camera gate sequence or direct keyboard gameplay
   * @returns {Promise<boolean>} Resolves true when gate opens, false on failure/cancellation
   */
  async start() {
    if (this.hasGameStarted) {
      console.warn('[CameraGate] Game already started. Ignoring duplicate start call.');
      return this.isGateOpen;
    }

    if (this.isInitializing) {
      console.warn('[CameraGate] Initialization already in progress. Ignoring duplicate call.');
      return false;
    }

    const settings = getGameSettings();

    // ------------------------------------------------------------------
    // Branch 1: Keyboard Mode is selected -> Direct bypass
    // ------------------------------------------------------------------
    if (settings && settings.controlMethod === 'keyboard') {
      return this._startWithKeyboardDirect();
    }

    // ------------------------------------------------------------------
    // Branch 2: Gesture Mode is selected -> Camera Gate sequence
    // ------------------------------------------------------------------
    return this._startWithGestureGate();
  }

  /**
   * Bypasses camera and MediaPipe entirely when Keyboard Mode is selected
   * @private
   */
  _startWithKeyboardDirect() {
    this.isGateOpen = true;
    this.isInitializing = false;
    this.status = 'ready';

    if (this.gestureInput && typeof this.gestureInput.switchToKeyboard === 'function') {
      this.gestureInput.switchToKeyboard();
    }
    if (this.engine) {
      if (this.engine.input && typeof this.engine.input.setControlMode === 'function') {
        this.engine.input.setControlMode('keyboard');
      }
      this.engine.isReady = true;
    }

    this._updateHUD('KEYBOARD ACTIVE', 'standby');
    this._dismissLoading();
    this._unlockGameplay();
    return true;
  }

  /**
   * Executes the 5-step camera verification gate
   * @private
   */
  async _startWithGestureGate() {
    this.isGateOpen = false;
    this.isInitializing = true;
    this.lastError = null;

    if (this.engine) {
      this.engine.isReady = false;
    }

    // Allocate new session token to invalidate stale async calls
    const currentSession = ++this.initSessionId;

    this._showLoadingScreen();
    this._hideErrorActions();

    try {
      // Step 1: Requesting camera permission...
      this.status = 'requesting_permission';
      this._updateLoadingText('INITIALIZING GESTURE SENSOR...', 'Requesting camera permission...');
      this._updateHUD('CAMERA: REQUESTING ACCESS', 'standby');

      if (!this.gestureInput) {
        throw new Error('GestureInputManager is not available');
      }

      // Check cancellation before hardware request
      if (this.initSessionId !== currentSession) return false;

      // Request media stream and initialize MediaPipe
      // Step 2 & 3: Initializing camera & loading model
      this.status = 'initializing_camera';
      this._updateLoadingText('INITIALIZING GESTURE SENSOR...', 'Initializing camera & loading gesture model...');
      this._updateHUD('CAMERA: INITIALIZING', 'standby');

      await this.gestureInput.init({
        onProgress: (stepMsg) => {
          if (this.initSessionId === currentSession) {
            this._updateLoadingText('INITIALIZING GESTURE SENSOR...', stepMsg);
          }
        }
      });

      if (this.initSessionId !== currentSession) {
        // Cancelled by player (e.g. clicked keyboard mode while loading)
        this.gestureInput.stop();
        return false;
      }

      // Step 4: Waiting for hand detection / verifying inference loop
      this.status = 'waiting_hand';
      this._updateLoadingText('VERIFYING HAND TRACKING...', 'Waiting for hand detection...');
      this._updateHUD('CAMERA: READY (TRACKING)', 'standby');

      // Verify inference loop is active
      if (!this.gestureInput.isActive) {
        throw new Error('Hand tracking pipeline failed to activate');
      }

      // Step 5: Gesture controls ready
      this.status = 'ready';
      this._updateLoadingText('READY FOR LAUNCH!', 'Gesture controls ready.');
      this._updateHUD('GESTURE ACTIVE', 'active');

      // Brief delay to allow player to see ready status
      await new Promise(r => setTimeout(r, 220));
      if (this.initSessionId !== currentSession) return false;

      // Gate successfully passed!
      this.isGateOpen = true;
      this.isInitializing = false;

      if (this.engine) {
        if (this.engine.input && typeof this.engine.input.setControlMode === 'function') {
          this.engine.input.setControlMode('gesture');
          if (typeof this.engine.input.hideCursor === 'function') {
            this.engine.input.hideCursor();
          }
        }
        this.engine.isReady = true;
      }

      this._dismissLoading();
      this._unlockGameplay();
      return true;

    } catch (err) {
      if (this.initSessionId !== currentSession) {
        // Discard stale error from cancelled session
        return false;
      }

      console.warn('[CameraGate] Initialization failed:', err.message || err);
      this.lastError = err;
      this.status = 'error';
      this.isGateOpen = false;
      this.isInitializing = false;

      if (this.engine) {
        this.engine.isReady = false;
      }

      // Stop any partial camera streams/listeners
      if (this.gestureInput && typeof this.gestureInput.stop === 'function') {
        this.gestureInput.stop();
      }

      this._displayErrorUI(err);
      if (typeof this.onFailure === 'function') {
        this.onFailure(err);
      }
      return false;
    }
  }

  /**
   * Displays the failure UI with explicit Retry and Switch to Keyboard choices
   * @param {Error} err
   * @private
   */
  _displayErrorUI(err) {
    const errorText = this._formatErrorMessage(err);

    this._updateLoadingText('CAMERA INITIALIZATION FAILED', errorText);
    this._updateHUD('CAMERA ACCESS DENIED / FAILED', 'error');

    if (this.loadingSpinner) {
      this.loadingSpinner.style.display = 'none';
    }
    if (this.errorActions) {
      this.errorActions.style.display = 'flex';
      this.errorActions.classList.remove('hidden');
    }
  }

  _formatErrorMessage(err) {
    const msg = (err && err.message) ? err.message : String(err || '');
    if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
      return 'Camera permission was denied. Please allow camera access in your browser or switch to Keyboard Mode.';
    }
    if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
      return 'No webcam was detected on this device. Please connect a camera or switch to Keyboard Mode.';
    }
    if (msg.includes('NotReadableError') || msg.includes('TrackStartError')) {
      return 'Webcam is currently in use by another application. Free the camera or switch to Keyboard Mode.';
    }
    return `Unable to start gesture tracking: ${msg || 'Model or camera initialization failed'}.`;
  }

  /**
   * Retries camera initialization
   */
  async retry() {
    this._hideErrorActions();
    if (this.loadingSpinner) {
      this.loadingSpinner.style.display = 'flex';
    }
    return this._startWithGestureGate();
  }

  /**
   * User explicitly selected Keyboard Mode from the failure screen
   */
  switchToKeyboard() {
    // Invalidate any pending camera session
    this.initSessionId++;
    this.isInitializing = false;

    // Dispose partial resources
    if (this.gestureInput && typeof this.gestureInput.stop === 'function') {
      this.gestureInput.stop();
    }
    if (this.gestureInput && typeof this.gestureInput.switchToKeyboard === 'function') {
      this.gestureInput.switchToKeyboard();
    }

    // Persist choice
    saveGameSettings({ controlMethod: 'keyboard' });

    // Open gate and configure keyboard
    this.isGateOpen = true;
    this.status = 'ready';

    if (this.engine) {
      if (this.engine.input && typeof this.engine.input.setControlMode === 'function') {
        this.engine.input.setControlMode('keyboard');
      }
      this.engine.isReady = true;
    }

    this._updateHUD('KEYBOARD ACTIVE', 'standby');
    this._dismissLoading();
    this._unlockGameplay();
  }

  /**
   * Handles runtime camera disconnection during active gameplay
   * @param {string} msg
   */
  handleRuntimeDisconnect(msg) {
    if (!this.hasGameStarted || !this.isGateOpen) return;

    console.warn('[CameraGate] Runtime camera disconnect handled:', msg);

    // Stop gesture input immediately
    if (this.gestureInput) {
      this.gestureInput.isActive = false;
      this.gestureInput.isHandPresent = false;
      this.gestureInput._isFistActive = false;
      if (typeof this.gestureInput.stop === 'function') {
        this.gestureInput.stop();
      }
    }

    // Safely pause active gameplay without resetting state
    if (this.engine && typeof this.engine.pause === 'function') {
      this.engine.pause();
    }

    this._updateHUD('CAMERA DISCONNECTED', 'error');

    // Show runtime disconnect modal
    if (this.disconnectModal) {
      this.disconnectModal.classList.add('active');
    }
  }

  /**
   * Retries reconnecting camera during a paused runtime session
   */
  async retryRuntimeCamera() {
    if (this.disconnectModal) {
      this.disconnectModal.classList.remove('active');
    }
    this._showLoadingScreen();
    this._hideErrorActions();

    const ok = await this._startWithGestureGate();
    if (ok) {
      // Resume preserved match
      if (this.engine && typeof this.engine.resume === 'function') {
        this.engine.resume();
      }
    } else {
      if (this.disconnectModal) {
        this.disconnectModal.classList.add('active');
      }
    }
  }

  /**
   * Switches to keyboard during a paused runtime session without resetting progress
   */
  switchToKeyboardRuntime() {
    if (this.disconnectModal) {
      this.disconnectModal.classList.remove('active');
    }

    // Persist choice
    saveGameSettings({ controlMethod: 'keyboard' });

    if (this.gestureInput && typeof this.gestureInput.switchToKeyboard === 'function') {
      this.gestureInput.switchToKeyboard();
    }
    if (this.engine && this.engine.input && typeof this.engine.input.setControlMode === 'function') {
      this.engine.input.setControlMode('keyboard');
    }

    this._updateHUD('KEYBOARD ACTIVE', 'standby');

    // Resume preserved gameplay
    if (this.engine && typeof this.engine.resume === 'function') {
      this.engine.resume();
    }
  }

  /**
   * Starts active gameplay exactly once
   * @private
   */
  _unlockGameplay() {
    if (this.hasGameStarted) return;
    this.hasGameStarted = true;

    if (this.engine) {
      this.engine.isReady = true;
      if (typeof this.engine.onGateReady === 'function') {
        this.engine.onGateReady();
      }
    }

    if (typeof this.onReady === 'function') {
      this.onReady();
    }
  }

  _showLoadingScreen() {
    if (!this.loadingScreen) return;
    this.loadingScreen.style.display = 'flex';
    this.loadingScreen.style.opacity = '1';
    this.loadingScreen.style.visibility = 'visible';
    this.loadingScreen.style.pointerEvents = 'auto';
  }

  _dismissLoading() {
    if (!this.loadingScreen) return;
    this.loadingScreen.style.transition = 'opacity 0.25s ease, visibility 0.25s ease';
    this.loadingScreen.style.opacity = '0';
    this.loadingScreen.style.pointerEvents = 'none';
    setTimeout(() => {
      if (this.loadingScreen) {
        this.loadingScreen.style.display = 'none';
      }
    }, 250);
  }

  _updateLoadingText(title, subtitle) {
    if (this.loadingTitle && title) {
      this.loadingTitle.textContent = title;
    }
    if (this.loadingSubtitle && subtitle) {
      this.loadingSubtitle.textContent = subtitle;
    }
  }

  _hideErrorActions() {
    if (this.errorActions) {
      this.errorActions.style.display = 'none';
      this.errorActions.classList.add('hidden');
    }
    if (this.loadingSpinner) {
      this.loadingSpinner.style.display = 'flex';
    }
  }

  _updateHUD(message, status = 'standby') {
    if (typeof document === 'undefined') return;
    const label = document.querySelector('#hud-sensor-feedback .sensor-label');
    const dot = document.querySelector('#hud-sensor-feedback .sensor-pulse-dot');
    if (label && message) {
      if (status === 'active' || status === 'tracking') {
        label.textContent = 'GESTURE ACTIVE';
      } else {
        label.textContent = message.toUpperCase();
      }
    }
    if (dot) {
      dot.className = 'sensor-pulse-dot';
      if (status === 'active' || status === 'tracking') dot.classList.add('active');
      else if (status === 'error' || status === 'disconnected') dot.classList.add('error');
    }
  }
}
