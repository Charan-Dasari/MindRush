/**
 * gesture-input.js — Phase 3 Gesture Input Module for MindRush
 *
 * Replaces the legacy @mediapipe/hands pinch-detection module with the
 * MediaPipe Tasks-Vision HandLandmarker API.  Provides fist-shooting,
 * V-sign pause/resume, open-palm detection, smoothed horizontal movement,
 * hand-loss grace period, and a clean camera lifecycle.
 *
 * Browser-only APIs are guarded behind `typeof` checks so the pure
 * classification logic can be unit-tested under Node.js.
 *
 * @module gesture-input
 */

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const VISION_BUNDLE_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

/** MediaPipe 21-landmark indices */
const LM = Object.freeze({
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
});

/** Indices used to compute the palm center. */
const PALM_INDICES = [LM.WRIST, LM.INDEX_MCP, LM.MIDDLE_MCP, LM.RING_MCP, LM.PINKY_MCP];

/* ------------------------------------------------------------------ */
/*  Pure classification — testable without any browser API             */
/* ------------------------------------------------------------------ */

/**
 * Determine whether a single finger is extended or folded.
 *
 * In webcam coordinates Y increases **downward**, so a fingertip with a
 * *smaller* Y than its PIP joint is "above" that joint → extended.
 *
 * @param {object} tip  - Landmark at the fingertip   (TIP).
 * @param {object} pip  - Landmark at the PIP joint.
 * @returns {'extended'|'folded'}
 */
function fingerState(tip, pip) {
  return tip.y < pip.y ? 'extended' : 'folded';
}

/**
 * Compute the palm center as the average of landmarks 0, 5, 9, 13, 17.
 *
 * @param {Array<{x: number, y: number, z?: number}>} lm - 21 landmarks.
 * @returns {{x: number, y: number}}
 */
function palmCenter(lm) {
  let sx = 0;
  let sy = 0;
  for (const idx of PALM_INDICES) {
    sx += lm[idx].x;
    sy += lm[idx].y;
  }
  return { x: sx / PALM_INDICES.length, y: sy / PALM_INDICES.length };
}

/**
 * Classify the hand gesture from raw landmarks.
 *
 * Exported as a standalone function so it can be tested with mock data
 * in Node.js without any browser dependency.
 *
 * @param {Array<{x: number, y: number, z?: number}>} landmarks
 *   The 21 MediaPipe hand landmarks.
 * @returns {{
 *   gesture: 'fist'|'v_sign'|'open_palm'|'none',
 *   palmCenter: {x: number, y: number},
 *   fingerStates: {index: string, middle: string, ring: string, pinky: string}
 * }}
 */
export function classifyGesture(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return {
      gesture: 'none',
      palmCenter: { x: 0.5, y: 0.5 },
      fingerStates: { index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' },
    };
  }

  const lm = landmarks;

  const states = {
    index:  fingerState(lm[LM.INDEX_TIP],  lm[LM.INDEX_PIP]),
    middle: fingerState(lm[LM.MIDDLE_TIP], lm[LM.MIDDLE_PIP]),
    ring:   fingerState(lm[LM.RING_TIP],   lm[LM.RING_PIP]),
    pinky:  fingerState(lm[LM.PINKY_TIP],  lm[LM.PINKY_PIP]),
  };

  const center = palmCenter(lm);

  // --- Fist: ALL four fingers folded ---
  const isFist =
    states.index  === 'folded' &&
    states.middle === 'folded' &&
    states.ring   === 'folded' &&
    states.pinky  === 'folded';

  // --- V-Sign: index & middle extended, ring & pinky folded ---
  const isVSign =
    !isFist &&
    states.index  === 'extended' &&
    states.middle === 'extended' &&
    states.ring   === 'folded' &&
    states.pinky  === 'folded';

  let gesture = 'open_palm';          // default when hand is present
  if (isFist)       gesture = 'fist';
  else if (isVSign) gesture = 'v_sign';

  return { gesture, palmCenter: center, fingerStates: states };
}

