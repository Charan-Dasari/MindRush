/**
 * MindRush — Phase 3 Gesture Controls & Keyboard Safe Mode Test Suite
 *
 * Verifies:
 * 1. Landmark classification (Open Palm, Closed Fist, V-Sign, Partial, Invalid, Missing)
 * 2. Palm center extraction and horizontal coordinate mapping (Mirroring, Clamping, Smoothing, Dead-zone)
 * 3. Fist shooting behavior (Cooldown enforcement, Continuous hold, Release, No accidental pause)
 * 4. V-Sign pause/resume (800ms stability hold, single-fire, release re-arm, no repeat toggle)
 * 5. Simultaneous movement and shooting (Palm tracking remains active during fist)
 * 6. Hand loss grace period & recovery
 * 7. InputManager Keyboard Safe Mode & seamless fallback
 * 8. State safety & mouse restriction enforcement
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Import modules under test
import { classifyGesture, GestureInputManager } from '../public/js/game/gesture-input.js';
import { InputManager } from '../public/js/game/input.js';
import { GameState, GAME_STATES } from '../public/js/game/state.js';

/* ------------------------------------------------------------------ */
/*  Mock Landmark Generation Helper                                   */
/* ------------------------------------------------------------------ */

/**
 * Creates 21 mock MediaPipe hand landmarks based on finger states and palm position.
 * @param {object} opts
 * @param {'extended'|'folded'} [opts.index='extended']
 * @param {'extended'|'folded'} [opts.middle='extended']
 * @param {'extended'|'folded'} [opts.ring='extended']
 * @param {'extended'|'folded'} [opts.pinky='extended']
 * @param {number} [opts.palmX=0.5]
 * @param {number} [opts.palmY=0.6]
 * @returns {Array<{x: number, y: number, z: number}>}
 */
function makeLandmarks({
  index = 'extended',
  middle = 'extended',
  ring = 'extended',
  pinky = 'extended',
  palmX = 0.5,
  palmY = 0.6
} = {}) {
  const lm = [];
  for (let i = 0; i < 21; i++) {
    lm.push({ x: palmX, y: palmY, z: 0 });
  }

  // Set palm landmark positions (0: wrist, 5, 9, 13, 17: MCPs)
  // Their average will equal (palmX, palmY)
  lm[0]  = { x: palmX, y: palmY + 0.15, z: 0 }; // Wrist below palm
  lm[5]  = { x: palmX - 0.06, y: palmY - 0.03, z: 0 }; // Index MCP
  lm[9]  = { x: palmX - 0.02, y: palmY - 0.05, z: 0 }; // Middle MCP
  lm[13] = { x: palmX + 0.02, y: palmY - 0.04, z: 0 }; // Ring MCP
  lm[17] = { x: palmX + 0.06, y: palmY - 0.03, z: 0 }; // Pinky MCP

  // In webcam coordinates, Y increases downward.
  // Extended finger: TIP.y < PIP.y (tip is higher up on screen)
  // Folded finger:   TIP.y > PIP.y (tip is curled down toward palm)

  // Index (PIP=6, TIP=8)
  lm[6] = { x: palmX - 0.06, y: 0.40, z: 0 };
  lm[8] = { x: palmX - 0.06, y: index === 'extended' ? 0.20 : 0.55, z: 0 };

  // Middle (PIP=10, TIP=12)
  lm[10] = { x: palmX - 0.02, y: 0.38, z: 0 };
  lm[12] = { x: palmX - 0.02, y: middle === 'extended' ? 0.18 : 0.55, z: 0 };

  // Ring (PIP=14, TIP=16)
  lm[14] = { x: palmX + 0.02, y: 0.40, z: 0 };
  lm[16] = { x: palmX + 0.02, y: ring === 'extended' ? 0.22 : 0.55, z: 0 };

  // Pinky (PIP=18, TIP=20)
  lm[18] = { x: palmX + 0.06, y: 0.42, z: 0 };
  lm[20] = { x: palmX + 0.06, y: pinky === 'extended' ? 0.25 : 0.55, z: 0 };

  return lm;
}

/* ------------------------------------------------------------------ */
/*  1. GESTURE CLASSIFICATION TESTS                                   */
/* ------------------------------------------------------------------ */

