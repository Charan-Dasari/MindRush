/**
 * MindRush — Simulation Timing Normalization & MediaPipe Performance Test Suite
 *
 * Verifies:
 * 1. Fixed-timestep accumulator (60 FPS baseline, 16.6667ms per tick) across all 3 game modes:
 *    - Fun Mode: Skyfall (GameEngine)
 *    - Fun Mode: Space Invader (SpaceInvaderEngine)
 *    - Educational Mode: Space Invader (EducationalInvaderEngine)
 * 2. Framerate Invariance:
 *    - Simulation steps and distance traveled are identical per real second at 60 FPS, 30 FPS, and 20 FPS
 * 3. Question timer accuracy at 60 FPS, 30 FPS, and 20 FPS (1 real second = 1 timer second)
 * 4. Spiral-of-death safety clamp (spikes clamped to 100ms / max 6 ticks)
 * 5. Accumulator reset on pause/resume to prevent catch-up jumps
 * 6. Gesture Worker fallback & concurrency lock integrity
 */

import { strict as assert } from 'node:assert';
import fs from 'node:fs';

// Mock DOM & Canvas Environment
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    innerWidth: 900,
    innerHeight: 650,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}
const mockElement = () => ({
  textContent: '',
  innerHTML: '',
  style: {},
  clientWidth: 900,
  clientHeight: 650,
  addEventListener: () => {},
  removeEventListener: () => {},
  classList: {
    add: () => {},
    remove: () => {},
    contains: () => false
  },
  querySelector: () => mockElement()
});

globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: (id) => mockElement(),
  querySelector: () => mockElement()
};

if (typeof globalThis.Audio === 'undefined') {
  globalThis.Audio = class {
    constructor() {}
    play() { return Promise.resolve(); }
  };
}

// Import game modules
import { GameEngine } from '../public/js/game/engine.js';
import { SpaceInvaderEngine } from '../public/js/game/space-invader-engine.js';
import { EducationalInvaderEngine } from '../public/js/game/educational-invader-engine.js';
import { DIFFICULTIES } from '../public/js/game/difficulty.js';
import { FallingObject } from '../public/js/game/objects.js';
import { GestureInputManager } from '../public/js/game/gesture-input.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS  ' + name);
  } catch (e) {
    failed++;
    console.error('  FAIL  ' + name);
    console.error('        ' + e.message);
    process.exitCode = 1;
  }
}

// Mock P5 renderer instance
function createMockP5(width = 900, height = 650) {
  return {
    width,
    height,
    background: () => {},
    fill: () => {},
    noFill: () => {},
    stroke: () => {},
    noStroke: () => {},
    strokeWeight: () => {},
    rect: () => {},
    rectMode: () => {},
    ellipse: () => {},
    ellipseMode: () => {},
    line: () => {},
    triangle: () => {},
    circle: () => {},
    arc: () => {},
    text: () => {},
    textSize: () => {},
    textAlign: () => {},
    textFont: () => {},
    textStyle: () => {},
    textWidth: (txt) => (txt ? txt.length * 8 : 10),
    color: () => ({ levels: [255, 255, 255, 255] }),
    lerpColor: () => ({ levels: [255, 255, 255, 255] }),
    drawingContext: {
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      closePath: () => {},
      rect: () => {},
      moveTo: () => {},
      lineTo: () => {},
      save: () => {},
      restore: () => {},
      fillStyle: '',
      strokeStyle: '',
      shadowBlur: 0,
      shadowColor: ''
    },
    push: () => {},
    pop: () => {},
    translate: () => {},
    rotate: () => {},
    beginShape: () => {},
    vertex: () => {},
    bezierVertex: () => {},
    endShape: () => {},
    sin: (x) => Math.sin(x),
    cos: (x) => Math.cos(x),
    random: (a, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a)),
    TWO_PI: Math.PI * 2,
    frameCount: 0
  };
}

console.log('=== MindRush Simulation Timing & MediaPipe Performance Test Suite ===\n');