/* ------------------------------------------------------------------ */
/*  GestureInputManager                                                */
/* ------------------------------------------------------------------ */

export class GestureInputManager {
  /* ---- public properties ---- */

  /** @type {'gesture'|'keyboard'} */
  controlMode = 'keyboard';

  /** @type {boolean} Whether the camera loop is actively running. */
  isActive = false;

  /** @type {boolean} Whether a hand is currently being tracked. */
  isHandPresent = false;

  /** @type {HTMLVideoElement|null} The video element used for the camera feed. */
  videoElement = null;

  /* ---- configuration (overridable via constructor) ---- */

  /** @private */ _config = {
    smoothFactor: 0.35,
    deadZone: 0.015,
    edgeMargin: 0.08,
    sensitivity: 1.0,
    shootCooldownMs: 300,
    vSignHoldMs: 800,
    vSignRearmMs: 300,
    handLossTimeoutMs: 500,
    detectionConfidence: 0.5,
    trackingConfidence: 0.5,
    maxHands: 1,
  };

  /* ---- internal state ---- */

  /** @private */ _handLandmarker = null;
  /** @private */ _rafId = null;
  /** @private */ _stream = null;

  // Movement smoothing
  /** @private */ _smoothedX = 0.5;

  // Inference loop throttling & concurrency guard (decouples gesture ML from game 60fps loop)
  /** @private */ _isInferring = false;
  /** @private */ _lastInferenceTime = 0;
  /** @private */ _lastVideoCurrentTime = -1;
  /** @private */ _minInferenceIntervalMs = 32; // ~30 FPS max (matches camera hardware capture rate)
  /** @private */ _lastEmittedGesture = '';

  // Fist / shooting state
  /** @private */ _isFistActive = false;
  /** @private */ _lastShotTime = -Infinity;

  // V-sign stability
  /** @private */ _vSignStartTime = 0;
  /** @private */ _vSignArmed = true;
  /** @private */ _vSignReleaseTime = 0;

  // Hand-loss grace period
  /** @private */ _lastHandTime = 0;
  /** @private */ _handLostNotified = false;

  // Callbacks
  /** @private */ _onStatusCb = null;
  /** @private */ _onGestureCb = null;
  /** @private */ _onShootCb = null;
  /** @private */ _onPauseToggleCb = null;
  /** @private */ _onCameraDisconnectCb = null;

  // Vision API module cache
  /** @private */ _vision = null;
  /** @private */ _worker = null;
  /** @private */ _useWorker = false;

  /* ---------------------------------------------------------------- */
  /*  Constructor                                                      */
  /* ---------------------------------------------------------------- */

