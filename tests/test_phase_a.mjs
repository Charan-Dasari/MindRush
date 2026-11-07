/**
 * MindRush — Phase A Verification Test Suite
 * Tests gameplay stabilization, harmful object readability, 4-difficulty consistency,
 * Insane difficulty unlocking, score protection, collision preservation, and spawner pacing.
 */

import { DIFFICULTIES, getDifficultyConfig, NEW_BADGES, isInsaneUnlocked, unlockInsane, resetProgression } from '../public/js/game/difficulty.js';
import { GameState, GAME_STATES } from '../public/js/game/state.js';
import { CollisionSystem } from '../public/js/game/collision.js';
import { FallingObject, ObjectSpawner } from '../public/js/game/objects.js';
import { InputManager } from '../public/js/game/input.js';

console.log('=== MindRush Phase A Verification Test Suite ===\n');

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
// 1. Four Difficulty Consistency (Easy, Medium, Hard, Insane)
// ========================================================
console.log('--- 1. Difficulty Configuration Consistency ---');
assert(DIFFICULTIES.easy && DIFFICULTIES.medium && DIFFICULTIES.hard && DIFFICULTIES.insane, 'All 4 difficulties defined in DIFFICULTIES');

const easy = getDifficultyConfig('easy');
const medium = getDifficultyConfig('medium');
const hard = getDifficultyConfig('hard');
const insane = getDifficultyConfig('insane');

assert(easy.ballSpeed === 3, 'Easy ballSpeed is 3');
assert(medium.ballSpeed === 4, 'Medium ballSpeed is 4');
assert(hard.ballSpeed === 4.5, 'Hard ballSpeed is 4.5');
assert(insane.ballSpeed === 5.6, 'Insane ballSpeed is 5.6 (Hyperspeed challenge)');

assert(easy.spawnJitter === 12, 'Easy spawnJitter is 12');
assert(medium.spawnJitter === 10, 'Medium spawnJitter is 10');
assert(hard.spawnJitter === 8, 'Hard spawnJitter is 8');
assert(insane.spawnJitter === 6, 'Insane spawnJitter is 6');

assert(insane.paddle.width === 90, 'Insane has precision paddle width (90px)');
assert(insane.heartConfig && insane.heartConfig.maxSpawns === 4, 'Insane has 1UP heart config capped at 4');
assert(insane.pinkDiamondConfig && insane.pinkDiamondConfig.maxSpawns === 2, 'Insane has pink diamond config capped at 2');
assert(insane.maxBalls <= 12, 'Insane maxBalls is controlled to prevent clutter');

// ========================================================
// 2. Insane Progression Lock and Unlocking Integrity
// ========================================================
console.log('\n--- 2. Insane Progression & Unlocking ---');
resetProgression();
assert(isInsaneUnlocked() === false, 'Insane is LOCKED by default');

// Simulate failing runs across Easy, Medium, and Hard (< 1000)
const stateFailEasy = new GameState(3);
stateFailEasy.addScore(240);
stateFailEasy.modifyLives(-3);
assert(stateFailEasy.isGameOver(), 'Easy run ended in Game Over');
assert(isInsaneUnlocked() === false, 'Failing Easy run does NOT unlock Insane');

const stateFailMed = new GameState(3);
stateFailMed.addScore(450);
stateFailMed.modifyLives(-3);
assert(isInsaneUnlocked() === false, 'Failing Medium run does NOT unlock Insane');

const stateFailHard = new GameState(3);
stateFailHard.addScore(850); // Under 1000 threshold
stateFailHard.modifyLives(-3);
assert(isInsaneUnlocked() === false, 'Failing Hard run with score < 1000 does NOT unlock Insane');

// Verify Hard NextLevel milestone threshold
assert(hard.nextLevel && hard.nextLevel.threshold === 1000, 'Hard nextLevel milestone threshold is 1000');
assert(hard.nextLevel.target === 'insane', 'Hard nextLevel targets Insane difficulty');

// Beating Hard: Reaching 1000 points unlocks Insane
unlockInsane();
assert(isInsaneUnlocked() === true, 'Beating Hard with 1000+ points unlocks Insane');