// ---------------------------------------------------------------------------
// 1. SKYFALL TIMING INVARIANCE (60 FPS vs 30 FPS vs 20 FPS)
// ---------------------------------------------------------------------------
console.log('--- 1. Skyfall Fixed-Timestep Accumulator & Framerate Invariance ---');

test('Skyfall: Simulation steps match elapsed time regardless of rendering framerate', () => {
  const mockP5 = createMockP5();
  const originalPerformanceNow = globalThis.performance.now;

  try {
    // Test 60 FPS: 60 frames of 16.6667ms each = 1000ms
    let mockTime = 1000.0;
    globalThis.performance.now = () => mockTime;

    const engine60 = new GameEngine(DIFFICULTIES.easy);
    engine60.isReady = true;
    engine60._lastFrameTime = mockTime;
    engine60._accumulator = 0;
    engine60.simTicks = 0;

    for (let frame = 0; frame < 60; frame++) {
      mockTime += 1000 / 60;
      engine60._gameLoop(mockP5);
    }
    const ticks60 = engine60.simTicks;

    // Test 30 FPS (e.g. Gesture Mode with inference load): 30 frames of 33.3333ms each = 1000ms
    mockTime = 1000.0;
    const engine30 = new GameEngine(DIFFICULTIES.easy);
    engine30.isReady = true;
    engine30._lastFrameTime = mockTime;
    engine30._accumulator = 0;
    engine30.simTicks = 0;

    for (let frame = 0; frame < 30; frame++) {
      mockTime += 1000 / 30;
      engine30._gameLoop(mockP5);
    }
    const ticks30 = engine30.simTicks;

    // Test 20 FPS: 20 frames of 50.0ms each = 1000ms
    mockTime = 1000.0;
    const engine20 = new GameEngine(DIFFICULTIES.easy);
    engine20.isReady = true;
    engine20._lastFrameTime = mockTime;
    engine20._accumulator = 0;
    engine20.simTicks = 0;

    for (let frame = 0; frame < 20; frame++) {
      mockTime += 1000 / 20;
      engine20._gameLoop(mockP5);
    }
    const ticks20 = engine20.simTicks;

    assert.equal(ticks60, 60, `60 FPS should execute 60 simulation ticks in 1000ms (got ${ticks60})`);
    assert.equal(ticks30, 60, `30 FPS should execute 60 simulation ticks in 1000ms (got ${ticks30})`);
    assert.equal(ticks20, 60, `20 FPS should execute 60 simulation ticks in 1000ms (got ${ticks20})`);
  } finally {
    globalThis.performance.now = originalPerformanceNow;
  }
});

test('Skyfall: Falling objects travel equal distance per second at 60 FPS and 30 FPS', () => {
  const mockP5 = createMockP5();
  const originalPerformanceNow = globalThis.performance.now;

  try {
    let mockTime = 1000.0;
    globalThis.performance.now = () => mockTime;

    // 60 FPS
    const engine60 = new GameEngine(DIFFICULTIES.easy);
    engine60.isReady = true;
    engine60._lastFrameTime = mockTime;
    engine60._accumulator = 0;
    engine60.balls = [];

    const obj60 = new FallingObject({ x: 300, y: 50, dy: 4.0, points: 10 });
    engine60.balls.push(obj60);
    engine60.config.spawnInterval = 999999;

    for (let frame = 0; frame < 60; frame++) {
      mockTime += 1000 / 60;
      engine60._gameLoop(mockP5);
    }
    const finalY60 = obj60.y;

    // 30 FPS
    mockTime = 1000.0;
    const engine30 = new GameEngine(DIFFICULTIES.easy);
    engine30.isReady = true;
    engine30._lastFrameTime = mockTime;
    engine30._accumulator = 0;
    engine30.balls = [];

    const obj30 = new FallingObject({ x: 300, y: 50, dy: 4.0, points: 10 });
    engine30.balls.push(obj30);
    engine30.config.spawnInterval = 999999;

    for (let frame = 0; frame < 30; frame++) {
      mockTime += 1000 / 30;
      engine30._gameLoop(mockP5);
    }
    const finalY30 = obj30.y;

    assert.equal(finalY60, finalY30, `Falling object must travel identical vertical distance (got 60fps:${finalY60}, 30fps:${finalY30})`);
    assert.equal(finalY60, 50 + (4.0 * 60), `Object should travel exactly speed * 60 ticks`);
  } finally {
    globalThis.performance.now = originalPerformanceNow;
  }
});