  /**
   * @param {Partial<typeof GestureInputManager.prototype._config>} [opts]
   */
  constructor(opts) {
    if (opts) {
      Object.assign(this._config, opts);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Callback registration                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Register a status callback.
   * Receives `{ status, gesture, message, controlMode }`.
   * @param {function} cb
   */
  onStatus(cb)      { this._onStatusCb = cb; }

  /**
   * Register a per-frame gesture callback.
   * Receives `{ normalizedX, isFist, isVSign, isPalmOpen, isHandPresent }`.
   * @param {function} cb
   */
  onGesture(cb)     { this._onGestureCb = cb; }

  /**
   * Register a shoot callback (fires on fist at cooldown rate).
   * @param {function} cb
   */
  onShoot(cb)       { this._onShootCb = cb; }

  /**
   * Register a pause-toggle callback (fires when V-sign hold completes).
   * @param {function} cb
   */
  onPauseToggle(cb) { this._onPauseToggleCb = cb; }

  /**
   * Register a camera-disconnect callback (fires when camera track ends unexpectedly).
   * @param {function} cb
   */
  onCameraDisconnect(cb) { this._onCameraDisconnectCb = cb; }

  /* ---------------------------------------------------------------- */
  /*  Lifecycle                                                        */
  /* ---------------------------------------------------------------- */

  /**
   * Initialise the camera, load the HandLandmarker model, and start the
   * per-frame detection loop.
   * @param {object} [opts]
   * @param {function} [opts.onProgress] - Optional status progress reporter
   */
  async init({ onProgress } = {}) {
    const notify = (msg) => {
      this._emitStatus('initializing', 'none', msg);
      if (typeof onProgress === 'function') onProgress(msg);
    };

    try {
      notify('Requesting camera permission...');

      // --- Camera setup first (triggers browser permission prompt explicitly) ---
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        throw new Error('Webcam mediaDevices API is not supported in this browser environment');
      }

      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      });

      notify('Initializing camera...');

      // Listen for camera disconnection
      for (const track of this._stream.getVideoTracks()) {
        track.addEventListener('ended', () => {
          console.warn('[GestureInputManager] Camera track ended / disconnected.');
          this.isActive = false;
          this.isHandPresent = false;
          this._isFistActive = false;
          this._emitStatus('disconnected', 'none', 'Camera disconnected. Session paused safely.', 'error');
          if (this._onCameraDisconnectCb) {
            this._onCameraDisconnectCb('Camera disconnected. Session paused safely.');
          }
        });
      }

      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this._stream;
      this.videoElement.setAttribute('playsinline', '');
      this.videoElement.muted = true;
      this.videoElement.autoplay = true;

      await new Promise((resolve) => {
        if (this.videoElement.readyState >= 2) {
          this.videoElement.play().then(resolve).catch(resolve);
          return;
        }
        this.videoElement.onloadeddata = () => {
          this.videoElement.play().then(resolve).catch(resolve);
        };
        setTimeout(() => {
          this.videoElement.play().then(resolve).catch(resolve);
        }, 600);
      });

      notify('Loading gesture recognition model...');

      let workerReady = false;
      if (typeof Worker !== 'undefined' && typeof createImageBitmap === 'function' && typeof window !== 'undefined') {
        try {
          const workerUrl = new URL('./gesture-worker.js', import.meta.url);
          const worker = new Worker(workerUrl, { type: 'module' });

          const initResult = await new Promise((resolve) => {
            const timer = setTimeout(() => resolve({ ok: false, error: 'Worker init timeout' }), 5000);
            worker.onmessage = (e) => {
              if (e.data && e.data.type === 'INIT_OK') {
                clearTimeout(timer);
                resolve({ ok: true });
              } else if (e.data && e.data.type === 'INIT_ERROR') {
                clearTimeout(timer);
                resolve({ ok: false, error: e.data.message });
              }
            };
            worker.onerror = (err) => {
              clearTimeout(timer);
              resolve({ ok: false, error: err ? (err.message || 'Worker syntax/CORS error') : 'Worker error' });
            };
            worker.postMessage({
              type: 'INIT',
              options: {
                maxHands: this._config.maxHands,
                detectionConfidence: this._config.detectionConfidence,
                trackingConfidence: this._config.trackingConfidence,
              }
            });
          });

          if (initResult.ok) {
            this._worker = worker;
            this._useWorker = true;
            workerReady = true;
            this._worker.onmessage = (e) => {
              if (!this.isActive) return;
              if (e.data && e.data.type === 'RESULT') {
                this._isInferring = false;
                this._processResult({ landmarks: e.data.landmarks }, e.data.timestamp);
              } else if (e.data && e.data.type === 'RESULT_ERROR') {
                this._isInferring = false;
              }
            };
            this._worker.onerror = (err) => {
              console.warn('[GestureInputManager] Runtime worker error:', err);
              this._isInferring = false;
            };
          } else {
            console.warn('[GestureInputManager] Web Worker unavailable:', initResult.error, '— falling back to main-thread inference.');
            try { worker.terminate(); } catch (_) {}
          }
        } catch (workerErr) {
          console.warn('[GestureInputManager] Web Worker setup error:', workerErr, '— falling back to main-thread inference.');
        }
      }

      // Fallback: in-thread MediaPipe HandLandmarker if worker was not initialized
      if (!workerReady) {
        if (!this._vision) {
          const mod = await import(VISION_BUNDLE_URL);
          this._vision = mod;
        }

        const { HandLandmarker, FilesetResolver } = this._vision;

        const wasmFileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );

        let landmarker = null;
        try {
          landmarker = await HandLandmarker.createFromOptions(wasmFileset, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: this._config.maxHands,
            minHandDetectionConfidence: this._config.detectionConfidence,
            minHandPresenceConfidence: this._config.trackingConfidence,
            minTrackingConfidence: this._config.trackingConfidence,
          });
        } catch (gpuErr) {
          console.warn('[GestureInputManager] GPU delegate failed, trying CPU:', gpuErr);
          landmarker = await HandLandmarker.createFromOptions(wasmFileset, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: this._config.maxHands,
            minHandDetectionConfidence: this._config.detectionConfidence,
            minHandPresenceConfidence: this._config.trackingConfidence,
            minTrackingConfidence: this._config.trackingConfidence,
          });
        }
        this._handLandmarker = landmarker;
      }

      notify('Waiting for hand detection...');

      this.controlMode = 'gesture';
      this.isActive = true;
      this._lastHandTime = performance.now();
      this._lastVideoTimestamp = 0;

      notify('Gesture controls ready.');
      this._emitStatus('active', 'none', 'Gesture control active');
      this._loop();
    } catch (err) {
      this.isActive = false;
      this.stop();
      const msg = this._friendlyError(err);
      this._emitStatus('error', 'none', msg, 'error');
      throw err;
    }
  }

  /**
   * Stop the camera, cancel the detection loop, and release resources.
   */
  stop() {
    if (this._rafId != null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }

    if (this._worker) {
      try {
        this._worker.postMessage({ type: 'CLOSE' });
        this._worker.terminate();
      } catch (_) {}
      this._worker = null;
    }
    this._useWorker = false;

    if (this._stream) {
      for (const track of this._stream.getTracks()) {
        track.stop();
      }
      this._stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    if (this._handLandmarker) {
      this._handLandmarker.close();
      this._handLandmarker = null;
    }

    this.isActive = false;
    this.isHandPresent = false;
    this._isFistActive = false;
    this._vSignArmed = true;
    this._vSignStartTime = 0;
    this._smoothedX = 0.5;
    this._isInferring = false;
    this._lastInferenceTime = 0;
    this._lastVideoCurrentTime = -1;
    this._lastEmittedGesture = '';
  }

  /**
   * Convenience: attempt to switch to gesture mode (calls init).
   */
  async switchToGesture() {
    try {
      await this.init();
    } catch (_) {
      // init already emitted error status
    }
  }

  /**
   * Switch to keyboard mode — stop camera, update controlMode.
   */
  switchToKeyboard() {
    this.stop();
    this.controlMode = 'keyboard';
    this._emitStatus('inactive', 'none', 'Switched to keyboard', 'keyboard');
  }

  /**
   * Tear down any running session, then initialise fresh.
   */
  async retryGesture() {
    this.stop();
    await this.switchToGesture();
  }

  /* ---------------------------------------------------------------- */
  /*  Internal — detection loop                                        */
  /* ---------------------------------------------------------------- */

  /** @private */
  _loop() {
    if (!this.isActive) return;

    const video = this.videoElement;
    const canInfer = this._useWorker ? !!this._worker : !!this._handLandmarker;

    if (video && video.readyState >= 2 && video.videoWidth > 0 && canInfer && !this._isInferring) {
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const elapsedSinceLastInference = now - this._lastInferenceTime;
      const frameChanged = video.currentTime !== this._lastVideoCurrentTime;

      // Throttle inference: max ~30 FPS (hardware webcam capture rate).
      // Skip redundant detection if video frame has not advanced (saves ~50% CPU/GPU and keeps game at 60fps).
      const shouldRunInference = elapsedSinceLastInference >= this._minInferenceIntervalMs &&
        (frameChanged || elapsedSinceLastInference > 120);

      if (shouldRunInference && now > (this._lastVideoTimestamp || 0)) {
        this._isInferring = true;
        this._lastInferenceTime = now;
        this._lastVideoTimestamp = now;
        this._lastVideoCurrentTime = video.currentTime;

        if (this._useWorker && this._worker && typeof createImageBitmap === 'function') {
          // Off-thread Worker inference
          createImageBitmap(video)
            .then((bitmap) => {
              if (!this.isActive || !this._worker) {
                if (bitmap && typeof bitmap.close === 'function') bitmap.close();
                this._isInferring = false;
                return;
              }
              this._worker.postMessage(
                { type: 'PROCESS_FRAME', bitmap, timestamp: now },
                [bitmap]
              );
            })
            .catch(() => {
              this._isInferring = false;
            });
        } else if (this._handLandmarker) {
          // In-thread fallback / unit test mock
          try {
            const result = this._handLandmarker.detectForVideo(video, now);
            this._processResult(result, now);
          } catch (detectErr) {
            // Log transient detection warning without breaking animation loop
            console.warn('[GestureInputManager] Frame detection warning:', detectErr.message || detectErr);
          } finally {
            this._isInferring = false;
          }
        } else {
          this._isInferring = false;
        }
      }
    }

    if (this.isActive && typeof requestAnimationFrame !== 'undefined') {
      this._rafId = requestAnimationFrame(() => this._loop());
    }
  }

  /**
   * Process a single detection result frame.
   * @private
   * @param {object} result
   * @param {number} now - performance.now() timestamp
   */
  _processResult(result, now) {
    const hasHand = result.landmarks && result.landmarks.length > 0;

    if (hasHand) {
      this._lastHandTime = now;
      this._handLostNotified = false;
      this.isHandPresent = true;

      const landmarks = result.landmarks[0]; // first hand
      const { gesture, palmCenter: center, fingerStates } = classifyGesture(landmarks);

      // --- Movement (always, even during fist) ---
      this._updateMovement(center.x);

      // --- Gesture-specific logic ---
      const isFist    = gesture === 'fist';
      const isVSign   = gesture === 'v_sign';
      const isPalm    = gesture === 'open_palm';

      this._handleFist(isFist, now);
      this._handleVSign(isVSign, now);

      // --- Emit per-frame gesture data ---
      if (this._onGestureCb) {
        this._onGestureCb({
          normalizedX: this._smoothedX,
          isFist,
          isVSign,
          isPalmOpen: isPalm,
          isHandPresent: true,
        });
      }

      // Debounce HUD status emission so we do not trigger DOM querySelector/mutations on every frame
      if (this._lastEmittedGesture !== gesture) {
        this._lastEmittedGesture = gesture;
        this._emitStatus('tracking', gesture, `Gesture: ${gesture}`);
      }
    } else {
      // No hand detected — grace period
      this._handleHandLoss(now);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Movement smoothing                                               */
  /* ---------------------------------------------------------------- */

  /** @private */
  _updateMovement(rawPalmX) {
    // Normal hand movement in webcam frame comfortably covers [edgeMargin, 1 - edgeMargin].
    // Scale and mirror so users can reach 0.0 and 1.0 without stretching outside the camera view.
    const margin = typeof this._config.edgeMargin === 'number' ? this._config.edgeMargin : 0.08;
    const clampedRaw = Math.max(margin, Math.min(1.0 - margin, rawPalmX));
    const activeSpan = 1.0 - 2 * margin;
    const scaledX = activeSpan > 0 ? (clampedRaw - margin) / activeSpan : rawPalmX;

    // Mirror the X axis so moving your hand RIGHT moves the ship RIGHT.
    const mirroredX = 1.0 - scaledX;

    const alpha = this._config.smoothFactor;
    let newSmoothed = this._smoothedX * (1 - alpha) + mirroredX * alpha;

    // Dead-zone: ignore tiny jitters
    if (Math.abs(newSmoothed - this._smoothedX) < this._config.deadZone) {
      return; // keep previous value
    }

    // Clamp strictly to [0, 1]
    newSmoothed = Math.max(0, Math.min(1, newSmoothed));
    this._smoothedX = newSmoothed;
  }

  /* ---------------------------------------------------------------- */
  /*  Fist → Shoot                                                     */
  /* ---------------------------------------------------------------- */

  /** @private */
  _handleFist(isFist, now) {
    if (isFist) {
      this._isFistActive = true;
      if (now - this._lastShotTime >= this._config.shootCooldownMs) {
        this._lastShotTime = now;
        if (this._onShootCb) this._onShootCb();
      }
    } else {
      this._isFistActive = false;
    }
  }

  /* ---------------------------------------------------------------- */
  /*  V-Sign → Pause / Resume                                          */
  /* ---------------------------------------------------------------- */

  /** @private */
  _handleVSign(isVSign, now) {
    if (isVSign) {
      // Re-arming check: V-sign must have been released long enough.
      if (!this._vSignArmed) return;

      if (this._vSignStartTime === 0) {
        this._vSignStartTime = now || 0.001;
      }

      if (now - this._vSignStartTime >= this._config.vSignHoldMs) {
        // Trigger pause/resume
        if (this._onPauseToggleCb) this._onPauseToggleCb();
        this._vSignArmed = false;
        this._vSignStartTime = 0;
        this._vSignReleaseTime = 0;
      }
    } else {
      // V-sign released
      this._vSignStartTime = 0;

      if (!this._vSignArmed) {
        // Track release duration to re-arm
        if (this._vSignReleaseTime === 0) {
          this._vSignReleaseTime = now || 0.001;
        }
        if (now - this._vSignReleaseTime >= this._config.vSignRearmMs) {
          this._vSignArmed = true;
          this._vSignReleaseTime = 0;
        }
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Hand-loss grace period                                           */
  /* ---------------------------------------------------------------- */

  /** @private */
  _handleHandLoss(now) {
    const elapsed = now - this._lastHandTime;

    if (elapsed < this._config.handLossTimeoutMs) {
      // Still within grace period — hold last position, stay present
      if (this._onGestureCb) {
        this._onGestureCb({
          normalizedX: this._smoothedX,
          isFist: false,
          isVSign: false,
          isPalmOpen: false,
          isHandPresent: true,          // pretend hand is still there
        });
      }
      return;
    }

    // Grace period expired
    if (!this._handLostNotified) {
      this._handLostNotified = true;
      this.isHandPresent = false;
      this._isFistActive = false;
      this._lastEmittedGesture = 'none';

      this._emitStatus('lost', 'none', 'Hand lost — show your hand to resume');

      if (this._onGestureCb) {
        this._onGestureCb({
          normalizedX: this._smoothedX,
          isFist: false,
          isVSign: false,
          isPalmOpen: false,
          isHandPresent: false,
        });
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Status helper                                                    */
  /* ---------------------------------------------------------------- */

  /**
   * @private
   * @param {string} status
   * @param {string} gesture
   * @param {string} message
   * @param {string} [mode]
   */
  _emitStatus(status, gesture, message, mode) {
    if (this._onStatusCb) {
      this._onStatusCb({
        status,
        gesture,
        message,
        controlMode: mode || this.controlMode,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Error helper                                                     */
  /* ---------------------------------------------------------------- */

  /** @private */
  _friendlyError(err) {
    if (!err) return 'Unknown error';
    const msg = err.message || String(err);
    if (msg.includes('NotAllowedError') || msg.includes('Permission denied')) {
      return 'Camera permission denied. Please allow camera access and retry.';
    }
    if (msg.includes('NotFoundError') || msg.includes('Requested device not found')) {
      return 'No camera found. Please connect a camera and retry.';
    }
    if (msg.includes('model') || msg.includes('fetch')) {
      return 'Failed to load gesture model. Check your connection and retry.';
    }
    return `Gesture init failed: ${msg}`;
  }
}