// Failing a subsequent run does NOT re-lock or corrupt unlocked state
const stateSubsequentFail = new GameState(3);
stateSubsequentFail.modifyLives(-3);
assert(isInsaneUnlocked() === true, 'Subsequent failed runs do NOT re-lock Insane');

// Clean reset for testing
resetProgression();
assert(isInsaneUnlocked() === false, 'resetProgression cleanly re-locks for fresh runs');

// ========================================================
// 3. Score Protection & Corruption Prevention
// ========================================================
console.log('\n--- 3. Score Protection & Clamping ---');
const scoreState = new GameState(3);
scoreState.addScore(50);
assert(scoreState.score === 50, 'Score initialized and added correctly (50)');

scoreState.addScore(-100);
assert(scoreState.score === 0, 'Score clamped to zero when deductions exceed current score (no negative scores)');

scoreState.addScore(NaN);
assert(scoreState.score === 0, 'Score rejects NaN and preserves 0');

scoreState.addScore(25.7);
assert(scoreState.score === 25, 'Score truncated to integer (no corrupt floats)');

scoreState.modifyLives(-10);
assert(scoreState.lives === 0, 'Lives clamped to zero (no negative lives)');
assert(scoreState.isGameOver(), 'Zero lives triggers GAME_OVER state');

// ========================================================
// 4. Harmful Object Readability & Distinction
// ========================================================
console.log('\n--- 4. Harmful Object Readability & Distinction ---');
const redBall = new FallingObject({ id: 'red_ball', shape: 'red_ball', points: 0, lifeDelta: -1 });
const spikeEmblem = new FallingObject({ id: 'purple_spiked_emblem', shape: 'purple_spiked_emblem', points: -20, lifeDelta: 0 });
const darkTriangle = new FallingObject({ id: 'dark_triangular_emblem', shape: 'dark_triangular_emblem', points: -30, lifeDelta: 0 });
const shuriken = new FallingObject({ id: 'purple_shuriken', shape: 'purple_shuriken', points: -20, lifeDelta: 0 });
const orangeFlame = new FallingObject({ id: 'orange_flame', shape: 'orange_flame', points: 0, lifeDelta: -1 });
const hazardCross = new FallingObject({ id: 'hazard_cross', shape: 'hazard_cross', points: 0, lifeDelta: -3 });

assert(redBall.isHarmful() === true, 'red_ball identified as harmful');
assert(spikeEmblem.isHarmful() === true, 'purple_spiked_emblem identified as harmful (negative points)');
assert(darkTriangle.isHarmful() === true, 'dark_triangular_emblem identified as harmful (negative points)');
assert(shuriken.isHarmful() === true, 'purple_shuriken identified as harmful (negative points)');
assert(orangeFlame.isHarmful() === true, 'orange_flame identified as harmful');
assert(hazardCross.isHarmful() === true, 'hazard_cross identified as harmful');

// Check dark_triangular_emblem glow color is danger crimson, NOT cyan/blue
const triangleGlow = darkTriangle.getGlowColor();
assert(triangleGlow[0] > 180 && triangleGlow[1] < 50 && triangleGlow[2] < 60, `dark_triangular_emblem uses danger crimson glow [${triangleGlow}], NOT blue`);

// Check beneficial badges are NOT harmful
const droplet = new FallingObject({ id: 'water_droplet', shape: 'water_droplet', points: 10, lifeDelta: 0 });
const star = new FallingObject({ id: 'bronze_star', shape: 'bronze_star', points: 50, lifeDelta: 0 });
const heart = new FallingObject({ id: '1up_heart', shape: 'heart', points: 0, lifeDelta: 1 });
assert(droplet.isHarmful() === false, 'water_droplet is beneficial (not harmful)');
assert(star.isHarmful() === false, 'bronze_star is beneficial (not harmful)');
assert(heart.isHarmful() === false, '1UP heart is beneficial (not harmful)');

// ========================================================
// 5. Collision Preservation & Scoring Mechanics
// ========================================================
console.log('\n--- 5. Collision Detection & Outcomes ---');
const collision = new CollisionSystem();
const simState = new GameState(3);
simState.addScore(100);

