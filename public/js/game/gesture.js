/**
 * MindRush — MediaPipe Hand Gesture Controller
 * Provides hands-free spatial tracking for Space Invader gameplay.
 * Maps horizontal and vertical hand position to spaceship movement
 * and detects pinch/fist gestures for projectile firing.
 */

export class GestureController {
  constructor() {
    this.isActive = false;
    this.isInitializing = false;
    this.hands = null;
    this.camera = null;
    this.videoElement = null;
    this.feedbackElement = typeof document !== 'undefined' ? document.getElementById('hud-sensor-feedback') : null;
    
    this.currentNormalizedX = 0.5;
    this.currentNormalizedY = 0.85;
    this.isPinching = false;
    this.isHandPresent = false;
    
    this.onUpdateCallback = null;

    this._bindFeedbackClick();
  }

  /**
   * Register listener for hand tracking updates
   * @param {Function} cb - Receives ({ normX, normY, isPinching, isHandPresent })
   */
  onUpdate(cb) {
    this.onUpdateCallback = cb;
  }

  _bindFeedbackClick() {
    if (!this.feedbackElement || typeof this.feedbackElement.addEventListener !== 'function') return;
    if (this.feedbackElement.style) this.feedbackElement.style.cursor = 'pointer';
    this.feedbackElement.addEventListener('click', () => {
      if (this.isActive) {
        this.stop();
      } else {
        this.start();
      }
    });
  }

  /**
   * Set HUD sensor status text and pulse style
   * @param {string} text
   * @param {'standby'|'active'|'searching'|'error'} status
   */
  setStatus(text, status = 'standby') {
    if (!this.feedbackElement) return;
    const label = this.feedbackElement.querySelector('.sensor-label');
    const dot = this.feedbackElement.querySelector('.sensor-pulse-dot');
    if (label) label.textContent = text;
    if (dot) {
      dot.className = 'sensor-pulse-dot';
      if (status === 'active') dot.classList.add('active');
      if (status === 'error') dot.classList.add('error');
    }
  }

  /**
   * Initializes MediaPipe Hands and connects to user webcam
   */
  async start() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.mediaDevices) {
      this.setStatus('CAMERA: NOT SUPPORTED (KEYBOARD ONLY)', 'error');
      return false;
    }

    if (this.isActive || this.isInitializing) return true;
    this.isInitializing = true;
    this.setStatus('CAMERA: INITIALIZING SENSOR...', 'searching');

    try {
      // Create hidden video element for MediaPipe stream
      if (!this.videoElement) {
        this.videoElement = document.createElement('video');
        this.videoElement.style.display = 'none';
        this.videoElement.playsInline = true;
        this.videoElement.muted = true;
        document.body.appendChild(this.videoElement);
      }

      // Check for MediaPipe global classes loaded via CDN
      if (typeof window.Hands === 'undefined') {
        await this._loadMediaPipeScripts();
      }

      if (typeof window.Hands === 'undefined') {
        throw new Error('MediaPipe Hands library could not be loaded.');
      }

      this.hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      this.hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.5
      });

      this.hands.onResults((results) => this._onHandResults(results));

      if (typeof window.Camera !== 'undefined') {
        this.camera = new window.Camera(this.videoElement, {
          onFrame: async () => {
            if (this.isActive && this.hands) {
              await this.hands.send({ image: this.videoElement });
            }
          },
          width: 640,
          height: 480
        });
        await this.camera.start();
      } else {
        // Fallback standard getUserMedia
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' }
        });
        this.videoElement.srcObject = stream;
        await this.videoElement.play();
        this._startCustomLoop();
      }

      this.isActive = true;
      this.isInitializing = false;
      this.setStatus('CAMERA: ACTIVE (SHOW HAND TO PLAY)', 'searching');
      return true;
    } catch (err) {
      console.warn('[GestureController] Camera sensor failed to start:', err.message);
      this.isInitializing = false;
      this.isActive = false;
      this.setStatus('CAMERA: STANDBY (KEYBOARD: ARROWS/WASD + SPACE)', 'standby');
      return false;
    }
  }

  _startCustomLoop() {
    const processFrame = async () => {
      if (!this.isActive) return;
      if (this.videoElement && this.videoElement.readyState >= 2 && this.hands) {
        try {
          await this.hands.send({ image: this.videoElement });
        } catch (e) {}
      }
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(processFrame);
      }
    };
    processFrame();
  }

  _onHandResults(results) {
    if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      if (this.isHandPresent) {
        this.isHandPresent = false;
        this.setStatus('CAMERA: SEARCHING FOR HAND...', 'searching');
      }
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    this.isHandPresent = true;

    // Use landmark 9 (middle MCP knuckle) or landmark 8 (index tip)
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    const wrist = landmarks[0];

    // Invert X because user webcam is a mirror
    const mirroredX = 1 - indexTip.x;
    const rawY = indexTip.y;

    // Smooth movement
    this.currentNormalizedX = this.currentNormalizedX * 0.4 + mirroredX * 0.6;
    this.currentNormalizedY = this.currentNormalizedY * 0.4 + rawY * 0.6;

    // Pinch detection (distance between thumb and index tip)
    const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    this.isPinching = pinchDist < 0.085;

    // Update feedback
    if (this.isPinching) {
      this.setStatus('GESTURE: FIRING LASER! ⚡', 'active');
    } else {
      this.setStatus('CAMERA: TRACKING (PINCH TO FIRE)', 'active');
    }

    if (typeof this.onUpdateCallback === 'function') {
      this.onUpdateCallback({
        normX: this.currentNormalizedX,
        normY: this.currentNormalizedY,
        isPinching: this.isPinching,
        isHandPresent: true
      });
    }
  }

  /**
   * Halts camera and tracking
   */
  stop() {
    this.isActive = false;
    this.isHandPresent = false;

    if (this.camera && typeof this.camera.stop === 'function') {
      try { this.camera.stop(); } catch (e) {}
    }

    if (this.videoElement && this.videoElement.srcObject) {
      try {
        const tracks = this.videoElement.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        this.videoElement.srcObject = null;
      } catch (e) {}
    }

    this.setStatus('CAMERA: STANDBY (KEYBOARD: ARROWS/WASD + SPACE)', 'standby');
  }

  async _loadMediaPipeScripts() {
    if (typeof document === 'undefined') return;
    const loadScript = (src) => new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });

    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
    } catch (e) {
      console.warn('[GestureController] CDN loading failed, continuing with keyboard/pointer.');
    }
  }
}

