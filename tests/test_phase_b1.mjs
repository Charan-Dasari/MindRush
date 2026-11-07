/**
 * MindRush — Phase B.1 Verification Test Suite
 * Tests:
 * 1. Collectible Badge Registry & Hazard Segregation
 * 2. Unlocking on Collision, No Unlocking on Spawn/Miss
 * 3. Duplicate Prevention & Persistent Storage
 * 4. Fresh Profile (0 badges) vs Returning Profile Persistence
 * 5. Pre-Game Guide Data Integrity for all 4 Difficulties
 * 6. Insane Unlock Gate Progression
 */

import {
  COLLECTIBLE_BADGES,
  isCollectibleBadge,
  resolveBadgeId,
  getUnlockedBadges,
  isBadgeUnlocked,
  unlockBadge,
  getUnlockedBadgeCount,
  getTotalBadgeCount,
  resetBadgeCollection,
  BADGE_STORAGE_KEY,
  DIFFICULTIES,
  getDifficultyConfig,
  isInsaneUnlocked,
  unlockInsane,
  resetProgression
} from '../public/js/game/difficulty.js';
import { GameState } from '../public/js/game/state.js';
import { CollisionSystem } from '../public/js/game/collision.js';
import { FallingObject } from '../public/js/game/objects.js';

console.log('=== MindRush Phase B.1 Verification Test Suite ===\n');

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// Mock browser localStorage for Node.js test environment if absent
if (typeof globalThis.localStorage === 'undefined') {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; }
  };
}

// ========================================================
// TEST GROUP 1: Canonical Collectible Badges & Segregation
// ========================================================
console.log('--- Test Group 1: Canonical Badge Registry & Segregation ---');
const totalBadges = getTotalBadgeCount();
assert(totalBadges === 12, `Total collectible badges in Skyfall is exactly 12 (found: ${totalBadges})`);

const expectedBadgeIds = [
  'silver_hexagon',
  'water_droplet',
  'golden_sunburst',
  'green_crystal',
  'golden_star',
  'golden_ring',
  'blue_spiral_shell',
  'crescent_moon',
  'bronze_star',
  'ice_crystal',
  'pink_heart_diamond',
  '1up_heart'
];

for (const id of expectedBadgeIds) {
  const badge = COLLECTIBLE_BADGES[id];
  assert(badge !== undefined, `Badge "${id}" exists in canonical registry`);
  assert(typeof badge.name === 'string' && badge.name.length > 0, `Badge "${id}" has a descriptive name`);
  assert(typeof badge.description === 'string' && badge.description.length > 0, `Badge "${id}" has a description`);
  assert(typeof badge.shape === 'string', `Badge "${id}" defines a shape renderer`);
  assert(badge.points >= 0, `Badge "${id}" points are non-negative (${badge.points})`);
  assert(badge.lifeDelta >= 0, `Badge "${id}" life delta is non-negative (${badge.lifeDelta})`);
}

// Strict exclusion: Harmful hazard traps are NOT collectible badges
const harmfulObjects = [
  { id: 'red_ball', shape: 'red_ball', lifeDelta: -1, points: 0 },
  { id: 'orange_flame', shape: 'orange_flame', lifeDelta: -1, points: 0 },
  { id: 'hazard_cross', shape: 'hazard_cross', lifeDelta: -3, points: 0 },
  { id: 'purple_spiked_emblem', shape: 'purple_spiked_emblem', lifeDelta: 0, points: -20 },
  { id: 'purple_shuriken', shape: 'purple_shuriken', lifeDelta: 0, points: -20 },
  { id: 'dark_triangular_emblem', shape: 'dark_triangular_emblem', lifeDelta: 0, points: -30 }
];

for (const hazard of harmfulObjects) {
  assert(!isCollectibleBadge(hazard), `Hazard "${hazard.id}" is strictly NOT a collectible badge`);
  assert(resolveBadgeId(hazard) === null, `Hazard "${hazard.id}" resolves to null badge ID`);
}

// Positive badges must pass isCollectibleBadge
assert(isCollectibleBadge({ id: 'water_droplet', points: 10, lifeDelta: 0 }), 'water_droplet object is recognized as collectible badge');
assert(isCollectibleBadge('water_droplet'), 'water_droplet string ID is recognized as collectible badge');
assert(isCollectibleBadge({ id: '1up_heart', lifeDelta: 1 }), '1up_heart object is recognized as collectible badge');
assert(isCollectibleBadge({ id: 'pink_heart_diamond', lifeDelta: 1 }), 'pink_heart_diamond is recognized as collectible badge');


// ========================================================
// TEST GROUP 2: Fresh Profile & Zero Count
// ========================================================
console.log('\n--- Test Group 2: Fresh Profile Starts with Zero Badges ---');
resetBadgeCollection();
resetProgression();