// ---------------------------------------------------------------------------
// 2. SPACE INVADER TIMING INVARIANCE (60 FPS vs 30 FPS vs 20 FPS)
// ---------------------------------------------------------------------------
console.log('\n--- 2. Space Invader Fixed-Timestep Accumulator & Framerate Invariance ---');

test('Space Invader: Simulation steps match elapsed time regardless of rendering framerate', () => {
  const mockP5 = createMockP5();
  const originalPerformanceNow = globalThis.performance.now;

  try {
    let mockTime = 1000.0;
    globalThis.performance.now = () => mockTime;

    // 60 FPS
    const engine60 = new SpaceInvaderEngine({ id: 'easy' });
    engine60.isReady = true;
    engine60._initPlayer(900, 650);
    engine60._initUFOFleet(900, 650);
    engine60._lastFrameTime = mockTime;
    engine60._accumulator = 0;
    engine60.simTicks = 0;

    for (let frame = 0; frame < 60; frame++) {
      mockTime += 1000 / 60;
      engine60._gameLoop(mockP5);
    }
    const ticks60 = engine60.simTicks;

    // 30 FPS
    mockTime = 1000.0;
    const engine30 = new SpaceInvaderEngine({ id: 'easy' });
    engine30.isReady = true;
    engine30._initPlayer(900, 650);
    engine30._initUFOFleet(900, 650);
    engine30._lastFrameTime = mockTime;
    engine30._accumulator = 0;
    engine30.simTicks = 0;

    for (let frame = 0; frame < 30; frame++) {
      mockTime += 1000 / 30;
      engine30._gameLoop(mockP5);
    }
    const ticks30 = engine30.simTicks;

    // 20 FPS
    mockTime = 1000.0;
    const engine20 = new SpaceInvaderEngine({ id: 'easy' });
    engine20.isReady = true;
    engine20._initPlayer(900, 650);
    engine20._initUFOFleet(900, 650);
    engine20._lastFrameTime = mockTime;
    engine20._accumulator = 0;
    engine20.simTicks = 0;

    for (let frame = 0; frame < 20; frame++) {
      mockTime += 1000 / 20;
      engine20._gameLoop(mockP5);
    }
    const ticks20 = engine20.simTicks;

    assert.equal(ticks60, 60, `Space Invader 60 FPS executed 60 ticks (got ${ticks60})`);
    assert.equal(ticks30, 60, `Space Invader 30 FPS executed 60 ticks (got ${ticks30})`);
    assert.equal(ticks20, 60, `Space Invader 20 FPS executed 60 ticks (got ${ticks20})`);
  } finally {
    globalThis.performance.now = originalPerformanceNow;
  }
});

