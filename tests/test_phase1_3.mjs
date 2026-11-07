import { DIFFICULTIES, getDifficultyConfig } from '../public/js/game/difficulty.js';
import { GameState } from '../public/js/game/state.js';
import { CollisionSystem } from '../public/js/game/collision.js';
import { FallingObject, ObjectSpawner } from '../public/js/game/objects.js';

console.log('=== MindRush Phase 1.3 Verification Test Suite ===\n');

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
// 1. Easy Mode â€” Badge Pool Updated to MindRush Designs
// ========================================================
const easyCfg = getDifficultyConfig('easy');
assert(easyCfg.name === 'Easy', 'Easy config loaded');
assert(easyCfg.heartConfig === null, 'Easy has NO 1UP heart configuration');
assert(easyCfg.shapes.length === 5, 'Easy has exactly 5 badge-inspired shapes');

const easyRed = easyCfg.shapes.find(s => s.id === 'regular_red_ball');
const easySilver = easyCfg.shapes.find(s => s.id === 'silver_hexagon');
const easyDroplet = easyCfg.shapes.find(s => s.id === 'water_droplet');
const easySunburst = easyCfg.shapes.find(s => s.id === 'golden_sunburst');
const easyCrystal = easyCfg.shapes.find(s => s.id === 'green_crystal');

assert(easyRed && easyRed.lifeDelta === -1 && easyRed.points === 0, 'Easy: Regular red ball is hazardous (-1 life)');
assert(easySilver && easySilver.points === 10 && easySilver.lifeDelta === 0, 'Easy: Silver Hexagon gives +10 points');
assert(easySilver.shape === 'silver_hexagon', 'Easy: Silver Hexagon uses badge-inspired shape renderer');
assert(easyDroplet && easyDroplet.points === 10 && easyDroplet.lifeDelta === 0, 'Easy: Water Droplet gives +10 points');
assert(easySunburst && easySunburst.points === 20 && easySunburst.lifeDelta === 0, 'Easy: Golden Sunburst gives +20 points');
assert(easySunburst.shape === 'golden_sunburst', 'Easy: Golden Sunburst uses badge-inspired shape renderer');
assert(easyCrystal && easyCrystal.points === 20 && easyCrystal.lifeDelta === 0, 'Easy: Green Crystal gives +20 points');

// Verify NO plain circles remain in Easy
const easyCircles = easyCfg.shapes.filter(s => s.shape === 'circle');
assert(easyCircles.length === 0, 'Easy: No plain circle shapes remain (all badge-inspired)');

assert(easyCfg.specialStar && easyCfg.specialStar.object.points === 100, 'Easy: Golden Star gives +100 points at 250 threshold');

// Test that Easy spawner NEVER spawns hearts over 10,000 frames
const easySpawner = new ObjectSpawner(easyCfg);
let easyHeartsSpawned = 0;
for (let frame = 1; frame <= 10000; frame++) {
  const spawned = easySpawner.spawnIfReady(frame, 0, 800, 300);
  if (spawned && (spawned.shape === 'heart' || spawned.id === '1up_heart')) {
    easyHeartsSpawned++;
  }
}
assert(easyHeartsSpawned === 0, 'Easy: Zero (0) 1UP hearts spawned over 10,000 frames');

// ========================================================
// 2. Spawn Jitter Randomization
// ========================================================
assert(easyCfg.spawnJitter === 12, 'Easy: spawnJitter is 12');
const medCfg = getDifficultyConfig('medium');
assert(medCfg.spawnJitter === 10, 'Medium: spawnJitter is 10');
const hardCfg = getDifficultyConfig('hard');
assert(hardCfg.spawnJitter === 8, 'Hard: spawnJitter is 8');

// Verify spawn timing is actually randomized (collect spawn frames over 2000 frames)
const jitterSpawner = new ObjectSpawner(easyCfg);
const spawnFrames = [];
for (let frame = 1; frame <= 2000; frame++) {
  const spawned = jitterSpawner.spawnIfReady(frame, 0, 800, 0);
  if (spawned) spawnFrames.push(frame);
}
// Check that intervals between spawns are not all identical
const intervals = [];
for (let i = 1; i < spawnFrames.length; i++) {
  intervals.push(spawnFrames[i] - spawnFrames[i - 1]);
}
const uniqueIntervals = new Set(intervals);
assert(uniqueIntervals.size > 1, `Spawn timing is randomized (${uniqueIntervals.size} unique intervals found)`);

// ========================================================
// 3. Horizontal Position Anti-Clustering
// ========================================================
const xSpawner = new ObjectSpawner(easyCfg);
const xPositions = [];
for (let frame = 1; frame <= 5000; frame++) {
  const spawned = xSpawner.spawnIfReady(frame, 0, 800, 0);
  if (spawned) xPositions.push(spawned.x);
}
// Check that positions aren't all in the same area (use 6 slots)
const slotWidth = (800 - 60) / 6;
const slotCounts = [0, 0, 0, 0, 0, 0];
for (const x of xPositions) {
  const slot = Math.min(5, Math.floor((x - 30) / slotWidth));
  slotCounts[slot]++;
}
const occupiedSlots = slotCounts.filter(c => c > 0).length;
assert(occupiedSlots >= 4, `Horizontal spread: ${occupiedSlots}/6 slots used (anti-clustering working)`);

