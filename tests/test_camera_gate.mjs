/**
 * MindRush — Camera Gate & Initialization Prerequisites Test Suite
 *
 * Verifies all 10 critical requirements:
 * 1. Gesture Mode + camera permission granted → gameplay starts only after successful initialization.
 * 2. Gesture Mode + camera permission denied → gameplay remains stopped.
 * 3. Gesture Mode + camera unavailable → gameplay remains stopped.
 * 4. Gesture Mode + MediaPipe loading failure → gameplay remains stopped.
 * 5. Gesture Mode + camera loading → gameplay remains stopped.
 * 6. Retry Camera after denial → initialization can succeed.
 * 7. Switch to Keyboard Mode after camera denial → gameplay starts normally.
 * 8. Keyboard Mode selected before Play → no camera permission requested.
 * 9. Camera disconnected during gameplay → current session is preserved and safely falls back.
 * 10. Repeated Play clicks → only one initialization and one game loop.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { CameraGate } from '../public/js/game/camera-gate.js';
import { getGameSettings, saveGameSettings } from '../public/js/game/settings.js';

describe('Camera Initialization Gate & Lifecycle Tests', () => {
  let storageMap;
  let mockEngine;
  let mockGesture;
  let gateReadyCalled;
  let gateFailureCalled;

  beforeEach(() => {
    storageMap = new Map();
    globalThis.localStorage = {
      getItem: (k) => storageMap.get(k) || null,
      setItem: (k, v) => storageMap.set(k, String(v)),
      removeItem: (k) => storageMap.delete(k),
      clear: () => storageMap.clear()
    };

    gateReadyCalled = false;
    gateFailureCalled = false;

    mockEngine = {
      isReady: false,
      isPaused: false,
      score: 500,
      lives: 3,
      input: {
        controlMode: 'keyboard',
        setControlMode(m) { this.controlMode = m; },
        hideCursor() {}
      },
      pause() { this.isPaused = true; },
      resume() { this.isPaused = false; },
      onGateReady() { gateReadyCalled = true; }
    };

    mockGesture = {
      controlMode: 'keyboard',
      isActive: false,
      isHandPresent: false,
      _isFistActive: false,
      stopCallCount: 0,
      initCallCount: 0,
      initRejectError: null,
      async init({ onProgress } = {}) {
        this.initCallCount++;
        if (typeof onProgress === 'function') {
          onProgress('Requesting camera permission...');
          onProgress('Initializing camera...');
          onProgress('Loading gesture recognition model...');
          onProgress('Waiting for hand detection...');
          onProgress('Gesture controls ready.');
        }
        if (this.initRejectError) {
          throw this.initRejectError;
        }
        this.isActive = true;
        this.controlMode = 'gesture';
        return true;
      },
      stop() {
        this.stopCallCount++;
        this.isActive = false;
        this.isHandPresent = false;
      },
      switchToKeyboard() {
        this.controlMode = 'keyboard';
        this.isActive = false;
      }
    };
  });

  // ------------------------------------------------------------------
  // Scenario 1: Permission Granted -> Starts only after success
  // ------------------------------------------------------------------
  it('1. Gesture Mode + camera permission granted: gameplay starts only after successful initialization', async () => {
    saveGameSettings({ controlMethod: 'gesture' });

    const gate = new CameraGate({
      engine: mockEngine,
      gestureInput: mockGesture,
      onReady: () => { gateReadyCalled = true; }
    });

    // Before start: gate closed, game not ready
    assert.equal(gate.isGateOpen, false);
    assert.equal(mockEngine.isReady, false);

    const result = await gate.start();

    // After success: gate opened, game marked ready, engine unblocked
    assert.equal(result, true);
    assert.equal(gate.isGateOpen, true);
    assert.equal(mockEngine.isReady, true);
    assert.equal(mockEngine.input.controlMode, 'gesture');
    assert.equal(gateReadyCalled, true);
    assert.equal(mockGesture.initCallCount, 1);
  });

  // ------------------------------------------------------------------
  // Scenario 2: Permission Denied -> Gameplay remains stopped
  // ------------------------------------------------------------------
  it('2. Gesture Mode + camera permission denied: gameplay remains stopped and does NOT auto-switch without player choice', async () => {
    saveGameSettings({ controlMethod: 'gesture' });
    mockGesture.initRejectError = new Error('Permission denied by user');

    const gate = new CameraGate({
      engine: mockEngine,
      gestureInput: mockGesture,
      onFailure: () => { gateFailureCalled = true; }
    });

    const result = await gate.start();

    // Verification: gate remains closed, game NOT ready, NO auto-switch to keyboard
    assert.equal(result, false);
    assert.equal(gate.isGateOpen, false, 'Gate must remain closed on denial');
    assert.equal(mockEngine.isReady, false, 'Game engine must NOT be marked ready');
    assert.equal(gate.status, 'error');
    assert.equal(gateFailureCalled, true);
    assert.equal(mockGesture.stopCallCount > 0, true, 'Cleaned up partial resources');

    // Setting remains gesture (no unauthorized silent mutation)
    const currentSettings = getGameSettings();
    assert.equal(currentSettings.controlMethod, 'gesture', 'Control setting must NOT be secretly mutated');
  });

  // ------------------------------------------------------------------
  // Scenario 3: Camera Unavailable -> Gameplay remains stopped
  // ------------------------------------------------------------------
  it('3. Gesture Mode + camera unavailable: gameplay remains stopped', async () => {
    saveGameSettings({ controlMethod: 'gesture' });
    mockGesture.initRejectError = new Error('NotFoundError: No camera detected');

    const gate = new CameraGate({
      engine: mockEngine,
      gestureInput: mockGesture
    });

    const result = await gate.start();
    assert.equal(result, false);
    assert.equal(gate.isGateOpen, false);
    assert.equal(mockEngine.isReady, false);
    assert.equal(gate.status, 'error');
  });

  // ------------------------------------------------------------------
  // Scenario 4: MediaPipe Loading Failure -> Gameplay remains stopped
  // ------------------------------------------------------------------
  it('4. Gesture Mode + MediaPipe loading failure: gameplay remains stopped', async () => {
    saveGameSettings({ controlMethod: 'gesture' });
    mockGesture.initRejectError = new Error('Failed to fetch MediaPipe wasm bundle');

    const gate = new CameraGate({
      engine: mockEngine,
      gestureInput: mockGesture
    });

    const result = await gate.start();
    assert.equal(result, false);
    assert.equal(gate.isGateOpen, false);
    assert.equal(mockEngine.isReady, false);
  });

  // ------------------------------------------------------------------
  // Scenario 5: Camera Loading -> Gameplay remains stopped during load
  // ------------------------------------------------------------------
  it('5. Gesture Mode + camera loading: gameplay remains locked while initialization is in progress', async () => {
    saveGameSettings({ controlMethod: 'gesture' });

    let resolveInit;
    mockGesture.init = () => new Promise(r => {
      resolveInit = (val = true) => {
        mockGesture.isActive = true;
        r(val);
      };
    });

    const gate = new CameraGate({
      engine: mockEngine,
      gestureInput: mockGesture
    });

    const startPromise = gate.start();

    // While awaiting resolution:
    assert.equal(gate.isInitializing, true, 'isInitializing must be true');
    assert.equal(gate.isGateOpen, false, 'isGateOpen must be false during loading');
    assert.equal(mockEngine.isReady, false, 'Engine must NOT be ready while loading');

    // Now resolve
    resolveInit(true);
    await startPromise;

    assert.equal(gate.isGateOpen, true);
    assert.equal(mockEngine.isReady, true);
  });

  // ------------------------------------------------------------------
  // Scenario 6: Retry Camera after Denial -> Can succeed
  // ------------------------------------------------------------------
  it('6. Retry Camera after denial: initialization can succeed upon retry', async () => {
    saveGameSettings({ controlMethod: 'gesture' });
    mockGesture.initRejectError = new Error('Permission denied');

    const gate = new CameraGate({
      engine: mockEngine,
      gestureInput: mockGesture
    });

    // First attempt fails
    const firstResult = await gate.start();
    assert.equal(firstResult, false);
    assert.equal(gate.isGateOpen, false);

    // User fixes permissions and clicks Retry
    mockGesture.initRejectError = null; // permission now granted
    const retryResult = await gate.retry();

    assert.equal(retryResult, true);
    assert.equal(gate.isGateOpen, true);
    assert.equal(mockEngine.isReady, true);
    assert.equal(mockEngine.input.controlMode, 'gesture');
  });

  // ------------------------------------------------------------------
  // Scenario 7: Switch to Keyboard after Denial -> Starts normally
  // ------------------------------------------------------------------
  it('7. Switch to Keyboard Mode after camera denial: gameplay starts normally and persists setting', async () => {
    saveGameSettings({ controlMethod: 'gesture' });
    mockGesture.initRejectError = new Error('Permission denied');

    const gate = new CameraGate({
      engine: mockEngine,
      gestureInput: mockGesture
    });

    await gate.start();
    assert.equal(gate.isGateOpen, false);

    // Player explicitly clicks "SWITCH TO KEYBOARD MODE"
    gate.switchToKeyboard();

    assert.equal(gate.isGateOpen, true, 'Gate opens on explicit keyboard selection');
    assert.equal(mockEngine.isReady, true, 'Game is ready to play');
    assert.equal(mockEngine.input.controlMode, 'keyboard', 'Control mode switched to keyboard');
    assert.equal(mockGesture.controlMode, 'keyboard');

    // Setting persisted for future sessions
    const updatedSettings = getGameSettings();
    assert.equal(updatedSettings.controlMethod, 'keyboard', 'Keyboard preference saved in settings');
  });

  // ------------------------------------------------------------------
  // Scenario 8: Keyboard Mode selected before Play -> No camera request
  // ------------------------------------------------------------------
  it('8. Keyboard Mode selected before Play: no camera permission requested, immediate start', async () => {
    saveGameSettings({ controlMethod: 'keyboard' });

    let cameraRequested = false;
    mockGesture.init = () => {
      cameraRequested = true;
      return Promise.resolve(true);
    };

    const gate = new CameraGate({
      engine: mockEngine,
      gestureInput: mockGesture
    });

    const result = await gate.start();

    assert.equal(result, true);
    assert.equal(gate.isGateOpen, true);
    assert.equal(mockEngine.isReady, true);
    assert.equal(mockEngine.input.controlMode, 'keyboard');
    assert.equal(cameraRequested, false, 'Camera must NEVER be requested when Keyboard Mode is selected');
  });

  // ------------------------------------------------------------------
  // Scenario 9: Camera Disconnected during Gameplay -> State preserved
  // ------------------------------------------------------------------
  it('9. Camera disconnected during gameplay: current session is preserved and safely falls back', () => {
    mockEngine.score = 750;
    mockEngine.lives = 2;
    mockEngine.isPaused = false;

    const gate = new CameraGate({
      engine: mockEngine,
      gestureInput: mockGesture
    });

    // Simulate already-running active game
    gate.isGateOpen = true;
    gate.hasGameStarted = true;
    mockGesture.isActive = true;
    mockGesture._isFistActive = true;

    // Camera hardware disconnects during active gameplay
    gate.handleRuntimeDisconnect('Webcam unplugged');

    // Verification:
    assert.equal(mockEngine.isPaused, true, 'Game must be safely paused');
    assert.equal(mockEngine.score, 750, 'Score must NOT be reset');
    assert.equal(mockEngine.lives, 2, 'Lives must NOT be reset');
    assert.equal(mockGesture.isActive, false, 'Gesture tracking must halt');
    assert.equal(mockGesture._isFistActive, false, 'Any active shooting input must stop');

    // User chooses "CONTINUE WITH KEYBOARD"
    gate.switchToKeyboardRuntime();

    assert.equal(mockEngine.input.controlMode, 'keyboard');
    assert.equal(mockEngine.isPaused, false, 'Game resumed');
    assert.equal(mockEngine.score, 750, 'Score intact after keyboard resume');
    assert.equal(mockEngine.lives, 2, 'Lives intact after keyboard resume');
  });

  // ------------------------------------------------------------------
  // Scenario 10: Repeated Play Clicks -> Only one init and game loop
  // ------------------------------------------------------------------
  it('10. Repeated Play clicks: only one initialization and one game loop start', async () => {
    saveGameSettings({ controlMethod: 'gesture' });

    let readyCallCount = 0;
    const gate = new CameraGate({
      engine: mockEngine,
      gestureInput: mockGesture,
      onReady: () => { readyCallCount++; }
    });

    // Simulate rapid repeated start calls
    const p1 = gate.start();
    const p2 = gate.start();
    const p3 = gate.start();

    await Promise.all([p1, p2, p3]);

    assert.equal(mockGesture.initCallCount, 1, 'Only one gesture initialization allowed');
    assert.equal(readyCallCount, 1, 'Gameplay start callback executed strictly once');
    assert.equal(gate.hasGameStarted, true);
  });
});