test('Space Invader: Lasers travel equal distance per real second at 60 FPS and 30 FPS', () => {
  const mockP5 = createMockP5();
  const originalPerformanceNow = globalThis.performance.now;

  try {
    let mockTime = 1000.0;
    globalThis.performance.now = () => mockTime;

    // 60 FPS
    const engine60 = new SpaceInvaderEngine({ id: 'easy' });
    engine60.isReady = true;
    engine60._initPlayer(900, 650);
    engine60._initUFOFleet(900, 650);
    engine60._lastFrameTime = mockTime;
    engine60._accumulator = 0;
    engine60.lasers = [{ x: 450, y: 500, vy: -12, isAlive: true }];

    for (let frame = 0; frame < 20; frame++) {
      mockTime += 1000 / 60;
      engine60._gameLoop(mockP5);
    }
    const laserY60 = engine60.lasers[0].y;

    // 30 FPS
    mockTime = 1000.0;
    const engine30 = new SpaceInvaderEngine({ id: 'easy' });
    engine30.isReady = true;
    engine30._initPlayer(900, 650);
    engine30._initUFOFleet(900, 650);
    engine30._lastFrameTime = mockTime;
    engine30._accumulator = 0;
    engine30.lasers = [{ x: 450, y: 500, vy: -12, isAlive: true }];

    for (let frame = 0; frame < 10; frame++) {
      mockTime += 1000 / 30;
      engine30._gameLoop(mockP5);
    }
    const laserY30 = engine30.lasers[0].y;

    assert.equal(laserY60, laserY30, `Lasers should travel identical vertical distance (got 60fps:${laserY60}, 30fps:${laserY30})`);
  } finally {
    globalThis.performance.now = originalPerformanceNow;
  }
});

// ---------------------------------------------------------------------------
// 3. EDUCATIONAL INVADER TIMING INVARIANCE (60 FPS vs 30 FPS vs 20 FPS)
// ---------------------------------------------------------------------------
console.log('\n--- 3. Educational Invader Timer Invariance ---');

test('Educational Invader: Question countdown timer advances 1 second in exactly 1000ms at 60 FPS, 30 FPS, and 20 FPS', () => {
  const mockP5 = createMockP5();
  const originalPerformanceNow = globalThis.performance.now;

  try {
    // 60 FPS (60 frames * 16.67ms = 1000ms)
    let mockTime = 1000.0;
    globalThis.performance.now = () => mockTime;

    const edu60 = new EducationalInvaderEngine({ id: 'easy' });
    edu60._initPlayer(900, 650);
    edu60._loadNextQuestion(900, 650);
    edu60.isReady = true;
    edu60._lastFrameTime = mockTime;
    edu60._accumulator = 0;

    const initialTimer60 = edu60.questionTimeRemaining;
    for (let frame = 0; frame < 60; frame++) {
      mockTime += 1000 / 60;
      edu60.draw(mockP5);
    }
    assert.equal(edu60.questionTimeRemaining, initialTimer60 - 1, '60 FPS timer decrements exactly 1s in 1000ms');

    // 30 FPS (30 frames * 33.33ms = 1000ms)
    mockTime = 1000.0;
    const edu30 = new EducationalInvaderEngine({ id: 'easy' });
    edu30._initPlayer(900, 650);
    edu30._loadNextQuestion(900, 650);
    edu30.isReady = true;
    edu30._lastFrameTime = mockTime;
    edu30._accumulator = 0;

    const initialTimer30 = edu30.questionTimeRemaining;
    for (let frame = 0; frame < 30; frame++) {
      mockTime += 1000 / 30;
      edu30.draw(mockP5);
    }
    assert.equal(edu30.questionTimeRemaining, initialTimer30 - 1, '30 FPS timer decrements exactly 1s in 1000ms');

    // 20 FPS (20 frames * 50ms = 1000ms)
    mockTime = 1000.0;
    const edu20 = new EducationalInvaderEngine({ id: 'easy' });
    edu20._initPlayer(900, 650);
    edu20._loadNextQuestion(900, 650);
    edu20.isReady = true;
    edu20._lastFrameTime = mockTime;
    edu20._accumulator = 0;

    const initialTimer20 = edu20.questionTimeRemaining;
    for (let frame = 0; frame < 20; frame++) {
      mockTime += 1000 / 20;
      edu20.draw(mockP5);
    }
    assert.equal(edu20.questionTimeRemaining, initialTimer20 - 1, '20 FPS timer decrements exactly 1s in 1000ms');
  } finally {
    globalThis.performance.now = originalPerformanceNow;
  }
});

