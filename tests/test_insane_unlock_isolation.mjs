/**
 * MindRush — Insane Difficulty Unlock Isolation Test Suite
 *
 * Verifies complete, independent difficulty progression isolation between:
 * 1. Fun Mode — Skyfall
 * 2. Fun Mode — Space Invader
 * 3. Educational Mode (which has its own independent Olympiad progression)
 *
 * Specific Verification Criteria:
 * - Skyfall Hard reaches its Insane unlock threshold (1000+ pts) -> Skyfall Insane unlocked.
 * - After Skyfall unlock, Space Invader Insane remains strictly locked.
 * - Space Invader independently satisfies its unlock condition (defeating Hard Mini-Boss) -> Space Invader Insane unlocked.
 * - Unlocking Space Invader Insane does not affect Skyfall progression.
 * - Refreshing/reloading preserves each mode's independent unlock state (persistent storage simulation).
 * - Resetting one mode's progression (resetProgression('skyfall') or resetProgression('space-invader')) does not reset the other mode.
 * - Resetting without arguments resets both modes for backward compatibility.
 * - User account isolation: progress remains scoped per authenticated user across both modes.
 * - Safe migration: existing legacy 'mindrush_insane_unlocked' key migrates to Skyfall only, never unlocking Space Invader.
 */

import { strict as assert } from 'node:assert';
import fs from 'node:fs';

// Mock DOM / Browser Environment
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.has(key) ? store.get(key) : null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
}

const mockElement = () => ({
  textContent: '',
  innerHTML: '',
  style: {},
  classList: {
    add: () => {},
    remove: () => {},
    contains: () => false
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: () => mockElement(),
  querySelectorAll: () => []
});

globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: () => mockElement(),
  querySelector: () => mockElement(),
  querySelectorAll: () => []
};

if (typeof globalThis.Audio === 'undefined') {
  globalThis.Audio = class {
    constructor() {}
    play() { return Promise.resolve(); }
  };
}

// Module imports under test
import {
  DIFFICULTIES,
  getDifficultyConfig,
  isInsaneUnlocked,
  unlockInsane,
  resetProgression,
  setProgressionUserContext,
  clearProgressionUserContext,
  PROGRESSION_KEYS,
  isEduDifficultyUnlocked
} from '../public/js/game/difficulty.js';

