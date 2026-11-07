/**
 * MindRush — Additional Badge Integration Verification Test Suite
 * Tests the 5 new badge designs from the MindRush Badge Collection Infographic:
 * 1. Blue Spiral Shell (+25 pts)
 * 2. Pink Heart-Diamond (+1 life)
 * 3. Crescent Moon (+20 pts)
 * 4. Bronze Eight-Pointed Star (+50 pts)
 * 5. Purple Shuriken (-20 pts)
 */

import { DIFFICULTIES, getDifficultyConfig, NEW_BADGES } from '../public/js/game/difficulty.js';
import { GameState } from '../public/js/game/state.js';
import { CollisionSystem } from '../public/js/game/collision.js';
import { FallingObject, ObjectSpawner } from '../public/js/game/objects.js';

console.log('=== MindRush Badge Integration Verification Test Suite ===\n');

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

// ========================================================
// 1. Badge Definitions & Properties
// ========================================================
assert(NEW_BADGES && typeof NEW_BADGES === 'object', 'NEW_BADGES dictionary exported');

// 1. Blue Spiral Shell
const shell = NEW_BADGES.blue_spiral_shell;
assert(shell && shell.id === 'blue_spiral_shell', 'Blue Spiral Shell ID is "blue_spiral_shell"');
assert(shell.points === 25, 'Blue Spiral Shell awards +25 points');
assert(shell.lifeDelta === 0, 'Blue Spiral Shell has 0 life penalty');
assert(shell.shape === 'blue_spiral_shell', 'Blue Spiral Shell shape renderer is "blue_spiral_shell"');
assert(shell.sound === 'paddle', 'Blue Spiral Shell uses paddle catch audio');

// 2. Pink Heart-Diamond
const pinkHeart = NEW_BADGES.pink_heart_diamond;
assert(pinkHeart && pinkHeart.id === 'pink_heart_diamond', 'Pink Heart-Diamond ID is "pink_heart_diamond"');
assert(pinkHeart.points === 0, 'Pink Heart-Diamond awards 0 points');
assert(pinkHeart.lifeDelta === 1, 'Pink Heart-Diamond grants +1 life (Bonus Life)');
assert(pinkHeart.shape === 'pink_heart_diamond', 'Pink Heart-Diamond shape renderer is "pink_heart_diamond"');
assert(pinkHeart.sound === 'lifePlus', 'Pink Heart-Diamond uses lifePlus audio');

// 3. Crescent Moon
const moon = NEW_BADGES.crescent_moon;
assert(moon && moon.id === 'crescent_moon', 'Crescent Moon ID is "crescent_moon"');
assert(moon.points === 20, 'Crescent Moon awards +20 points');
assert(moon.lifeDelta === 0, 'Crescent Moon has 0 life delta');
assert(moon.shape === 'crescent_moon', 'Crescent Moon shape renderer is "crescent_moon"');

// 4. Bronze Eight-Pointed Star
const bronzeStar = NEW_BADGES.bronze_star;
assert(bronzeStar && bronzeStar.id === 'bronze_star', 'Bronze Star ID is "bronze_star"');
assert(bronzeStar.points === 50, 'Bronze Star awards +50 points');
assert(bronzeStar.lifeDelta === 0, 'Bronze Star has 0 life delta');
assert(bronzeStar.shape === 'bronze_star', 'Bronze Star shape renderer is "bronze_star"');

// 5. Purple Shuriken
const shuriken = NEW_BADGES.purple_shuriken;
assert(shuriken && shuriken.id === 'purple_shuriken', 'Purple Shuriken ID is "purple_shuriken"');
assert(shuriken.points === -20, 'Purple Shuriken deducts -20 points (Negative)');
assert(shuriken.lifeDelta === 0, 'Purple Shuriken has 0 life penalty');
assert(shuriken.shape === 'purple_shuriken', 'Purple Shuriken shape renderer is "purple_shuriken"');
assert(shuriken.sound === 'losePoints', 'Purple Shuriken uses losePoints audio');

// ========================================================
// 2. Integration into Difficulties
// ========================================================
const medCfg = getDifficultyConfig('medium');
const hardCfg = getDifficultyConfig('hard');
const easyCfg = getDifficultyConfig('easy');

// Easy mode preserves introductory balance
assert(easyCfg.shapes.length === 5, 'Easy mode preserves 5 introductory shapes');