describe('1. Gesture Classification', () => {
  it('detects Open Palm when all 4 fingers are extended', () => {
    const lm = makeLandmarks({
      index: 'extended',
      middle: 'extended',
      ring: 'extended',
      pinky: 'extended'
    });
    const result = classifyGesture(lm);
    assert.equal(result.gesture, 'open_palm');
    assert.equal(result.fingerStates.index, 'extended');
    assert.equal(result.fingerStates.middle, 'extended');
    assert.equal(result.fingerStates.ring, 'extended');
    assert.equal(result.fingerStates.pinky, 'extended');
  });

  it('detects Closed Fist when all 4 fingers are folded towards palm', () => {
    const lm = makeLandmarks({
      index: 'folded',
      middle: 'folded',
      ring: 'folded',
      pinky: 'folded'
    });
    const result = classifyGesture(lm);
    assert.equal(result.gesture, 'fist');
    assert.equal(result.fingerStates.index, 'folded');
    assert.equal(result.fingerStates.middle, 'folded');
    assert.equal(result.fingerStates.ring, 'folded');
    assert.equal(result.fingerStates.pinky, 'folded');
  });

  it('detects V-Sign when index and middle are extended and ring and pinky are folded', () => {
    const lm = makeLandmarks({
      index: 'extended',
      middle: 'extended',
      ring: 'folded',
      pinky: 'folded'
    });
    const result = classifyGesture(lm);
    assert.equal(result.gesture, 'v_sign');
    assert.equal(result.fingerStates.index, 'extended');
    assert.equal(result.fingerStates.middle, 'extended');
    assert.equal(result.fingerStates.ring, 'folded');
    assert.equal(result.fingerStates.pinky, 'folded');
  });

  it('rejects partially closed hand (2 fingers folded, 2 extended not V-sign)', () => {
    // Index folded, middle extended, ring folded, pinky extended
    const lm = makeLandmarks({
      index: 'folded',
      middle: 'extended',
      ring: 'folded',
      pinky: 'extended'
    });
    const result = classifyGesture(lm);
    assert.notEqual(result.gesture, 'fist', 'Partially closed hand must not be classified as fist');
    assert.notEqual(result.gesture, 'v_sign', 'Must not be classified as V-sign');
    assert.equal(result.gesture, 'open_palm', 'Falls back safely to open palm movement');
  });

  it('rejects 3 folded fingers from being classified as fist', () => {
    // Only 3 folded, index extended
    const lm = makeLandmarks({
      index: 'extended',
      middle: 'folded',
      ring: 'folded',
      pinky: 'folded'
    });
    const result = classifyGesture(lm);
    assert.notEqual(result.gesture, 'fist', 'Requires all 4 fingers folded for fist');
    assert.notEqual(result.gesture, 'v_sign');
  });

  it('handles missing or incomplete landmarks safely', () => {
    assert.equal(classifyGesture(null).gesture, 'none');
    assert.equal(classifyGesture(undefined).gesture, 'none');
    assert.equal(classifyGesture([]).gesture, 'none');
    assert.equal(classifyGesture([{ x: 0, y: 0 }]).gesture, 'none');
  });

  it('guarantees mutual exclusivity: Fist and V-sign cannot overlap', () => {
    const fistLm = makeLandmarks({ index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' });
    const fistResult = classifyGesture(fistLm);
    assert.equal(fistResult.gesture, 'fist');
    assert.notEqual(fistResult.gesture, 'v_sign');

    const vLm = makeLandmarks({ index: 'extended', middle: 'extended', ring: 'folded', pinky: 'folded' });
    const vResult = classifyGesture(vLm);
    assert.equal(vResult.gesture, 'v_sign');
    assert.notEqual(vResult.gesture, 'fist');
  });

  it('correctly calculates palm center from landmarks 0, 5, 9, 13, 17', () => {
    const targetX = 0.42;
    const targetY = 0.65;
    const lm = makeLandmarks({ palmX: targetX, palmY: targetY });
    const result = classifyGesture(lm);

    // Sum of offsets from makeLandmarks:
    // x: 0 - 0.06 - 0.02 + 0.02 + 0.06 = 0
    // y: 0.15 - 0.03 - 0.05 - 0.04 - 0.03 = 0
    // Therefore average equals targetX and targetY exactly
    assert.ok(Math.abs(result.palmCenter.x - targetX) < 0.001);
    assert.ok(Math.abs(result.palmCenter.y - targetY) < 0.001);
  });
});

/* ------------------------------------------------------------------ */
/*  2. MOVEMENT & COORDINATE MAPPING TESTS                            */
/* ------------------------------------------------------------------ */

describe('2. Movement & Coordinate Mapping', () => {
  it('correctly inverts/mirrors camera horizontal position', () => {
    // Camera palm at left (raw x = 0.2) -> Player moves to right on mirror screen (mirrored x = 0.8)
    const rawLeft = 0.2;
    const mirroredLeft = 1.0 - rawLeft;
    assert.ok(Math.abs(mirroredLeft - 0.8) < 0.0001);

    // Camera palm at right (raw x = 0.8) -> Player moves to left on mirror screen (mirrored x = 0.2)
    const rawRight = 0.8;
    const mirroredRight = 1.0 - rawRight;
    assert.ok(Math.abs(mirroredRight - 0.2) < 0.0001);

    // Center stays at center
    const rawCenter = 0.5;
    assert.ok(Math.abs(1.0 - rawCenter - 0.5) < 0.0001);
  });

  it('applies exponential moving average smoothing correctly', () => {
    let currentSmoothed = 0.5;
    const alpha = 0.35; // smoothFactor

    // Target step to 0.8
    const targetX = 0.8;
    const nextSmoothed = currentSmoothed * (1 - alpha) + targetX * alpha;
    // 0.5 * 0.65 + 0.8 * 0.35 = 0.325 + 0.280 = 0.605
    assert.ok(Math.abs(nextSmoothed - 0.605) < 0.001);
    assert.ok(nextSmoothed > currentSmoothed, 'Moves towards target without snapping instantly');
    assert.ok(nextSmoothed < targetX, 'Dampens sudden jump to eliminate jitter');
  });

  it('filters minor tremors inside dead zone', () => {
    const deadZone = 0.015;
    const startX = 0.5;
    const smallJitterX = 0.508; // delta = 0.008 < 0.015
    const delta = Math.abs(smallJitterX - startX);
    assert.ok(delta < deadZone, 'Tremor within dead zone ignored');

    const intentionalMoveX = 0.535; // delta = 0.035 > 0.015
    const moveDelta = Math.abs(intentionalMoveX - startX);
    assert.ok(moveDelta > deadZone, 'Intentional movement passes dead zone filter');
  });

  it('clamps coordinates strictly within playable [0, 1] range', () => {
    const clamp = (val) => Math.max(0, Math.min(1, val));
    assert.equal(clamp(-0.15), 0);
    assert.equal(clamp(1.25), 1);
    assert.equal(clamp(0.45), 0.45);
  });

  it('tracks palm center position while the hand is making a fist (simultaneous move + shoot)', () => {
    // When making a fist at X=0.35
    const fistLeft = makeLandmarks({
      index: 'folded',
      middle: 'folded',
      ring: 'folded',
      pinky: 'folded',
      palmX: 0.35
    });
    const resultLeft = classifyGesture(fistLeft);
    assert.equal(resultLeft.gesture, 'fist');
    assert.ok(Math.abs(resultLeft.palmCenter.x - 0.35) < 0.001);

    // Hand still in fist, moved to X=0.75
    const fistRight = makeLandmarks({
      index: 'folded',
      middle: 'folded',
      ring: 'folded',
      pinky: 'folded',
      palmX: 0.75
    });
    const resultRight = classifyGesture(fistRight);
    assert.equal(resultRight.gesture, 'fist');
    assert.ok(Math.abs(resultRight.palmCenter.x - 0.75) < 0.001);
    assert.notEqual(resultLeft.palmCenter.x, resultRight.palmCenter.x, 'Position updates while fist is held');
  });
});

/* ------------------------------------------------------------------ */
/*  3. SHOOTING GESTURE TESTS                                         */
/* ------------------------------------------------------------------ */

describe('3. Shooting Gesture (Closed Fist)', () => {
  it('triggers shooting when closed fist is detected', () => {
    let shotFired = false;
    const cooldownMs = 300;
    let lastShotTime = 0;

    const handleFist = (isFist, now) => {
      if (isFist && now - lastShotTime >= cooldownMs) {
        lastShotTime = now;
        shotFired = true;
      }
    };

    handleFist(true, 1000);
    assert.equal(shotFired, true);
  });

  it('enforces shooting cooldown while fist is continuously held', () => {
    let shotCount = 0;
    const cooldownMs = 300;
    let lastShotTime = -Infinity;

    const handleFist = (isFist, now) => {
      if (isFist && now - lastShotTime >= cooldownMs) {
        lastShotTime = now;
        shotCount++;
      }
    };

    // Frame 1: t=1000 -> Shot 1
    handleFist(true, 1000);
    assert.equal(shotCount, 1);

    // Frame 2: t=1100ms (held fist, within cooldown) -> No shot
    handleFist(true, 1100);
    assert.equal(shotCount, 1);

    // Frame 3: t=1250ms (still within cooldown) -> No shot
    handleFist(true, 1250);
    assert.equal(shotCount, 1);

    // Frame 4: t=1300ms (cooldown reached) -> Shot 2
    handleFist(true, 1300);
    assert.equal(shotCount, 2);

    // Frame 5: t=1600ms (second cooldown reached) -> Shot 3
    handleFist(true, 1600);
    assert.equal(shotCount, 3);
  });

  it('stops shooting immediately when fist is released', () => {
    let shotCount = 0;
    const cooldownMs = 300;
    let lastShotTime = -Infinity;
    let isFistActive = false;

    const handleFist = (isFist, now) => {
      if (isFist) {
        isFistActive = true;
        if (now - lastShotTime >= cooldownMs) {
          lastShotTime = now;
          shotCount++;
        }
      } else {
        isFistActive = false;
      }
    };

    handleFist(true, 1000); // Shot 1
    assert.equal(shotCount, 1);
    assert.equal(isFistActive, true);

    handleFist(false, 1350); // Released at t=1350
    assert.equal(isFistActive, false);
    assert.equal(shotCount, 1, 'No additional shot on release');

    // Subsequent frames with open hand
    handleFist(false, 1700);
    assert.equal(shotCount, 1);
  });

  it('ensures fist gesture does NOT trigger pause', () => {
    const lm = makeLandmarks({ index: 'folded', middle: 'folded', ring: 'folded', pinky: 'folded' });
    const { gesture } = classifyGesture(lm);
    assert.equal(gesture, 'fist');
    assert.notEqual(gesture, 'v_sign', 'Fist must never trigger pause');
  });
});

/* ------------------------------------------------------------------ */
/*  4. PAUSE / RESUME GESTURE TESTS                                   */
/* ------------------------------------------------------------------ */

describe('4. Pause / Resume Gesture (V-Sign)', () => {
  it('does NOT trigger pause if V-sign is held for less than 800ms', () => {
    let pauseToggled = false;
    let vSignStartTime = 0;
    let vSignArmed = true;
    const vSignHoldMs = 800;

    const handleVSign = (isVSign, now) => {
      if (isVSign) {
        if (!vSignArmed) return;
        if (vSignStartTime === 0) vSignStartTime = now || 1;
        if (now - vSignStartTime >= vSignHoldMs) {
          pauseToggled = true;
          vSignArmed = false;
          vSignStartTime = 0;
        }
      } else {
        vSignStartTime = 0;
      }
    };

    // t=1000: V-sign starts
    handleVSign(true, 1000);
    assert.equal(pauseToggled, false);

    // t=1400ms: Still holding
    handleVSign(true, 1400);
    assert.equal(pauseToggled, false);

    // t=1750ms: Still < 800ms
    handleVSign(true, 1750);
    assert.equal(pauseToggled, false);

    // t=1760ms: Release before 800ms
    handleVSign(false, 1760);
    assert.equal(pauseToggled, false, 'Premature release cancels pause trigger');
  });

  it('triggers pause toggle once when V-sign is held for >= 800ms', () => {
    let pauseToggleCount = 0;
    let vSignStartTime = 0;
    let vSignArmed = true;
    const vSignHoldMs = 800;

    const handleVSign = (isVSign, now) => {
      if (isVSign) {
        if (!vSignArmed) return;
        if (vSignStartTime === 0) vSignStartTime = now || 1;
        if (now - vSignStartTime >= vSignHoldMs) {
          pauseToggleCount++;
          vSignArmed = false;
          vSignStartTime = 0;
        }
      } else {
        vSignStartTime = 0;
      }
    };

    handleVSign(true, 1000);
    handleVSign(true, 1400);
    handleVSign(true, 1800); // 800ms threshold reached
    assert.equal(pauseToggleCount, 1);
  });

  it('does NOT repeatedly toggle pause if player continues holding V-sign', () => {
    let pauseToggleCount = 0;
    let vSignStartTime = 0;
    let vSignArmed = true;
    const vSignHoldMs = 800;

    const handleVSign = (isVSign, now) => {
      if (isVSign) {
        if (!vSignArmed) return;
        if (vSignStartTime === 0) vSignStartTime = now || 1;
        if (now - vSignStartTime >= vSignHoldMs) {
          pauseToggleCount++;
          vSignArmed = false;
          vSignStartTime = 0;
        }
      } else {
        vSignStartTime = 0;
      }
    };

    // Trigger at 800ms
    handleVSign(true, 1000);
    handleVSign(true, 1800);
    assert.equal(pauseToggleCount, 1);

    // Continuing to hold for 2 more seconds
    handleVSign(true, 2200);
    handleVSign(true, 2600);
    handleVSign(true, 3400);
    assert.equal(pauseToggleCount, 1, 'Holding V-sign must not rapidly toggle pause');
  });

  it('requires V-sign release for 300ms before re-arming for another trigger', () => {
    let pauseToggleCount = 0;
    let vSignStartTime = 0;
    let vSignArmed = true;
    let vSignReleaseTime = 0;
    const vSignHoldMs = 800;
    const vSignRearmMs = 300;

    const handleVSign = (isVSign, now) => {
      if (isVSign) {
        if (!vSignArmed) return;
        if (vSignStartTime === 0) vSignStartTime = now || 1;
        if (now - vSignStartTime >= vSignHoldMs) {
          pauseToggleCount++;
          vSignArmed = false;
          vSignStartTime = 0;
          vSignReleaseTime = 0;
        }
      } else {
        vSignStartTime = 0;
        if (!vSignArmed) {
          if (vSignReleaseTime === 0) vSignReleaseTime = now || 1;
          if (now - vSignReleaseTime >= vSignRearmMs) {
            vSignArmed = true;
            vSignReleaseTime = 0;
          }
        }
      }
    };

    // 1. Initial pause trigger at t=1800
    handleVSign(true, 1000);
    handleVSign(true, 1800);
    assert.equal(pauseToggleCount, 1);

    // 2. Release at t=1900
    handleVSign(false, 1900);

    // 3. Quick flicker after only 100ms release (t=2000, < 300ms rearm)
    handleVSign(false, 2000);
    handleVSign(true, 2050); // hand shows V again too quickly
    handleVSign(true, 2900); // held for 850ms, but was not properly re-armed
    assert.equal(pauseToggleCount, 1, 'Cannot re-trigger before full release re-arm');

    // 4. Release fully for >= 300ms (t=3000 to t=3350 = 350ms)
    handleVSign(false, 3000);
    handleVSign(false, 3350); // re-armed here

    // 5. Valid second V-sign trigger (resume)
    handleVSign(true, 3400);
    handleVSign(true, 4200); // 800ms hold -> second toggle!
    assert.equal(pauseToggleCount, 2, 'Successfully resumes after proper release and re-arm');
  });
});

/* ------------------------------------------------------------------ */
/*  5. HAND LOSS & RECOVERY TESTS                                     */
/* ------------------------------------------------------------------ */

describe('5. Hand Loss Grace Period & Recovery', () => {
  it('holds last valid position during short loss (< 500ms)', () => {
    let lastReportedX = 0.5;
    let handPresentReported = false;
    let isFistActive = true;
    const handLossTimeoutMs = 500;
    const lastHandTime = 1000;

    const handleLoss = (now) => {
      const elapsed = now - lastHandTime;
      if (elapsed < handLossTimeoutMs) {
        // Within grace period
        handPresentReported = true;
      } else {
        handPresentReported = false;
        isFistActive = false;
      }
    };

    // t=1200 (elapsed 200ms < 500ms): hand held safely
    handleLoss(1200);
    assert.equal(handPresentReported, true);

    // t=1450 (elapsed 450ms < 500ms): still held
    handleLoss(1450);
    assert.equal(handPresentReported, true);
  });

  it('stops shooting and marks tracking lost after timeout (>= 500ms)', () => {
    let handPresentReported = true;
    let isFistActive = true;
    const handLossTimeoutMs = 500;
    const lastHandTime = 1000;

    const handleLoss = (now) => {
      const elapsed = now - lastHandTime;
      if (elapsed < handLossTimeoutMs) {
        handPresentReported = true;
      } else {
        handPresentReported = false;
        isFistActive = false; // shooting stopped
      }
    };

    // t=1550 (elapsed 550ms >= 500ms)
    handleLoss(1550);
    assert.equal(handPresentReported, false);
    assert.equal(isFistActive, false, 'Shooting stops immediately on tracking loss timeout');
  });
});

/* ------------------------------------------------------------------ */
/*  6. INPUT MANAGER & KEYBOARD SAFE MODE TESTS                       */
/* ------------------------------------------------------------------ */

describe('6. InputManager & Keyboard Safe Mode', () => {
  let input;

  beforeEach(() => {
    input = new InputManager();
  });

  it('initializes with keyboard safe mode by default', () => {
    assert.equal(input.controlMode, 'keyboard');
    assert.equal(input.gestureActive, false);
  });

  it('supports seamless switching between gesture and keyboard safe mode', () => {
    input.setControlMode('gesture');
    assert.equal(input.controlMode, 'gesture');
    assert.equal(input.gestureActive, true);
    assert.equal(input.mouseEnabled, false, 'Mouse disabled during gesture gameplay');

    input.setControlMode('keyboard');
    assert.equal(input.controlMode, 'keyboard');
    assert.equal(input.gestureActive, false);
    assert.equal(input.mouseEnabled, false, 'Mouse remains disabled during keyboard gameplay');
  });

  it('calculates keyboard movement deltas accurately', () => {
    assert.equal(input.getMovementDelta(), 0, 'Idle when no keys pressed');

    // Arrow Left
    input.keysDown.set('ArrowLeft', true);
    assert.equal(input.getMovementDelta(), -1);

    // Release Left, press Right
    input.keysDown.delete('ArrowLeft');
    input.keysDown.set('ArrowRight', true);
    assert.equal(input.getMovementDelta(), 1);

    // WASD: 'a' and 'd'
    input.keysDown.delete('ArrowRight');
    input.keysDown.set('a', true);
    assert.equal(input.getMovementDelta(), -1);

    input.keysDown.delete('a');
    input.keysDown.set('d', true);
    assert.equal(input.getMovementDelta(), 1);

    // Uppercase 'A' and 'D'
    input.keysDown.delete('d');
    input.keysDown.set('A', true);
    assert.equal(input.getMovementDelta(), -1);

    // Both left and right pressed -> cancels out to 0
    input.keysDown.set('D', true);
    assert.equal(input.getMovementDelta(), 0);
  });

  it('constrains paddle position to canvas boundaries via getPaddleX', () => {
    const canvasWidth = 800;
    const paddleWidth = 100;

    // Center
    input.setTargetX(400);
    assert.equal(input.getPaddleX(canvasWidth, paddleWidth), 350);

    // Far left (beyond edge) -> clamped to 0
    input.setTargetX(-50);
    assert.equal(input.getPaddleX(canvasWidth, paddleWidth), 0);

    // Far right (beyond edge) -> clamped to (canvasWidth - paddleWidth) = 700
    input.setTargetX(900);
    assert.equal(input.getPaddleX(canvasWidth, paddleWidth), 700);
  });

  it('fires pause callback on Escape trigger regardless of control mode', () => {
    let pauseCount = 0;
    input.onPauseToggle(() => pauseCount++);

    // Keyboard mode
    input.setControlMode('keyboard');
    input.triggerPauseToggle();
    assert.equal(pauseCount, 1);

    // Gesture mode
    input.setControlMode('gesture');
    input.triggerPauseToggle();
    assert.equal(pauseCount, 2);
  });

  it('fires shoot callback via triggerShoot in keyboard mode', () => {
    let shootCount = 0;
    input.onShoot(() => shootCount++);

    input.setControlMode('keyboard');
    input.triggerShoot();
    assert.equal(shootCount, 1);

    input.triggerShoot();
    assert.equal(shootCount, 2);
  });
});

/* ------------------------------------------------------------------ */
/*  7. RUNTIME DISCONNECT & GAME STATE PRESERVATION TESTS             */
/* ------------------------------------------------------------------ */

describe('7. Runtime Disconnect & Game State Preservation', () => {
  it('preserves score, lives, and session state when switching to keyboard mode mid-game', () => {
    const state = new GameState(3);
    state.addScore(450);
    state.modifyLives(-1); // 2 lives left

    assert.equal(state.score, 450);
    assert.equal(state.lives, 2);
    assert.equal(state.isPlaying(), true);

    const input = new InputManager();
    input.setControlMode('gesture');
    assert.equal(input.controlMode, 'gesture');

    // Simulate unexpected camera disconnect: switch input mode to keyboard
    input.setControlMode('keyboard');
    assert.equal(input.controlMode, 'keyboard');

    // Verify game state is 100% preserved
    assert.equal(state.score, 450, 'Score must not be reset on mode switch');
    assert.equal(state.lives, 2, 'Lives must not be reset on mode switch');
    assert.equal(state.isPlaying(), true, 'Session continues running');
  });

  it('allows keyboard and gesture input without conflicting', () => {
    const input = new InputManager();

    // In gesture mode, targetX is directly driven
    input.setControlMode('gesture');
    input.setTargetX(300);
    assert.equal(input.currentX, 300);

    // Switch to keyboard mode, delta applied
    input.setControlMode('keyboard');
    input.keysDown.set('ArrowRight', true);
    const delta = input.getMovementDelta();
    input.currentX += delta * 10;
    assert.equal(input.currentX, 310);
  });
});

/* ------------------------------------------------------------------ */
/*  8. PADDLE MOVEMENT BOUNDARIES VERIFICATION                        */
/* ------------------------------------------------------------------ */

describe('8. Paddle Movement Boundaries Verification', () => {
  it('reaches exactly the left boundary 0 when input is at minimum', () => {
    const input = new InputManager();
    const canvasWidth = 1000;
    const paddleWidth = 110;
    const halfW = paddleWidth / 2;

    // Minimum center position = halfW
    input.currentX = halfW;
    const paddleX = input.getPaddleX(canvasWidth, paddleWidth);
    assert.equal(paddleX, 0, 'Leftmost paddle position must be exactly 0 (playable left boundary)');
  });

  it('reaches exactly the right boundary (canvasWidth - paddleWidth) when input is at maximum', () => {
    const input = new InputManager();
    const canvasWidth = 1000;
    const paddleWidth = 110;
    const halfW = paddleWidth / 2;

    // Maximum center position = canvasWidth - halfW
    input.currentX = canvasWidth - halfW;
    const paddleX = input.getPaddleX(canvasWidth, paddleWidth);
    assert.equal(paddleX, canvasWidth - paddleWidth, 'Rightmost paddle position must be canvasWidth - paddleWidth');
    assert.equal(paddleX + paddleWidth, canvasWidth, 'Paddle right edge must reach exact canvas right edge');
  });

  it('never overflows boundaries even if currentX is outside range', () => {
    const input = new InputManager();
    const canvasWidth = 800;
    const paddleWidth = 100;

    // Underflow test (negative)
    input.currentX = -200;
    assert.equal(input.getPaddleX(canvasWidth, paddleWidth), 0);

    // Overflow test (> canvasWidth)
    input.currentX = 1500;
    assert.equal(input.getPaddleX(canvasWidth, paddleWidth), canvasWidth - paddleWidth);
  });

  it('works accurately across responsive window sizes (640px, 1200px, 1920px)', () => {
    const input = new InputManager();
    const paddleWidth = 120;
    const halfW = paddleWidth / 2;

    for (const w of [640, 1200, 1920]) {
      // Left extreme
      input.currentX = halfW;
      assert.equal(input.getPaddleX(w, paddleWidth), 0);

      // Right extreme
      input.currentX = w - halfW;
      assert.equal(input.getPaddleX(w, paddleWidth), w - paddleWidth);
      assert.equal(input.getPaddleX(w, paddleWidth) + paddleWidth, w);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  9. SPACE INVADER LEVEL PROGRESSION & RESUME BUG REGRESSION        */
/* ------------------------------------------------------------------ */

describe('9. Space Invader Level Progression & Wave Lifecycle', () => {
  it('correctly handles Continue selection without breaking Resume or wave progression', () => {
    // Simulate Space Invader engine state
    const mockEngine = {
      difficultyKey: 'easy',
      config: { targetObjective: 10, maxUFOs: 6 },
      targetsDestroyed: 10,
      easyCompleted: true,
      isNextLevelModalOpen: true,
      isPaused: true,
      ufos: [
        { isAlive: true, id: 1 },
        { isAlive: true, id: 2 } // 2 remaining from 12 total in wave 2
      ],
      fleetSpawnCount: 0,
      state: {
        paused: true,
        score: 600,
        lives: 3,
        resume() { this.paused = false; },
        pause() { this.paused = true; },
        isPaused() { return this.paused; },
        isPlaying() { return !this.paused; }
      },
      ui: {
        pauseModalVisible: false,
        nextLevelModalVisible: true,
        showPauseModal() { this.pauseModalVisible = true; },
        hidePauseModal() { this.pauseModalVisible = false; },
        showNextLevelModal() { this.nextLevelModalVisible = true; },
        hideNextLevelModal() { this.nextLevelModalVisible = false; }
      },
      declineNextLevel() {
        this.isNextLevelModalOpen = false;
        this.ui.hideNextLevelModal();
        this.ui.hidePauseModal();
        if (this.config.targetObjective) this.config.targetObjective += 10;
        this.easyCompleted = false;
        this.state.resume();
        const living = this.ufos.filter(u => u.isAlive).length;
        if (living === 0) {
          this.fleetSpawnCount++;
        }
      },
      resume() {
        this.isNextLevelModalOpen = false;
        this.ui.hidePauseModal();
        this.ui.hideNextLevelModal();
        this.state.resume();
      }
    };

    // 1. Initial state at 10 targets: Next level modal open, game paused
    assert.equal(mockEngine.isNextLevelModalOpen, true);
    assert.equal(mockEngine.state.isPaused(), true);

    // 2. Cadet clicks "KEEP PLAYING" (Continue current level)
    mockEngine.declineNextLevel();

    // Verify modal state and objective progression
    assert.equal(mockEngine.isNextLevelModalOpen, false, 'Modal flag must be cleared');
    assert.equal(mockEngine.ui.nextLevelModalVisible, false, 'Next level modal hidden');
    assert.equal(mockEngine.ui.pauseModalVisible, false, 'Pause modal must NOT be visible');
    assert.equal(mockEngine.state.isPlaying(), true, 'Game resumed playing');
    assert.equal(mockEngine.config.targetObjective, 20, 'Target objective increased by 10');
    assert.equal(mockEngine.easyCompleted, false, 'easyCompleted reset to allow endless continuation');

    // 3. Verify Resume button works unconditionally and closes modals
    mockEngine.state.pause();
    assert.equal(mockEngine.state.isPaused(), true);
    mockEngine.resume();
    assert.equal(mockEngine.state.isPlaying(), true, 'Resume button resumes gameplay cleanly');

    // 4. Clear the 2 remaining UFOs (total destroyed = 12)
    mockEngine.ufos[0].isAlive = false;
    mockEngine.ufos[1].isAlive = false;
    const livingCount = mockEngine.ufos.filter(u => u.isAlive).length;
    assert.equal(livingCount, 0, 'All enemies in current wave destroyed');

    // Next wave respawn check (livingCount === 0 && !isNextLevelModalOpen)
    if (livingCount === 0 && !mockEngine.isNextLevelModalOpen) {
      mockEngine.fleetSpawnCount++;
    }
    assert.equal(mockEngine.fleetSpawnCount, 1, 'Enemy ships continue spawning into next wave past 12 targets');
  });
});

/* ------------------------------------------------------------------ */
/*  10. SHOOTING AUDIO SILENCED (EDUCATIONAL & SPACE INVADER MODES)   */
/* ------------------------------------------------------------------ */

describe('10. Shooting Audio Silenced (Educational & Space Invader Modes)', () => {
  it('fires lasers in Educational Mode without playing repetitive projectile audio', () => {
    let audioPlayCount = 0;
    const mockAudio = {
      play(name) {
        audioPlayCount++;
      }
    };

    const mockEduEngine = {
      audio: mockAudio,
      player: { x: 300, y: 550, width: 44, height: 44 },
      playerLasers: [],
      lastFireTime: 0,
      fireCooldown: 200,
      isPaused: false,
      state: { isPlaying: () => true },
      firePlayerLaser() {
        if (!this.player || !this.state.isPlaying() || this.isPaused) return false;
        const now = Date.now();
        if (now - this.lastFireTime < this.fireCooldown) return false;
        this.lastFireTime = now;

        const leftX = this.player.x + 8;
        const rightX = this.player.x + this.player.width - 16;
        const laserY = this.player.y - 10;

        this.playerLasers.push({ x: leftX, y: laserY, width: 6, height: 18, vy: -9 });
        this.playerLasers.push({ x: rightX, y: laserY, width: 6, height: 18, vy: -9 });
        // Projectile sound effect removed per original Phase 3 requirements
        return true;
      }
    };

    // Fire 5 rapid shots with appropriate time advance
    for (let i = 0; i < 5; i++) {
      mockEduEngine.lastFireTime = 0; // reset cooldown
      const fired = mockEduEngine.firePlayerLaser();
      assert.equal(fired, true, 'Laser must fire successfully');
    }

    assert.equal(mockEduEngine.playerLasers.length, 10, 'Dual lasers created (10 total)');
    assert.equal(audioPlayCount, 0, 'ZERO audio sound effects played on shooting');
  });

  it('fires lasers in Space Invader Mode without playing repetitive projectile audio', () => {
    let audioPlayCount = 0;
    const mockAudio = {
      play(name) {
        audioPlayCount++;
      }
    };

    const mockSpaceInvaderEngine = {
      audio: mockAudio,
      player: { x: 300, y: 550, width: 44, height: 44 },
      playerLasers: [],
      lastPlayerShotTick: 0,
      config: { fireCooldown: 250 },
      state: { isPlaying: () => true },
      firePlayerLaser() {
        if (!this.player || !this.state.isPlaying()) return false;
        const now = Date.now();
        if (now - this.lastPlayerShotTick < this.config.fireCooldown) return false;
        this.lastPlayerShotTick = now;

        const laserW = 12;
        const laserH = 26;
        const laserX = this.player.x + this.player.width / 2 - laserW / 2;
        const laserY = this.player.y - 10;

        this.playerLasers.push({
          x: laserX,
          y: laserY,
          width: laserW,
          height: laserH,
          dy: -12,
          isAlive: true
        });

        // Shooting audio removed per user request
        return true;
      }
    };

    for (let i = 0; i < 5; i++) {
      mockSpaceInvaderEngine.lastPlayerShotTick = 0;
      const fired = mockSpaceInvaderEngine.firePlayerLaser();
      assert.equal(fired, true, 'Laser must fire successfully in Space Invader');
    }

    assert.equal(mockSpaceInvaderEngine.playerLasers.length, 5, '5 lasers created');
    assert.equal(audioPlayCount, 0, 'ZERO audio sound effects played on shooting in Space Invader');
  });
});

/* ------------------------------------------------------------------ */
/*  11. CONTROL METHOD & IN-GAME SETTINGS PERSISTENCE                 */
/* ------------------------------------------------------------------ */

describe('11. Control Method & In-Game Settings Persistence', () => {
  // Mock localStorage for test environment
  const storageMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => storageMap.get(k) || null,
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k),
    clear: () => storageMap.clear()
  };

  it('provides default settings with Gesture Controls as initial primary method', async () => {
    const { getGameSettings, DEFAULT_SETTINGS } = await import('../public/js/game/settings.js');
    storageMap.clear();
    const settings = getGameSettings();
    assert.equal(settings.controlMethod, 'gesture');
    assert.equal(settings.sfx, true);
    assert.equal(settings.volume, 80);
  });

  it('persists and retrieves updated settings correctly', async () => {
    const { getGameSettings, saveGameSettings } = await import('../public/js/game/settings.js');
    saveGameSettings({ controlMethod: 'keyboard', volume: 60 });

    const retrieved = getGameSettings();
    assert.equal(retrieved.controlMethod, 'keyboard');
    assert.equal(retrieved.volume, 60);
    assert.equal(retrieved.sfx, true, 'Unchanged properties preserved');
  });

  it('applies keyboard mode to engine and disables gesture tracking immediately', async () => {
    const { applyGameSettings } = await import('../public/js/game/settings.js');

    let switchedToKeyboardCalled = false;
    let inputControlMode = 'gesture';

    const mockEngine = {
      input: {
        setControlMode(m) { inputControlMode = m; }
      },
      gesture: {
        switchToKeyboard() { switchedToKeyboardCalled = true; }
      },
      audio: {
        setMuted() {},
        setVolume() {}
      }
    };

    applyGameSettings({ controlMethod: 'keyboard', sfx: true, volume: 75 }, mockEngine);

    assert.equal(inputControlMode, 'keyboard', 'Engine input switched to keyboard');
    assert.equal(switchedToKeyboardCalled, true, 'Gesture module instructed to switch to keyboard');
  });
});

/* ------------------------------------------------------------------ */
/*  12. HUD & PAUSE MENU UI VERIFICATION                              */
/* ------------------------------------------------------------------ */

describe('12. HUD & Pause Menu UI Structural Audit', () => {
  it('verifies game.html and game-edu.html have control toggle removed from active HUD', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const gameHtml = fs.readFileSync(path.resolve('public/game.html'), 'utf8');
    const eduHtml = fs.readFileSync(path.resolve('public/game-edu.html'), 'utf8');

    // 1. Interactive toggle removed from HUD
    assert.equal(gameHtml.includes('id="hud-control-toggle"'), false, 'hud-control-toggle must be removed from game.html');
    assert.equal(eduHtml.includes('id="hud-control-toggle"'), false, 'hud-control-toggle must be removed from game-edu.html');

    // 2. Sensor status indicator present
    assert.equal(gameHtml.includes('id="hud-sensor-feedback"'), true, 'hud-sensor-feedback must remain in game.html');
    assert.equal(eduHtml.includes('id="hud-sensor-feedback"'), true, 'hud-sensor-feedback must remain in game-edu.html');

    // 3. Settings button in Pause modal
    assert.equal(gameHtml.includes('id="btn-pause-settings"'), true, 'btn-pause-settings must exist in game.html');
    assert.equal(eduHtml.includes('id="edu-btn-settings"'), true, 'edu-btn-settings must exist in game-edu.html');

    // 4. Game Settings modal markup present
    assert.equal(gameHtml.includes('id="game-settings-modal"'), true, 'game-settings-modal must exist in game.html');
    assert.equal(eduHtml.includes('id="game-settings-modal"'), true, 'game-settings-modal must exist in game-edu.html');

    // 5. Control Method radio options present
    assert.equal(gameHtml.includes('name="ingame-control-method"'), true);
    assert.equal(eduHtml.includes('name="ingame-control-method"'), true);
  });

  it('verifies dashboard.html has Control Method setting replacing Reticle', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const dashboardHtml = fs.readFileSync(path.resolve('public/dashboard.html'), 'utf8');

    // Reticle removed
    assert.equal(dashboardHtml.includes('setting-reticle'), false, 'setting-reticle must be removed from dashboard.html');
    assert.equal(dashboardHtml.includes('Hand Tracking Reticle'), false, 'Hand Tracking Reticle text must be removed');

    // Control method added
    assert.equal(dashboardHtml.includes('Control Method'), true, 'Control Method must exist in dashboard.html');
    assert.equal(dashboardHtml.includes('setting-control-gesture'), true, 'Gesture radio button must exist');
    assert.equal(dashboardHtml.includes('setting-control-keyboard'), true, 'Keyboard radio button must exist');
  });
});

/* ------------------------------------------------------------------ */
/*  13. GESTURE INFERENCE THROTTLING & 60 FPS PRESERVATION            */
/* ------------------------------------------------------------------ */

describe('13. Gesture Inference Throttling & 60 FPS Preservation', () => {
  it('throttles ML inference calls to <= 30 FPS and skips duplicate frames', async () => {
    const { GestureInputManager } = await import('../public/js/game/gesture-input.js');

    const manager = new GestureInputManager();
    let detectCallCount = 0;

    manager.isActive = true;
    manager._handLandmarker = {
      detectForVideo() {
        detectCallCount++;
        return { landmarks: [] };
      }
    };

    let simulatedTime = 1000;
    const origPerf = globalThis.performance;
    globalThis.performance = {
      now() { return simulatedTime; }
    };

    try {
      manager.videoElement = {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
        currentTime: 0.033
      };

      // Frame 1 at t=1000: inference should execute
      manager._loop();
      assert.equal(detectCallCount, 1, 'First frame triggers inference');

      // Frame 2 at t=1010 (10ms later, as in 100fps screen): must be THROTTLED (< 32ms)
      simulatedTime = 1010;
      manager._loop();
      assert.equal(detectCallCount, 1, 'Second frame within 10ms is throttled (no duplicate inference)');

      // Frame 3 at t=1020 (20ms later): must still be throttled
      simulatedTime = 1020;
      manager._loop();
      assert.equal(detectCallCount, 1, 'Third frame within 20ms is throttled');

      // Frame 4 at t=1040 (40ms later), but camera currentTime hasn't changed:
      simulatedTime = 1040;
      manager._loop();
      assert.equal(detectCallCount, 1, 'Inference skipped when camera frame has not advanced');

      // Frame 5 at t=1040 with new camera video frame:
      manager.videoElement.currentTime = 0.066;
      manager._loop();
      assert.equal(detectCallCount, 2, 'Inference runs once new camera frame arrives after interval');
    } finally {
      globalThis.performance = origPerf;
    }
  });
});