// ========================================================
// 4. Medium Mode Verification
// ========================================================
assert(medCfg.name === 'Medium', 'Medium config loaded');
assert(medCfg.heartConfig && medCfg.heartConfig.maxSpawns === 3, 'Medium: heartConfig.maxSpawns is exactly 3');

const medDroplet = medCfg.shapes.find(s => s.id === 'water_droplet');
const medCrystal = medCfg.shapes.find(s => s.id === 'green_crystal');
const medRing = medCfg.shapes.find(s => s.id === 'golden_ring');
const medIce = medCfg.shapes.find(s => s.id === 'ice_crystal');
const medSpike = medCfg.shapes.find(s => s.id === 'purple_spiked_emblem');
const medRed = medCfg.shapes.find(s => s.id === 'red_ball');

assert(medDroplet && medDroplet.points === 10 && medDroplet.lifeDelta === 0, 'Medium: Water Droplet gives +10 points (Common)');
assert(medCrystal && medCrystal.points === 20 && medCrystal.lifeDelta === 0, 'Medium: Green Crystal gives +20 points (Positive)');
assert(medRing && medRing.points === 25 && medRing.lifeDelta === 0, 'Medium: Golden Ring gives +25 points (Rare)');
assert(medIce && medIce.points === 50 && medIce.lifeDelta === 0, 'Medium: Ice Crystal gives +50 points (High-value Rare)');
assert(medSpike && medSpike.points === -20 && medSpike.lifeDelta === 0, 'Medium: Purple Spiked Emblem deducts -20 points');
assert(medRed && medRed.lifeDelta === -1 && medRed.points === 0, 'Medium: Red Ball is hazardous (-1 life)');

// Test Medium 1UP Heart Spawn Limit (Max 3)
const medSpawner = new ObjectSpawner(medCfg);
let medHeartsCount = 0;
for (let frame = 1; frame <= 50000; frame++) {
  const spawned = medSpawner.spawnIfReady(frame, 0, 800, 500);
  if (spawned && spawned.shape === 'heart') {
    medHeartsCount++;
    assert(spawned.lifeDelta === 1, `Medium Heart #${medHeartsCount} grants +1 life`);
    assert(spawned.points === 0, `Medium Heart #${medHeartsCount} awards 0 points`);
  }
}
assert(medHeartsCount === 3, `Medium: Exactly 3 hearts spawned over 50,000 frames (strictly capped at max 3)`);
assert(medSpawner.heartsSpawned === 3, 'Medium: spawner.heartsSpawned counter is exactly 3');

// ========================================================
// 5. Hard Mode Verification
// ========================================================
assert(hardCfg.name === 'Hard', 'Hard config loaded');
assert(hardCfg.heartConfig && hardCfg.heartConfig.maxSpawns === 6, 'Hard: heartConfig.maxSpawns is exactly 6');

const hardDroplet = hardCfg.shapes.find(s => s.id === 'water_droplet');
const hardCrystal = hardCfg.shapes.find(s => s.id === 'green_crystal');
const hardRing = hardCfg.shapes.find(s => s.id === 'golden_ring');
const hardIce = hardCfg.shapes.find(s => s.id === 'ice_crystal');
const hardSpike = hardCfg.shapes.find(s => s.id === 'purple_spiked_emblem');
const hardDarkTri = hardCfg.shapes.find(s => s.id === 'dark_triangular_emblem');
const hardRed = hardCfg.shapes.find(s => s.id === 'red_ball');
const hardRegRed = hardCfg.shapes.find(s => s.id === 'regular_red_ball');
const hardFlame = hardCfg.shapes.find(s => s.id === 'orange_flame');

assert(hardDroplet && hardDroplet.points === 10, 'Hard: Water Droplet gives +10 points');
assert(hardCrystal && hardCrystal.points === 20, 'Hard: Green Crystal gives +20 points');
assert(hardRing && hardRing.points === 25, 'Hard: Golden Ring gives +25 points');
assert(hardIce && hardIce.points === 50, 'Hard: Ice Crystal gives +50 points');
assert(hardSpike && hardSpike.points === -20, 'Hard: Purple Spiked Emblem gives -20 points');
assert(hardDarkTri && hardDarkTri.points === -30, 'Hard: Dark Triangular Emblem gives -30 points (Stronger negative)');
assert(hardRegRed && hardRegRed.lifeDelta === -1, 'Hard: Regular Red Ball is hazardous (-1 life)');
assert(hardRed && hardRed.lifeDelta === -1, 'Hard: Spiky Red Ball is hazardous (-1 life)');
assert(hardFlame && hardFlame.lifeDelta === -1, 'Hard: Orange Flame is hazardous (-1 life)');

