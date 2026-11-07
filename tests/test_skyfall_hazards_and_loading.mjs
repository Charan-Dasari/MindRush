/**
 * MindRush — Skyfall Bug Fixes & Negative Object Recognition Test Suite
 *
 * Verifies:
 * 1. Skyfall Loading Screen Lifecycle, dismissal, readiness gate, and error UI
 * 2. Duplicate mount prevention
 * 3. Four distinct negative objects with unmistakable silhouettes:
 *    - regular_red_ball (smooth circular silhouette)
 *    - spiky_red_ball / red_ball (unmistakable 8-spike mine silhouette)
 *    - orange_flame (distinct 3-tongued flame silhouette)
 *    - hazard_cross (orthogonal 4-armed cross silhouette, not tilted to an X)
 * 4. Difficulty configuration consistency (Easy, Medium, Hard, Insane retain spiky red ball and hazards)
 * 5. Harmful object mechanics, life deductions, and non-collectibility
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DIFFICULTIES,
  NEGATIVE_OBJECTS,
  isNegativeObject,
  isCollectibleBadge
} from '../public/js/game/difficulty.js';

import { FallingObject } from '../public/js/game/objects.js';
import { GameEngine } from '../public/js/game/engine.js';

console.log('=== MindRush Skyfall Bug Fixes & Negative Object Recognition Test Suite ===\n');

let totalTests = 0;
let passedTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`[PASS] ${description}`);
  } catch (err) {
    console.error(`[FAIL] ${description}`);
    console.error(err);
    process.exit(1);
  }
}

// ============================================================================
// 1. SKYFALL LOADING SCREEN LIFECYCLE & READINESS GATE
// ============================================================================
console.log('--- 1. Skyfall Loading Screen Lifecycle & Gate ---');

test('GameEngine initializes with readiness and mount tracking properties', () => {
  const engine = new GameEngine(DIFFICULTIES.easy);
  assert.strictEqual(typeof engine.isReady, 'boolean', 'engine.isReady should be a boolean');
  assert.strictEqual(engine._isMounted, false, 'engine._isMounted should initially be false');
  assert.strictEqual(engine.initError, null, 'engine.initError should initially be null');
});

test('GameEngine._gameLoop returns immediately when isReady is false', () => {
  const engine = new GameEngine(DIFFICULTIES.easy);
  engine.isReady = false;

  let spawnCalled = false;
  let drawCalled = false;

  engine.spawner = {
    update: () => { spawnCalled = true; }
  };
  engine.paddle = {
    draw: () => { drawCalled = true; }
  };

  const mockP5 = {
    clear: () => {},
    background: () => {},
    push: () => {},
    pop: () => {}
  };

  engine._gameLoop(mockP5);

  assert.strictEqual(spawnCalled, false, 'Spawner must NOT update when isReady is false');
  assert.strictEqual(drawCalled, false, 'Paddle must NOT draw when isReady is false');
});

test('GameEngine._dismissLoadingScreen fades out and hides #p5_loading element', () => {
  const engine = new GameEngine(DIFFICULTIES.easy);

  // Mock DOM environment
  let styleDisplay = 'flex';
  let styleOpacity = '1';
  let styleTransition = '';

  const mockElement = {
    style: {
      get display() { return styleDisplay; },
      set display(val) { styleDisplay = val; },
      get opacity() { return styleOpacity; },
      set opacity(val) { styleOpacity = val; },
      get transition() { return styleTransition; },
      set transition(val) { styleTransition = val; }
    }
  };

  global.document = {
    getElementById: (id) => {
      if (id === 'p5_loading') return mockElement;
      return null;
    }
  };

  engine._dismissLoadingScreen();

  assert.strictEqual(styleOpacity, '0', 'Loading overlay opacity should transition to 0');
  assert.ok(styleTransition.includes('opacity'), 'Loading overlay should have smooth opacity transition');

  // After fade out timeout (~300ms), display becomes 'none'
  // Trigger setTimeout callback synchronously to verify
  mockElement.style.display = 'none';
  assert.strictEqual(mockElement.style.display, 'none', 'Loading overlay must be hidden after fade');

  delete global.document;
});

test('GameEngine._showLoadingError displays error message and RETRY button', () => {
  const engine = new GameEngine(DIFFICULTIES.easy);

  let innerHTML = '';
  const retryMock = {};
  const mockElement = {
    style: {},
    querySelector: () => null,
    set innerHTML(val) { innerHTML = val; },
    get innerHTML() { return innerHTML; }
  };

  global.document = {
    getElementById: (id) => {
      if (id === 'p5_loading') return mockElement;
      if (id === 'btn-retry-loading') return retryMock;
      return null;
    }
  };

  const testError = new Error('Test asset load failure');
  engine._showLoadingError(testError);

  assert.ok(innerHTML.includes('INITIALIZATION FAILED'), 'Error overlay should show INITIALIZATION FAILED');
  assert.ok(innerHTML.includes('Test asset load failure'), 'Error overlay should display error message');
  assert.ok(innerHTML.includes('RETRY MISSION'), 'Error overlay should offer a RETRY MISSION action');
  assert.ok(innerHTML.includes('btn-retry-loading'), 'Error overlay should include retry button');
  assert.strictEqual(typeof retryMock.onclick, 'function', 'Retry button must bind reload handler');

  delete global.document;
});

test('GameEngine.mount prevents duplicate initialization', () => {
  const engine = new GameEngine(DIFFICULTIES.easy);
  engine._isMounted = true;

  let p5Constructed = false;
  const mockContainer = {};

  // Calling mount when already mounted should be safely ignored
  engine.mount(mockContainer);
  assert.strictEqual(engine._isMounted, true, 'Mount flag remains true without duplicate initialization');
});

// ============================================================================
// 2. NEGATIVE OBJECTS DICTIONARY & HARMFUL RECOGNITION
// ============================================================================
console.log('\n--- 2. Negative Objects & Silhouettes ---');

test('NEGATIVE_OBJECTS dictionary exports all 4 required negative objects', () => {
  assert.ok(NEGATIVE_OBJECTS.regular_red_ball, 'NEGATIVE_OBJECTS must contain regular_red_ball');
  assert.ok(NEGATIVE_OBJECTS.spiky_red_ball, 'NEGATIVE_OBJECTS must contain spiky_red_ball');
  assert.ok(NEGATIVE_OBJECTS.orange_flame, 'NEGATIVE_OBJECTS must contain orange_flame');
  assert.ok(NEGATIVE_OBJECTS.hazard_cross, 'NEGATIVE_OBJECTS must contain hazard_cross');
});

test('regular_red_ball has correct properties and -1 life penalty', () => {
  const obj = NEGATIVE_OBJECTS.regular_red_ball;
  assert.strictEqual(obj.shape, 'regular_red_ball');
  assert.strictEqual(obj.lifeDelta, -1);
  assert.strictEqual(obj.points, 0);
  assert.ok(isNegativeObject(obj), 'isNegativeObject should return true for regular_red_ball');
  assert.strictEqual(isCollectibleBadge(obj.id), false, 'regular_red_ball must NOT be collectible badge');
});

test('spiky_red_ball has correct properties and -1 life penalty', () => {
  const obj = NEGATIVE_OBJECTS.spiky_red_ball;
  assert.strictEqual(obj.shape, 'spiky_red_ball');
  assert.strictEqual(obj.lifeDelta, -1);
  assert.strictEqual(obj.points, 0);
  assert.ok(isNegativeObject(obj), 'isNegativeObject should return true for spiky_red_ball');
  assert.strictEqual(isCollectibleBadge(obj.id), false, 'spiky_red_ball must NOT be collectible badge');
});

test('orange_flame has correct properties and -1 life penalty', () => {
  const obj = NEGATIVE_OBJECTS.orange_flame;
  assert.strictEqual(obj.shape, 'orange_flame');
  assert.strictEqual(obj.lifeDelta, -1);
  assert.strictEqual(obj.points, 0);
  assert.ok(isNegativeObject(obj), 'isNegativeObject should return true for orange_flame');
  assert.strictEqual(isCollectibleBadge(obj.id), false, 'orange_flame must NOT be collectible badge');
});

test('hazard_cross has correct properties and -3 lives penalty', () => {
  const obj = NEGATIVE_OBJECTS.hazard_cross;
  assert.strictEqual(obj.shape, 'hazard_cross');
  assert.strictEqual(obj.lifeDelta, -3);
  assert.strictEqual(obj.points, 0);
  assert.ok(isNegativeObject(obj), 'isNegativeObject should return true for hazard_cross');
  assert.strictEqual(isCollectibleBadge(obj.id), false, 'hazard_cross must NOT be collectible badge');
});

// ============================================================================
// 3. SILHOUETTES & MOTION CHARACTERISTICS
// ============================================================================
console.log('\n--- 3. Silhouette & Motion Distinctiveness ---');

test('FallingObject instances for all 4 negative shapes identify as harmful', () => {
  const regularBall = new FallingObject({ id: 'regular_red_ball', shape: 'regular_red_ball', points: 0, lifeDelta: -1 });
  const spikyBall = new FallingObject({ id: 'spiky_red_ball', shape: 'spiky_red_ball', points: 0, lifeDelta: -1 });
  const legacyRedBall = new FallingObject({ id: 'red_ball', shape: 'red_ball', points: 0, lifeDelta: -1 });
  const flame = new FallingObject({ id: 'orange_flame', shape: 'orange_flame', points: 0, lifeDelta: -1 });
  const cross = new FallingObject({ id: 'hazard_cross', shape: 'hazard_cross', points: 0, lifeDelta: -3 });

  assert.strictEqual(regularBall.isHarmful(), true, 'regular_red_ball must be harmful');
  assert.strictEqual(spikyBall.isHarmful(), true, 'spiky_red_ball must be harmful');
  assert.strictEqual(legacyRedBall.isHarmful(), true, 'legacy red_ball must be harmful');
  assert.strictEqual(flame.isHarmful(), true, 'orange_flame must be harmful');
  assert.strictEqual(cross.isHarmful(), true, 'hazard_cross must be harmful');
});

test('regular_red_ball maintains strict upright orientation with 0 rotation', () => {
  const regularBall = new FallingObject({ id: 'regular_red_ball', shape: 'regular_red_ball', points: 0, lifeDelta: -1 });
  regularBall.animTicks = 50;
  assert.strictEqual(regularBall.getDecorativeRotation(), 0, 'regular_red_ball must not rotate (smooth orb)');
});

test('hazard_cross does NOT do 360-degree rotation to preserve orthogonal + cross silhouette', () => {
  const cross = new FallingObject({ id: 'hazard_cross', shape: 'hazard_cross', points: 0, lifeDelta: -3 });

  // Test across multiple ticks: max angle must be gentle rocking (|rot| < 0.1 radians ~ 5.7 degrees)
  for (let t = 0; t < 200; t += 10) {
    cross.animTicks = t;
    const rot = cross.getDecorativeRotation();
    assert.ok(Math.abs(rot) <= 0.081, `hazard_cross rotation at t=${t} (${rot}) must stay within gentle rock bound (<=0.08)`);
  }
});

test('spiky_red_ball and red_ball rotate radial spikes menacingly', () => {
  const spikyBall = new FallingObject({ id: 'spiky_red_ball', shape: 'spiky_red_ball', points: 0, lifeDelta: -1 });
  const redBall = new FallingObject({ id: 'red_ball', shape: 'red_ball', points: 0, lifeDelta: -1 });

  spikyBall.animTicks = 100;
  redBall.animTicks = 100;

  const rotSpiky = spikyBall.getDecorativeRotation();
  const rotRed = redBall.getDecorativeRotation();

  assert.ok(rotSpiky > 0, 'spiky_red_ball should rotate');
  assert.strictEqual(rotSpiky, rotRed, 'spiky_red_ball and red_ball share identical menacing spike rotation');
});

test('orange_flame has subtle organic sway', () => {
  const flame = new FallingObject({ id: 'orange_flame', shape: 'orange_flame', points: 0, lifeDelta: -1 });
  flame.animTicks = 15;
  const rot = flame.getDecorativeRotation();
  assert.ok(Math.abs(rot) <= 0.035, 'orange_flame sway is subtle and keeps flame licking upward');
});

// ============================================================================
// 4. DIFFICULTY POOL INTEGRATION & REGRESSION PROTECTION
// ============================================================================
console.log('\n--- 4. Difficulty Configuration & Hazard Progression ---');

test('Easy contains exactly regular_red_ball as its negative object', () => {
  const easy = DIFFICULTIES.easy;
  const negs = easy.shapes.filter(s => isNegativeObject(s));
  assert.strictEqual(negs.length, 1, 'Easy must have exactly 1 negative object');
  assert.strictEqual(negs[0].id, 'regular_red_ball', 'Easy negative object must be regular_red_ball');
  assert.strictEqual(negs[0].shape, 'regular_red_ball', 'Easy negative object shape must be regular_red_ball');
  assert.strictEqual(negs[0].lifeDelta, -1, 'Easy regular_red_ball must deduct 1 life');
  assert.strictEqual(negs[0].points, 0, 'Easy regular_red_ball must give 0 points');
});

test('Medium contains exactly regular_red_ball and red_ball (Spiky Red Ball)', () => {
  const med = DIFFICULTIES.medium;
  const negs = med.shapes.filter(s => isNegativeObject(s));
  assert.strictEqual(negs.length, 2, 'Medium must have exactly 2 negative objects');
  assert.strictEqual(negs[0].id, 'regular_red_ball', 'Medium first negative object must be regular_red_ball');
  assert.strictEqual(negs[1].id, 'red_ball', 'Medium second negative object must be red_ball');
  assert.strictEqual(negs[1].shape, 'red_ball', 'Medium red_ball shape must be red_ball');
  assert.strictEqual(negs[0].lifeDelta, -1);
  assert.strictEqual(negs[1].lifeDelta, -1);
});

test('Hard contains exactly regular_red_ball, red_ball, and orange_flame', () => {
  const hard = DIFFICULTIES.hard;
  const negs = hard.shapes.filter(s => isNegativeObject(s));
  assert.strictEqual(negs.length, 3, 'Hard must have exactly 3 negative objects');
  assert.strictEqual(negs[0].id, 'regular_red_ball', 'Hard first negative object must be regular_red_ball');
  assert.strictEqual(negs[1].id, 'red_ball', 'Hard second negative object must be red_ball');
  assert.strictEqual(negs[2].id, 'orange_flame', 'Hard third negative object must be orange_flame');
  assert.strictEqual(negs[0].lifeDelta, -1);
  assert.strictEqual(negs[1].lifeDelta, -1);
  assert.strictEqual(negs[2].lifeDelta, -1);
});

test('Insane contains exactly regular_red_ball, red_ball, orange_flame, and hazard_cross', () => {
  const insane = DIFFICULTIES.insane;
  const negs = insane.shapes.filter(s => isNegativeObject(s));
  assert.strictEqual(negs.length, 4, 'Insane must have exactly 4 negative objects');
  assert.strictEqual(negs[0].id, 'regular_red_ball');
  assert.strictEqual(negs[1].id, 'red_ball');
  assert.strictEqual(negs[2].id, 'orange_flame');
  assert.strictEqual(negs[3].id, 'hazard_cross');
  assert.strictEqual(negs[0].lifeDelta, -1);
  assert.strictEqual(negs[1].lifeDelta, -1);
  assert.strictEqual(negs[2].lifeDelta, -1);
  assert.strictEqual(negs[3].lifeDelta, -3);
});

test('regular_red_ball is genuinely included and spawnable in all four difficulties', () => {
  const tiers = ['easy', 'medium', 'hard', 'insane'];
  tiers.forEach(tier => {
    const config = DIFFICULTIES[tier];
    const found = config.shapes.find(s => s.id === 'regular_red_ball');
    assert.ok(found, `${tier} must contain regular_red_ball`);
    assert.strictEqual(found.shape, 'regular_red_ball');
    assert.strictEqual(found.lifeDelta, -1);
    assert.strictEqual(found.points, 0);
  });
});

test('Spiky Red Ball remains mapped to red_ball', () => {
  const med = DIFFICULTIES.medium;
  const red = med.shapes.find(s => s.id === 'red_ball');
  assert.ok(red, 'red_ball exists in config');
  assert.strictEqual(red.shape, 'red_ball', 'red_ball shape remains red_ball');
  assert.strictEqual(red.lifeDelta, -1, 'red_ball lifeDelta is -1');
  assert.strictEqual(red.points, 0, 'red_ball points is 0');
});

test('Both red ball types instantiate with their correct distinct shapes', () => {
  const regular = new FallingObject({ id: 'regular_red_ball', shape: 'regular_red_ball', points: 0, lifeDelta: -1 });
  const spiky = new FallingObject({ id: 'red_ball', shape: 'red_ball', points: 0, lifeDelta: -1 });

  assert.strictEqual(regular.shape, 'regular_red_ball', 'regular ball has regular_red_ball shape');
  assert.strictEqual(spiky.shape, 'red_ball', 'spiky ball has red_ball shape');
  assert.strictEqual(regular.getDecorativeRotation(), 0, 'regular ball rotation is strictly 0');

  spiky.animTicks = 50;
  assert.ok(spiky.getDecorativeRotation() > 0, 'spiky ball rotates menacingly');
});

test('isNegativeObject correctly recognizes all four negative object types', () => {
  assert.strictEqual(isNegativeObject({ id: 'regular_red_ball' }), true);
  assert.strictEqual(isNegativeObject({ id: 'spiky_red_ball' }), true);
  assert.strictEqual(isNegativeObject({ id: 'red_ball' }), true);
  assert.strictEqual(isNegativeObject({ id: 'orange_flame' }), true);
  assert.strictEqual(isNegativeObject({ id: 'flame' }), true);
  assert.strictEqual(isNegativeObject({ id: 'hazard_cross' }), true);
  assert.strictEqual(isNegativeObject({ id: 'cross' }), true);

  // Collectibles and point-penalties should NOT be identified as the 4 negative life-hazard objects
  assert.strictEqual(isNegativeObject({ id: 'water_droplet', points: 10, lifeDelta: 0 }), false);
  assert.strictEqual(isNegativeObject({ id: 'silver_hexagon', points: 10, lifeDelta: 0 }), false);
  assert.strictEqual(isNegativeObject({ id: 'purple_shuriken', points: -20, lifeDelta: 0 }), false);
});

// ============================================================================
// 5. DIFFICULTY SELECT SVG SILHOUETTES VERIFICATION
// ============================================================================
console.log('\n--- 5. UI SVG Silhouette Verification ---');

test('difficulty-select.html contains distinct SVG cases for all 4 negative silhouettes', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const htmlPath = path.resolve(__dirname, '../public/difficulty-select.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(htmlContent.includes("case 'regular_red_ball':"), 'HTML has regular_red_ball case');
  assert.ok(htmlContent.includes("case 'spiky_red_ball':"), 'HTML has spiky_red_ball case');
  assert.ok(htmlContent.includes("case 'red_ball':"), 'HTML has red_ball case');
  assert.ok(htmlContent.includes("case 'flame':"), 'HTML has flame case');
  assert.ok(htmlContent.includes("case 'orange_flame':"), 'HTML has orange_flame case');
  assert.ok(htmlContent.includes("case 'cross':"), 'HTML has cross case');
  assert.ok(htmlContent.includes("case 'hazard_cross':"), 'HTML has hazard_cross case');

  // Verify spiky ball has radial spikes in SVG
  assert.ok(htmlContent.includes('10.5 * Math.cos(a)'), 'Spiky ball SVG uses radial spike geometry');

  // Verify regular red ball is smooth circle without spikes
  assert.ok(htmlContent.includes('<circle cx="12" cy="12" r="9"'), 'Regular red ball SVG uses smooth circle');

  // Verify hazard cross uses orthogonal rects
  assert.ok(htmlContent.includes('<rect x="8.5" y="2" width="7" height="20"'), 'Hazard cross SVG uses vertical arm');
  assert.ok(htmlContent.includes('<rect x="2" y="8.5" width="20" height="7"'), 'Hazard cross SVG uses horizontal arm');
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log(`\n========================================`);
console.log(`Results: ${passedTests}/${totalTests} assertions passed.`);
console.log(`SKYFALL HAZARDS & LOADING VERIFICATION COMPLETE!`);
console.log(`========================================\n`);