assert(getUnlockedBadgeCount() === 0, 'Fresh profile starts with exactly 0 unlocked badges');
assert(getUnlockedBadges().length === 0, 'Fresh profile unlocked badges array is empty');
assert(!isBadgeUnlocked('water_droplet'), 'water_droplet is locked on fresh profile');
assert(!isBadgeUnlocked('golden_star'), 'golden_star is locked on fresh profile');
assert(!isInsaneUnlocked(), 'Insane difficulty is locked on fresh profile');


// ========================================================
// TEST GROUP 3: Unlocking, Duplicate Prevention & Persistence
// ========================================================
console.log('\n--- Test Group 3: Unlocking, Duplicate Prevention & Persistence ---');
// Unlock one badge
const firstUnlock = unlockBadge('silver_hexagon');
assert(firstUnlock === true, 'First unlock of silver_hexagon returns true');
assert(getUnlockedBadgeCount() === 1, 'Unlocked badge count is now 1');
assert(isBadgeUnlocked('silver_hexagon') === true, 'isBadgeUnlocked("silver_hexagon") is true');

// Attempt duplicate unlock
const duplicateUnlock = unlockBadge('silver_hexagon');
assert(duplicateUnlock === false, 'Duplicate unlock of silver_hexagon returns false');
assert(getUnlockedBadgeCount() === 1, 'Duplicate unlock does NOT inflate unique badge count (still 1)');

// Unlock second distinct badge
const secondUnlock = unlockBadge('blue_spiral_shell');
assert(secondUnlock === true, 'Unlocking blue_spiral_shell returns true');
assert(getUnlockedBadgeCount() === 2, 'Unlocked badge count is now 2');

// Verify localStorage was updated
const rawStorage = localStorage.getItem(BADGE_STORAGE_KEY);
assert(rawStorage !== null, 'localStorage contains BADGE_STORAGE_KEY');
const parsed = JSON.parse(rawStorage);
assert(Array.isArray(parsed), 'Persisted badges in localStorage is an array');
assert(parsed.includes('silver_hexagon') && parsed.includes('blue_spiral_shell'), 'Persisted array contains both unlocked IDs');
assert(parsed.length === 2, 'Persisted array has exactly 2 entries (no duplicates)');

// Simulate page reload by reading fresh set
const reloadedBadges = getUnlockedBadges();
assert(reloadedBadges.length === 2, 'Reloaded array maintains 2 unlocked badges');
assert(reloadedBadges.includes('silver_hexagon') && reloadedBadges.includes('blue_spiral_shell'), 'Reloaded array has correct badge IDs');


// ========================================================
// TEST GROUP 4: Collision Resolution vs Spawning & Misses
// ========================================================
console.log('\n--- Test Group 4: Unlock on Paddle Collision, Never on Spawn or Miss ---');
resetBadgeCollection();
const collision = new CollisionSystem();
const state = new GameState(3);
const mockAudio = { play: () => {} };

// Step A: Spawn a collectible badge
const dropletObj = new FallingObject({
  id: 'water_droplet',
  shape: 'water_droplet',
  x: 200,
  y: 50,
  size: 30,
  speed: 4,
  points: 10,
  lifeDelta: 0,
  color: [0, 175, 255]
});

// Merely spawning must NOT unlock
assert(getUnlockedBadgeCount() === 0, 'Spawning badge object did NOT unlock it (count = 0)');
assert(!isBadgeUnlocked('water_droplet'), 'water_droplet remains locked after spawn');

// Step B: Simulate object falling offscreen (a miss)
dropletObj.y = 800; // past canvas
assert(dropletObj.isOffscreen(600) === true, 'Badge is offscreen (missed by player)');
assert(getUnlockedBadgeCount() === 0, 'Offscreen miss did NOT unlock badge (count = 0)');

// Step C: Player catches a badge with paddle
const sunburstObj = new FallingObject({
  id: 'golden_sunburst',
  shape: 'golden_sunburst',
  x: 300,
  y: 400,
  size: 30,
  speed: 4,
  points: 20,
  lifeDelta: 0,
  color: [255, 200, 0]
});

const outcome = collision.resolveCollision(sunburstObj, state, mockAudio);
assert(outcome && outcome.points === 20, 'Collision resolved awarding +20 points');
assert(state.score === 20, 'State score increased to 20');
assert(isBadgeUnlocked('golden_sunburst') === true, 'golden_sunburst unlocked upon paddle collection!');
assert(getUnlockedBadgeCount() === 1, 'Total unlocked badge count is now 1');