// Test Hard 1UP Heart Spawn Limit (Max 6)
const hardSpawner = new ObjectSpawner(hardCfg);
let hardHeartsCount = 0;
for (let frame = 1; frame <= 50000; frame++) {
  const spawned = hardSpawner.spawnIfReady(frame, 0, 800, 500);
  if (spawned && spawned.shape === 'heart') {
    hardHeartsCount++;
    assert(spawned.lifeDelta === 1, `Hard Heart #${hardHeartsCount} grants +1 life`);
  }
}
assert(hardHeartsCount === 6, `Hard: Exactly 6 hearts spawned over 50,000 frames (strictly capped at max 6)`);
assert(hardSpawner.heartsSpawned === 6, 'Hard: spawner.heartsSpawned counter is exactly 6');

// ========================================================
// 6. Spawner Reset Behavior
// ========================================================
medSpawner.reset();
assert(medSpawner.heartsSpawned === 0, 'Spawner reset clears heartsSpawned to 0 for Medium');
assert(medSpawner._recentXSlots.length === 0, 'Spawner reset clears horizontal slot history');
hardSpawner.reset();
assert(hardSpawner.heartsSpawned === 0, 'Spawner reset clears heartsSpawned to 0 for Hard');

// ========================================================
// 7. Atomic Collision Resolution & State Integrity
// ========================================================
const state = new GameState(3);
const dummyAudio = { play: () => {}, stop: () => {} };
const collision = new CollisionSystem();
const mockPaddle = { getBounds: () => ({ x: 100, y: 500, w: 100, h: 10 }) };

// Test Negative Score Deduction (-30 points)
state.addScore(100);
assert(state.score === 100, 'State initialized with 100 score');
const darkTriObj = new FallingObject({
  id: 'dark_triangular_emblem',
  shape: 'dark_triangular_emblem',
  points: -30,
  lifeDelta: 0,
  sound: 'losePoints',
  x: 150,
  y: 502
});
assert(collision.checkCollision(mockPaddle, darkTriObj) === true, 'Collision with dark triangle detected');
collision.resolveCollision(darkTriObj, state, dummyAudio);
assert(state.score === 70, 'Dark triangle deducted exactly 30 points (100 -> 70)');

// Test Duplicate Handling Prevention on Negative Object
const dupeRes = collision.resolveCollision(darkTriObj, state, dummyAudio);
assert(dupeRes.ignored === true, 'Duplicate resolution of dark triangle is ignored');
assert(state.score === 70, 'Score is unchanged after duplicate check (still 70)');

// Test Severe Hazard Cross (-3 lives)
assert(state.lives === 3, 'Lives currently at 3');
const hazardCrossObj = new FallingObject({
  id: 'hazard_cross',
  shape: 'hazard_cross',
  points: 0,
  lifeDelta: -3,
  sound: 'redBall',
  x: 150,
  y: 502
});
collision.resolveCollision(hazardCrossObj, state, dummyAudio);
assert(state.lives === 0, 'Hazard Cross inflicted exactly -3 lives (3 -> 0)');
assert(state.isGameOver() === true, 'State transitioned to GAME_OVER after 0 lives');

// Test 1UP Heart (+1 life)
state.reset();
assert(state.lives === 3, 'State reset restored 3 lives');
state.modifyLives(-1);
assert(state.lives === 2, 'Life lost (3 -> 2)');
const heartObj = new FallingObject({
  id: '1up_heart',
  shape: 'heart',
  points: 0,
  lifeDelta: 1,
  sound: 'lifePlus',
  x: 150,
  y: 502
});
collision.resolveCollision(heartObj, state, dummyAudio);
assert(state.lives === 3, '1UP Heart granted exactly +1 life (2 -> 3)');
const dupeHeartRes = collision.resolveCollision(heartObj, state, dummyAudio);
assert(dupeHeartRes.ignored === true, 'Duplicate heart collision ignored');
assert(state.lives === 3, 'Duplicate heart collision did not grant additional lives');

// ========================================================
// 8. New Badge Shape Rendering (FallingObject instances)
// ========================================================
const silverBadge = new FallingObject({ shape: 'silver_hexagon', x: 100, color: [200, 200, 210] });
assert(silverBadge.getGlowColor()[0] === 180 && silverBadge.getGlowColor()[1] === 190, 'Silver Hexagon has correct silver/steel glow color');

const sunburstBadge = new FallingObject({ shape: 'golden_sunburst', x: 100, color: [255, 200, 0] });
assert(sunburstBadge.getGlowColor()[0] === 255 && sunburstBadge.getGlowColor()[1] === 190, 'Golden Sunburst has correct warm golden glow color');

// Verify decorative rotation is non-zero for new animated badges
sunburstBadge.animTicks = 100;
assert(sunburstBadge.getDecorativeRotation() !== 0, 'Golden Sunburst has non-zero decorative rotation (spinning)');

silverBadge.animTicks = 100;
assert(silverBadge.getDecorativeRotation() !== 0, 'Silver Hexagon has non-zero decorative rotation (rocking)');

console.log(`\n========================================`);
console.log(`Results: ${passed}/${total} assertions passed.`);
if (passed === total) {
  console.log('ALL PHASE 1.3 SPECIFICATION TESTS PASSED SUCCESSFULLY!');
}
console.log(`========================================\n`);