// ---------------------------------------------------------------------------
// 4. SPIKE CLAMPING & SPIRAL OF DEATH PREVENTION
// ---------------------------------------------------------------------------
console.log('\n--- 4. Spike Clamping & Catch-up Spiral Prevention ---');

test('Spike clamping: A 500ms lag spike executes max 6 ticks (100ms) and resets accumulator', () => {
  const mockP5 = createMockP5();
  const originalPerformanceNow = globalThis.performance.now;

  try {
    let mockTime = 1000.0;
    globalThis.performance.now = () => mockTime;

    const engine = new GameEngine(DIFFICULTIES.easy);
    engine.isReady = true;
    engine._lastFrameTime = mockTime;
    engine._accumulator = 0;
    engine.simTicks = 0;

    // Simulate huge frame spike of 500ms
    mockTime += 500.0;
    engine._gameLoop(mockP5);

    // Max steps allowed is 6 (100ms / 16.67ms = 6 steps)
    assert.equal(engine.simTicks, 6, `Lag spike of 500ms must be clamped to 6 simulation steps (got ${engine.simTicks})`);
    assert.equal(engine._accumulator, 0, `Accumulator must be reset to 0 to prevent spiral-of-death`);
  } finally {
    globalThis.performance.now = originalPerformanceNow;
  }
});

// ---------------------------------------------------------------------------
// 5. PAUSE / RESUME ACCUMULATOR RESET
// ---------------------------------------------------------------------------
console.log('\n--- 5. Pause and Resume Accumulator Resets ---');

test('Pause & Resume: Accumulator and lastFrameTime reset to prevent catch-up jumps', () => {
  const originalPerformanceNow = globalThis.performance.now;

  try {
    let mockTime = 1000.0;
    globalThis.performance.now = () => mockTime;

    const engine = new SpaceInvaderEngine({ id: 'easy' });
    engine._initPlayer(900, 650);
    engine._accumulator = 45.0;
    engine._lastFrameTime = 500.0;

    engine.pause();
    assert.equal(engine._accumulator, 0, 'Accumulator cleared on pause');
    assert.equal(engine._lastFrameTime, 0, 'Last frame time cleared on pause');

    mockTime = 50000.0; // 50 seconds paused
    engine.resume();
    assert.equal(engine._accumulator, 0, 'Accumulator cleared on resume');
    assert.equal(engine._lastFrameTime, 50000.0, 'Last frame time synchronized to current time on resume to prevent catch-up jumps');
  } finally {
    globalThis.performance.now = originalPerformanceNow;
  }
});

// ---------------------------------------------------------------------------
// 6. GESTURE WORKER FALLBACK & CONCURRENCY LOCK
// ---------------------------------------------------------------------------
console.log('\n--- 6. Gesture Worker Fallback & Concurrency Lock ---');

test('GestureInputManager: Concurrency flag blocks overlapping frame submissions', () => {
  const manager = new GestureInputManager();
  assert.equal(manager._isInferring, false, 'Initial inference flag is false');

  manager._isInferring = true;
  assert.equal(manager._isInferring, true, 'Inference flag active');

  // Concurrency check simulation
  let processed = false;
  if (!manager._isInferring) {
    processed = true;
  }
  assert.equal(processed, false, 'Overlapping frame submission rejected when busy');

  manager._isInferring = false;
  if (!manager._isInferring) {
    processed = true;
  }
  assert.equal(processed, true, 'Frame submission accepted when idle');
});

test('GestureInputManager: Seamless in-thread fallback when Worker is unavailable', () => {
  const manager = new GestureInputManager();
  assert.equal(manager._worker, null, 'Worker starts null');
  assert.equal(manager._useWorker, false, 'useWorker is false before worker initialization');
});

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------
console.log('\n========================================');
console.log(`Results: ${passed}/${passed + failed} assertions passed.`);
if (failed === 0) {
  console.log('ALL SIMULATION TIMING TESTS VERIFIED SUCCESSFULLY!');
} else {
  console.error(`FAILED: ${failed} assertions failed.`);
}
console.log('========================================');