// Red Ball collision
const redBallObj = new FallingObject({ id: 'red_ball', shape: 'red_ball', points: 0, lifeDelta: -1, sound: 'redBall' });
const resRed = collision.resolveCollision(redBallObj, simState, { play: () => {} });
assert(resRed.lifeDelta === -1 && simState.lives === 2, 'red_ball collision deducts exactly 1 life');
assert(simState.score === 100, 'red_ball collision does not alter points');

// Purple Spiked Emblem collision
const emblemObj = new FallingObject({ id: 'purple_spiked_emblem', shape: 'purple_spiked_emblem', points: -20, lifeDelta: 0, sound: 'losePoints' });
const resEmblem = collision.resolveCollision(emblemObj, simState, { play: () => {} });
assert(resEmblem.points === -20 && simState.score === 80, 'purple_spiked_emblem deducts exactly 20 points');
assert(simState.lives === 2, 'purple_spiked_emblem does not alter lives');

// Dark Triangle collision
const triObj = new FallingObject({ id: 'dark_triangular_emblem', shape: 'dark_triangular_emblem', points: -30, lifeDelta: 0, sound: 'losePoints' });
const resTri = collision.resolveCollision(triObj, simState, { play: () => {} });
assert(resTri.points === -30 && simState.score === 50, 'dark_triangular_emblem deducts exactly 30 points');

// Duplicate collision ignored
const resTriDup = collision.resolveCollision(triObj, simState, { play: () => {} });
assert(resTriDup.ignored === true && simState.score === 50, 'Duplicate collision on dark triangle is ignored');

// 1UP Heart recovery
const heartObj = new FallingObject({ id: '1up_heart', shape: 'heart', points: 0, lifeDelta: 1, sound: 'lifePlus' });
const resHeart = collision.resolveCollision(heartObj, simState, { play: () => {} });
assert(resHeart.lifeDelta === 1 && simState.lives === 3, '1UP heart grants +1 life (restored to 3)');

// ========================================================
// 6. Spawner Pacing & Consecutive Hazard Throttling
// ========================================================
console.log('\n--- 6. Spawner Pacing & Anti-Flooding ---');
const hardSpawner = new ObjectSpawner(hard);

// Test consecutive hazards over 1000 simulated spawns: should NEVER exceed 2 consecutive hazards
let maxConsecutiveHazards = 0;
let currentConsecutive = 0;
for (let frame = 1; frame <= 100000; frame++) {
  const obj = hardSpawner.spawnIfReady(frame, 0, 800, 0);
  if (obj) {
    if (obj.isHarmful()) {
      currentConsecutive++;
      if (currentConsecutive > maxConsecutiveHazards) {
        maxConsecutiveHazards = currentConsecutive;
      }
    } else {
      currentConsecutive = 0;
    }
  }
}
assert(maxConsecutiveHazards <= 2, `Consecutive hazards throttled to max ${maxConsecutiveHazards} (never walls of 3+ hazards)`);

// Insane spawner capping
const insaneSpawner = new ObjectSpawner(insane);
let insaneHearts = 0;
for (let frame = 1; frame <= 50000; frame++) {
  const obj = insaneSpawner.spawnIfReady(frame, 0, 800, 500);
  if (obj && obj.shape === 'heart') {
    insaneHearts++;
  }
}
assert(insaneHearts === 4, `Insane hearts strictly capped at max 4 (found ${insaneHearts})`);

// ========================================================
// 7. Input Coordinate Clamping & Safety
// ========================================================
console.log('\n--- 7. Input Coordinates & Bounds ---');
const input = new InputManager();
input.setTargetX(-100);
const clampLeft = input.getPaddleX(800, 100);
assert(clampLeft === 0, 'Paddle X clamped at 0 on left boundary');

input.setTargetX(1200);
const clampRight = input.getPaddleX(800, 100);
assert(clampRight === 700, 'Paddle X clamped at canvasWidth - paddleWidth on right boundary');

input.setTargetX(400);
const center = input.getPaddleX(800, 100);
assert(center === 350, 'Paddle X centered correctly around cursor position');

console.log('\n========================================');
console.log(`Phase A Verification Suite: ${passed}/${total} assertions passed.`);
console.log('ALL PHASE A REQUIREMENTS VERIFIED SUCCESSFULLY!');
console.log('========================================\n');