// Medium mode contains the new badges
assert(medCfg.shapes.find(s => s.id === 'blue_spiral_shell'), 'Medium contains Blue Spiral Shell');
assert(medCfg.shapes.find(s => s.id === 'crescent_moon'), 'Medium contains Crescent Moon');
assert(medCfg.shapes.find(s => s.id === 'bronze_star'), 'Medium contains Bronze Eight-Pointed Star');
assert(medCfg.shapes.find(s => s.id === 'purple_shuriken'), 'Medium contains Purple Shuriken');
assert(medCfg.pinkDiamondConfig && medCfg.pinkDiamondConfig.maxSpawns === 2, 'Medium has pinkDiamondConfig capped at 2');

// Hard mode contains the new badges
assert(hardCfg.shapes.find(s => s.id === 'blue_spiral_shell'), 'Hard contains Blue Spiral Shell');
assert(hardCfg.shapes.find(s => s.id === 'crescent_moon'), 'Hard contains Crescent Moon');
assert(hardCfg.shapes.find(s => s.id === 'bronze_star'), 'Hard contains Bronze Eight-Pointed Star');
assert(hardCfg.shapes.find(s => s.id === 'purple_shuriken'), 'Hard contains Purple Shuriken');
assert(hardCfg.pinkDiamondConfig && hardCfg.pinkDiamondConfig.maxSpawns === 3, 'Hard has pinkDiamondConfig capped at 3');

// ========================================================
// 3. Pink Heart-Diamond Spawn Capping & Anti-Farming
// ========================================================
const medSpawner = new ObjectSpawner(medCfg);
let medPinkDiamonds = 0;
for (let frame = 1; frame <= 50000; frame++) {
  const spawned = medSpawner.spawnIfReady(frame, 0, 800, 500);
  if (spawned && spawned.shape === 'pink_heart_diamond') {
    medPinkDiamonds++;
    assert(spawned.lifeDelta === 1, `Medium Pink Diamond #${medPinkDiamonds} grants +1 life`);
    assert(spawned.points === 0, `Medium Pink Diamond #${medPinkDiamonds} awards 0 points`);
  }
}
assert(medPinkDiamonds === 2, `Medium: Exactly 2 Pink Heart-Diamonds spawned over 50,000 frames (strictly capped)`);
assert(medSpawner.pinkDiamondsSpawned === 2, 'Medium: spawner.pinkDiamondsSpawned is exactly 2');

const hardSpawner = new ObjectSpawner(hardCfg);
let hardPinkDiamonds = 0;
for (let frame = 1; frame <= 50000; frame++) {
  const spawned = hardSpawner.spawnIfReady(frame, 0, 800, 500);
  if (spawned && spawned.shape === 'pink_heart_diamond') {
    hardPinkDiamonds++;
    assert(spawned.lifeDelta === 1, `Hard Pink Diamond #${hardPinkDiamonds} grants +1 life`);
  }
}
assert(hardPinkDiamonds === 3, `Hard: Exactly 3 Pink Heart-Diamonds spawned over 50,000 frames (strictly capped)`);
assert(hardSpawner.pinkDiamondsSpawned === 3, 'Hard: spawner.pinkDiamondsSpawned is exactly 3');

// Spawner reset clears pink diamond counter
medSpawner.reset();
assert(medSpawner.pinkDiamondsSpawned === 0, 'Spawner reset resets pinkDiamondsSpawned to 0 for Medium');
hardSpawner.reset();
assert(hardSpawner.pinkDiamondsSpawned === 0, 'Spawner reset resets pinkDiamondsSpawned to 0 for Hard');

// ========================================================
// 4. Glow Colors & Rotation Constraints
// ========================================================
const shellObj = new FallingObject(shell);
assert(shellObj.getGlowColor()[0] === 0 && shellObj.getGlowColor()[1] === 190, 'Blue Spiral Shell glow is cyan/blue [0, 190, 255]');

const pinkHeartObj = new FallingObject(pinkHeart);
assert(pinkHeartObj.getGlowColor()[0] === 255 && pinkHeartObj.getGlowColor()[1] === 50, 'Pink Heart-Diamond glow is hot pink [255, 50, 150]');

// CRITICAL: Upright rotation check — Lobes must remain strictly upright at all animation frames
pinkHeartObj.animTicks = 0;
assert(pinkHeartObj.getDecorativeRotation() === 0, 'Pink Heart-Diamond has 0 rotation at tick 0 (upright)');
pinkHeartObj.animTicks = 45;
assert(pinkHeartObj.getDecorativeRotation() === 0, 'Pink Heart-Diamond has 0 rotation at tick 45 (upright)');
pinkHeartObj.animTicks = 120;
assert(pinkHeartObj.getDecorativeRotation() === 0, 'Pink Heart-Diamond has 0 rotation at tick 120 (never inverts)');