// Step D: Player collides with a hazard (red ball)
const redHazard = new FallingObject({
  id: 'red_ball',
  shape: 'red_ball',
  x: 300,
  y: 400,
  size: 30,
  speed: 4,
  points: 0,
  lifeDelta: -1,
  color: [255, 60, 60]
});

const hazardOutcome = collision.resolveCollision(redHazard, state, mockAudio);
assert(hazardOutcome && hazardOutcome.lifeDelta === -1, 'Hazard collision penalized player (-1 life)');
assert(state.lives === 2, 'State lives reduced to 2');
assert(getUnlockedBadgeCount() === 1, 'Hazard collision did NOT unlock any badges (count remains 1)');


// ========================================================
// TEST GROUP 5: Pre-Game Guide Configs per Difficulty
// ========================================================
console.log('\n--- Test Group 5: Pre-Game Guide Data Integrity ---');

// Easy Guide Objects
const easyCfg = getDifficultyConfig('easy');
assert(easyCfg !== null, 'Easy difficulty config loaded');
const easyCollectibleShapes = easyCfg.shapes.filter(s => isCollectibleBadge(s));
const easyHazardShapes = easyCfg.shapes.filter(s => !isCollectibleBadge(s));

assert(easyCollectibleShapes.length === 4, `Easy has 4 standard collectible badges (found: ${easyCollectibleShapes.length})`);
assert(easyHazardShapes.length === 1 && easyHazardShapes[0].id === 'regular_red_ball', 'Easy has exactly 1 hazard: regular_red_ball (-1 life)');
assert(easyCfg.specialStar && easyCfg.specialStar.object.id === 'golden_star', 'Easy has golden_star (+100) milestone badge');
assert(easyCfg.heartConfig === null, 'Easy has no 1UP heart');

// Medium Guide Objects
const medCfg = getDifficultyConfig('medium');
assert(medCfg !== null, 'Medium difficulty config loaded');
const medCollectibles = medCfg.shapes.filter(s => isCollectibleBadge(s));
const medHazards = medCfg.shapes.filter(s => !isCollectibleBadge(s));

assert(medCollectibles.length >= 3, `Medium defines rich collectible badges (found: ${medCollectibles.length})`);
assert(medHazards.some(h => h.id === 'red_ball' && h.lifeDelta === -1), 'Medium hazards include red_ball (-1 life)');
assert(medHazards.some(h => h.id === 'purple_shuriken' && h.points === -20), 'Medium hazards include purple_shuriken (-20 pts)');
assert(medCfg.heartConfig !== null && medCfg.heartConfig.spawnChance > 0, 'Medium includes 1UP heart bonus');

// Hard Guide Objects
const hardCfg = getDifficultyConfig('hard');
assert(hardCfg !== null, 'Hard difficulty config loaded');
const hardHazards = hardCfg.shapes.filter(s => !isCollectibleBadge(s));
assert(hardHazards.some(h => h.id === 'regular_red_ball' && h.lifeDelta === -1), 'Hard hazards include regular_red_ball (-1 life)');
assert(hardHazards.some(h => h.id === 'orange_flame' && h.lifeDelta === -1), 'Hard hazards include orange_flame (-1 life)');
assert(hardHazards.some(h => h.id === 'red_ball' && h.lifeDelta === -1), 'Hard hazards include red_ball (-1 life)');
assert(hardHazards.some(h => h.id === 'dark_triangular_emblem' && h.points === -30), 'Hard hazards include dark_triangular_emblem (-30 pts)');

// Insane Guide Objects & Gate
const insaneCfg = getDifficultyConfig('insane');
assert(insaneCfg !== null, 'Insane difficulty config loaded');
assert(insaneCfg.paddle && insaneCfg.paddle.width === 90, 'Insane paddle width preserved');
assert(insaneCfg.heartConfig !== null, 'Insane heart config defined');


// ========================================================
// TEST GROUP 6: Insane Unlock Gate
// ========================================================
console.log('\n--- Test Group 6: Insane Unlock Progression Gate ---');
resetProgression();
assert(isInsaneUnlocked() === false, 'Insane starts locked before completing Hard mode');

// Beating Hard mode with score >= 1000 unlocks Insane
unlockInsane();
assert(isInsaneUnlocked() === true, 'Insane is unlocked after beating Hard mode');

// Reset progression locks Insane again
resetProgression();
assert(isInsaneUnlocked() === false, 'resetProgression re-locks Insane mode');


// ========================================================
// Summary
// ========================================================
console.log(`\n========================================================`);
console.log(`Phase B.1 Verification Results: ${passed} / ${total} assertions passed.`);
if (passed === total) {
  console.log(`ALL PHASE B.1 AUTOMATED TESTS PASSED!`);
} else {
  console.error(`SOME TESTS FAILED! Check output above.`);
  process.exitCode = 1;
}