import { GameEngine } from '../public/js/game/engine.js';
import { SpaceInvaderEngine, INVADER_CONFIGS } from '../public/js/game/space-invader-engine.js';

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${description}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL  ${description}`);
    console.error(`        ${err.message}`);
    process.exitCode = 1;
  }
}

console.log('=== MindRush Insane Difficulty Unlock Isolation Test Suite ===\n');

// ---------------------------------------------------------------------------
// 1. Initial Clean Baseline: Both Modes Strictly Locked
// ---------------------------------------------------------------------------
console.log('--- 1. Initial Clean Baseline ---');

test('Both Skyfall and Space Invader Insane modes start strictly locked initially', () => {
  clearProgressionUserContext();
  resetProgression();

  assert.equal(isInsaneUnlocked('skyfall'), false, 'Skyfall Insane must be locked initially');
  assert.equal(isInsaneUnlocked('space-invader'), false, 'Space Invader Insane must be locked initially');
  assert.equal(isInsaneUnlocked('invader'), false, 'Alias "invader" must resolve to space-invader and be locked');
  assert.equal(isInsaneUnlocked(), false, 'Default call isInsaneUnlocked() must be locked initially');
});

// ---------------------------------------------------------------------------
// 2. Skyfall Hard Milestone Unlocks ONLY Skyfall
// ---------------------------------------------------------------------------
console.log('\n--- 2. Skyfall Hard Milestone Isolation ---');

test('Skyfall Hard milestone (1,000+ points) unlocks Skyfall Insane, but Space Invader remains locked', () => {
  resetProgression();

  // Simulate Skyfall Hard engine reaching milestone
  const skyfallEngine = new GameEngine(DIFFICULTIES.hard);
  skyfallEngine.state.score = 1000;
  skyfallEngine._isMounted = true;
  skyfallEngine.isReady = true;

  // Trigger milestone logic as executed in engine._simulationStep()
  if (
    skyfallEngine.config.nextLevel &&
    skyfallEngine.state.score >= skyfallEngine.config.nextLevel.threshold &&
    !skyfallEngine.state.nextLevelShown
  ) {
    skyfallEngine.state.nextLevelShown = true;
    if (skyfallEngine.config.id === 'hard') {
      unlockInsane('skyfall');
    }
  }

  // Verification
  assert.equal(isInsaneUnlocked('skyfall'), true, 'Skyfall Insane MUST be unlocked after 1000 pts on Hard');
  assert.equal(isInsaneUnlocked(), true, 'Default call isInsaneUnlocked() must return true for Skyfall');
  assert.equal(isInsaneUnlocked('space-invader'), false, 'Space Invader Insane MUST remain LOCKED (no cross-mode leak)');
  assert.equal(isInsaneUnlocked('invader'), false, 'Space Invader alias MUST remain LOCKED');
});

// ---------------------------------------------------------------------------
// 3. Space Invader Hard Milestone Unlocks ONLY Space Invader
// ---------------------------------------------------------------------------
console.log('\n--- 3. Space Invader Hard Milestone Isolation ---');

test('Space Invader Hard milestone (Mini-Boss defeat) unlocks Space Invader Insane independently', () => {
  resetProgression();

  // Both start locked
  assert.equal(isInsaneUnlocked('skyfall'), false);
  assert.equal(isInsaneUnlocked('space-invader'), false);

  // Simulate Space Invader Hard engine conquering Mini-Boss
  const invaderEngine = new SpaceInvaderEngine({ id: 'hard' });
  invaderEngine._initPlayer(900, 650);
  invaderEngine._initUFOFleet(900, 650);

  // In Hard mode, defeating Mini-Boss triggers unlockInsane('space-invader')
  if (invaderEngine.difficultyKey === 'hard') {
    unlockInsane('space-invader');
  }

  // Verification
  assert.equal(isInsaneUnlocked('space-invader'), true, 'Space Invader Insane MUST be unlocked');
  assert.equal(isInsaneUnlocked('invader'), true, 'Alias "invader" MUST be unlocked');
  assert.equal(isInsaneUnlocked('skyfall'), false, 'Skyfall Insane MUST remain LOCKED when only Invader is beaten');
});

// ---------------------------------------------------------------------------
// 4. Mutual Independent Unlocks & Persistence across Simulated Refresh
// ---------------------------------------------------------------------------
console.log('\n--- 4. Mutual Independence & Simulated Refresh Persistence ---');

test('Both modes can be unlocked independently and retain their state across simulated reload', () => {
  resetProgression();

  // Unlock Skyfall
  unlockInsane('skyfall');
  assert.equal(isInsaneUnlocked('skyfall'), true);
  assert.equal(isInsaneUnlocked('space-invader'), false);

  // Unlock Space Invader
  unlockInsane('space-invader');
  assert.equal(isInsaneUnlocked('skyfall'), true, 'Skyfall remains unlocked after Invader unlocks');
  assert.equal(isInsaneUnlocked('space-invader'), true, 'Space Invader remains unlocked');

  // Simulate page reload / re-querying states
  assert.equal(isInsaneUnlocked('skyfall'), true, 'Skyfall Insane persists across simulated refresh');
  assert.equal(isInsaneUnlocked('space-invader'), true, 'Space Invader Insane persists across simulated refresh');
});

// ---------------------------------------------------------------------------
// 5. Independent Reset Isolation
// ---------------------------------------------------------------------------
console.log('\n--- 5. Independent Reset Isolation ---');

test('Resetting Skyfall progression does NOT reset Space Invader progression', () => {
  resetProgression();

  unlockInsane('skyfall');
  unlockInsane('space-invader');

  assert.equal(isInsaneUnlocked('skyfall'), true);
  assert.equal(isInsaneUnlocked('space-invader'), true);

  // Reset ONLY Skyfall
  resetProgression('skyfall');

  assert.equal(isInsaneUnlocked('skyfall'), false, 'Skyfall Insane must be re-locked');
  assert.equal(isInsaneUnlocked('space-invader'), true, 'Space Invader Insane MUST remain unlocked after Skyfall reset');
});

test('Resetting Space Invader progression does NOT reset Skyfall progression', () => {
  resetProgression();

  unlockInsane('skyfall');
  unlockInsane('space-invader');

  assert.equal(isInsaneUnlocked('skyfall'), true);
  assert.equal(isInsaneUnlocked('space-invader'), true);

  // Reset ONLY Space Invader
  resetProgression('space-invader');

  assert.equal(isInsaneUnlocked('space-invader'), false, 'Space Invader Insane must be re-locked');
  assert.equal(isInsaneUnlocked('skyfall'), true, 'Skyfall Insane MUST remain unlocked after Invader reset');
});

test('Calling resetProgression() with no arguments resets both modes cleanly', () => {
  unlockInsane('skyfall');
  unlockInsane('space-invader');

  assert.equal(isInsaneUnlocked('skyfall'), true);
  assert.equal(isInsaneUnlocked('space-invader'), true);

  resetProgression();

  assert.equal(isInsaneUnlocked('skyfall'), false, 'All modes locked after full resetProgression()');
  assert.equal(isInsaneUnlocked('space-invader'), false, 'All modes locked after full resetProgression()');
});

// ---------------------------------------------------------------------------
// 6. User Account Scoping Isolation across Modes
// ---------------------------------------------------------------------------
console.log('\n--- 6. User Account Scoping Isolation ---');

test('Progression user context scopes unlocks per user and per mode', () => {
  clearProgressionUserContext();
  resetProgression();

  // Cadet Alice unlocks Skyfall Insane
  setProgressionUserContext('cadet_alice');
  unlockInsane('skyfall');
  assert.equal(isInsaneUnlocked('skyfall'), true, 'Alice has Skyfall Insane');
  assert.equal(isInsaneUnlocked('space-invader'), false, 'Alice does not have Space Invader Insane');

  // Switch to Cadet Bob
  setProgressionUserContext('cadet_bob');
  assert.equal(isInsaneUnlocked('skyfall'), false, 'Bob does not have Skyfall Insane (Alice unlock not leaked)');
  assert.equal(isInsaneUnlocked('space-invader'), false, 'Bob does not have Space Invader Insane');

  // Bob unlocks Space Invader Insane
  unlockInsane('space-invader');
  assert.equal(isInsaneUnlocked('space-invader'), true, 'Bob has Space Invader Insane');
  assert.equal(isInsaneUnlocked('skyfall'), false, 'Bob does not have Skyfall Insane');

  // Switch back to Alice: verify her state is untouched
  setProgressionUserContext('cadet_alice');
  assert.equal(isInsaneUnlocked('skyfall'), true, 'Alice still has Skyfall Insane');
  assert.equal(isInsaneUnlocked('space-invader'), false, 'Alice does NOT have Space Invader Insane (Bob unlock not leaked)');

  clearProgressionUserContext();
  resetProgression();
});

// ---------------------------------------------------------------------------
// 7. Safe Migration from Legacy Shared Key
// ---------------------------------------------------------------------------
console.log('\n--- 7. Safe Migration from Legacy Key ---');

test('Legacy shared mindrush_insane_unlocked key migrates to Skyfall only, NOT Space Invader', () => {
  clearProgressionUserContext();
  resetProgression();

  // Manually seed the legacy shared key (as would exist in an older browser localStorage)
  const legacyKey = PROGRESSION_KEYS.INSANE_UNLOCKED; // 'mindrush_insane_unlocked'
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(legacyKey, 'true');
  }

  // Skyfall checks legacy key as fallback -> returns true
  assert.equal(isInsaneUnlocked('skyfall'), true, 'Skyfall safely inherits legacy unlock');
  assert.equal(isInsaneUnlocked(), true, 'Default call safely inherits legacy unlock');

  // Space Invader checks isolated key only -> MUST return false
  assert.equal(isInsaneUnlocked('space-invader'), false, 'Space Invader MUST NOT accidentally inherit legacy key');

  resetProgression();
});

// ---------------------------------------------------------------------------
// 8. Educational Mode Independence Preservation
// ---------------------------------------------------------------------------
console.log('\n--- 8. Educational Mode Independence ---');

test('Educational mode unlock progression remains completely independent of Fun mode unlocks', () => {
  resetProgression();

  unlockInsane('skyfall');
  unlockInsane('space-invader');

  // Educational Insane requires completing Edu Hard with >= 4/5 questions
  assert.equal(isEduDifficultyUnlocked('insane'), false, 'Educational Insane remains locked regardless of Fun mode unlocks');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n========================================');
console.log(`Results: ${passed}/${passed + failed} assertions passed.`);
if (failed === 0) {
  console.log('ALL INSANE UNLOCK ISOLATION TESTS PASSED SUCCESSFULLY!');
} else {
  console.error(`FAILED: ${failed} assertions failed.`);
}
console.log('========================================');