const moonObj = new FallingObject(moon);
assert(moonObj.getGlowColor()[0] === 220 && moonObj.getGlowColor()[1] === 40, 'Crescent Moon glow is luminous violet [220, 40, 160]');
moonObj.animTicks = 30;
assert(moonObj.getDecorativeRotation() !== 0, 'Crescent Moon has subtle decorative sway');

const bronzeObj = new FallingObject(bronzeStar);
assert(bronzeObj.getGlowColor()[0] === 215 && bronzeObj.getGlowColor()[1] === 140, 'Bronze Star glow is warm bronze [215, 140, 45]');
bronzeObj.animTicks = 60;
assert(bronzeObj.getDecorativeRotation() !== 0, 'Bronze Star has slow noble rotation');

const shurikenObj = new FallingObject(shuriken);
assert(shurikenObj.getGlowColor()[0] === 160 && shurikenObj.getGlowColor()[1] === 40, 'Purple Shuriken glow is deep purple [160, 40, 220]');
shurikenObj.animTicks = 40;
assert(shurikenObj.getDecorativeRotation() !== 0, 'Purple Shuriken has dynamic spin');

// ========================================================
// 5. Atomic Collision Resolution & Deduplication Integrity
// ========================================================
const state = new GameState(3);
const dummyAudio = { play: () => {}, stop: () => {} };
const collision = new CollisionSystem();
const mockPaddle = { getBounds: () => ({ x: 100, y: 500, w: 100, h: 10 }) };

// 5a. Purple Shuriken single deduction test
state.addScore(100);
assert(state.score === 100, 'Score initialized to 100');
const testShuriken = new FallingObject({
  ...shuriken,
  x: 150,
  y: 502
});
assert(collision.checkCollision(mockPaddle, testShuriken) === true, 'Collision with Purple Shuriken detected');
const shurikenOutcome = collision.resolveCollision(testShuriken, state, dummyAudio);
assert(shurikenOutcome.points === -20, 'Shuriken resolution reports -20 points');
assert(state.score === 80, 'Purple Shuriken deducted exactly 20 points (100 -> 80)');

// Test Duplicate Handling on Purple Shuriken (DO NOT MULTI-DEDUCT)
const dupeShurikenOutcome = collision.resolveCollision(testShuriken, state, dummyAudio);
assert(dupeShurikenOutcome.ignored === true, 'Duplicate collision on Purple Shuriken is ignored');
assert(state.score === 80, 'Score remains 80 after duplicate check (no repeated deduction)');

// 5b. Pink Heart-Diamond bonus life test
state.modifyLives(-1);
assert(state.lives === 2, 'Lives reduced to 2 (3 -> 2)');
const testPinkHeart = new FallingObject({
  ...pinkHeart,
  x: 150,
  y: 502
});
assert(collision.checkCollision(mockPaddle, testPinkHeart) === true, 'Collision with Pink Heart-Diamond detected');
const pinkOutcome = collision.resolveCollision(testPinkHeart, state, dummyAudio);
assert(pinkOutcome.lifeDelta === 1, 'Pink Heart-Diamond grants +1 life');
assert(state.lives === 3, 'Lives restored to 3 (2 -> 3)');

// Duplicate check on Pink Heart-Diamond
const dupePinkOutcome = collision.resolveCollision(testPinkHeart, state, dummyAudio);
assert(dupePinkOutcome.ignored === true, 'Duplicate Pink Heart collision ignored');
assert(state.lives === 3, 'Lives remain 3 after duplicate check');

// 5c. Bronze Star (+50 points)
const testBronze = new FallingObject({
  ...bronzeStar,
  x: 150,
  y: 502
});
collision.resolveCollision(testBronze, state, dummyAudio);
assert(state.score === 130, 'Bronze Star granted exactly +50 points (80 -> 130)');

// 5d. Blue Spiral Shell (+25 points)
const testShell = new FallingObject({
  ...shell,
  x: 150,
  y: 502
});
collision.resolveCollision(testShell, state, dummyAudio);
assert(state.score === 155, 'Blue Spiral Shell granted exactly +25 points (130 -> 155)');

// 5e. Crescent Moon (+20 points)
const testMoon = new FallingObject({
  ...moon,
  x: 150,
  y: 502
});
collision.resolveCollision(testMoon, state, dummyAudio);
assert(state.score === 175, 'Crescent Moon granted exactly +20 points (155 -> 175)');

console.log(`\n========================================`);
console.log(`Results: ${passed}/${total} assertions passed.`);
if (passed === total) {
  console.log('ALL BADGE INTEGRATION SPECIFICATION TESTS PASSED SUCCESSFULLY!');
}
console.log(`========================================\n`);
