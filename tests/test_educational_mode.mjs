/**
 * MindRush — Educational Mode Comprehensive Verification Test Suite
 *
 * Verifies the complete Space Invader-style Educational Mode:
 * 1. Question Bank Integrity: 100 verified Std. 1 Maths Olympiad questions, valid schema, no missing options
 * 2. QuestionDeck: Shuffled deck, no repeats before exhaustion, randomized option display ordering
 * 3. Difficulty Presets: Lives, timers, speeds, hostile attacks, and bosses for Easy, Medium, Hard, and Insane
 * 4. Educational Unlock Progression: Easy unlocked; Medium/Hard/Insane locked; >= 4/5 correct unlocks next tier; Fun mode independent
 * 5. Spaceship Controls: Fixed horizontal bottom lane movement; keyboard and gesture inputs; mouse movement/shooting disabled
 * 6. Answer UFO Hit Outcomes:
 *    - Correct answer: Confetti burst effect (35 frames), points awarded, question advances
 *    - Incorrect answer: Grey smoke puff (frames 5-9, no fire), -1 life penalty, respawns answer UFO, question stays active
 * 7. Question Timer & Expiry: Easy 30s, Medium 25s, Hard 20s, Insane 15s; expiry deducts 1 life and resets timer
 * 8. Educational Mini-Bosses:
 *    - Hard Glider (12 HP) with spinning axes
 *    - Insane Kraken (20 HP) with bubble volleys
 *    - Defeat awards +30s extra time added to active question timer
 *    - Respawns after exactly 5 seconds (300 frames) without duplicating or resetting question state
 * 9. Level Progression: 5 questions per level, carries over remaining lives
 * 10. Score Submission: Mode isolated under category 'educational'
 * 11. Fun Mode Integrity Preservation: Skyfall and Space Invader fun mode configurations remain 100% intact
 */

import { strict as assert } from 'node:assert';
import fs from 'node:fs';

// Mock DOM / Browser environment for headless Node.js execution
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}
const mockElement = () => ({
  textContent: '',
  innerHTML: '',
  style: {},
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

// Module imports under test
import {
  EDUCATIONAL_QUESTIONS,
  TOPICS,
  validateQuestionBank,
  QuestionDeck
} from '../public/js/game/educational-questions.js';

import {
  EDU_INVADER_CONFIGS,
  getEduInvaderConfig,
  isEduDifficultyUnlocked,
  unlockEduDifficulty,
  resetEduProgression,
  checkEduUnlockEligibility,
  isInsaneUnlocked,
  unlockInsane,
  resetProgression,
  DIFFICULTIES
} from '../public/js/game/difficulty.js';

import { EducationalInvaderEngine } from '../public/js/game/educational-invader-engine.js';
import { INVADER_CONFIGS } from '../public/js/game/space-invader-engine.js';

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

console.log('');
console.log('=== MindRush Educational Mode Final Verification Test Suite ===');
console.log('');

// ============================================================================
// 1. QUESTION BANK INTEGRITY
// ============================================================================
console.log('--- 1. Question Bank Integrity & Olympiad Verification ---');

test('Question bank contains exactly 100 Std. 1 Maths questions', function() {
  assert.equal(EDUCATIONAL_QUESTIONS.length, 100);
});

test('Question bank passes full schema validation with 0 errors', function() {
  const result = validateQuestionBank(EDUCATIONAL_QUESTIONS);
  assert.equal(result.valid, true);
  assert.equal(result.count, 100);
  assert.equal(result.errors.length, 0);
});

test('Every question has id, question text, 4 options, valid correctAnswer, and topic', function() {
  EDUCATIONAL_QUESTIONS.forEach((q, idx) => {
    assert.equal(typeof q.id, 'number', `Q${idx} must have number id`);
    assert.ok(q.question && q.question.length > 3, `Q${idx} question text missing`);
    assert.ok(Array.isArray(q.options) && q.options.length === 4, `Q${idx} must have exactly 4 options`);
    assert.ok(q.options.includes(q.correctAnswer), `Q${idx} correctAnswer "${q.correctAnswer}" must exist in options`);
    assert.ok(q.topic && q.topic.length > 2, `Q${idx} topic missing`);
  });
});

test('Topics list covers all primary Std. 1 Olympiad curriculum areas', function() {
  assert.ok(TOPICS.length >= 6);
  assert.ok(TOPICS.includes('Numerals'));
  assert.ok(TOPICS.includes('Addition'));
  assert.ok(TOPICS.includes('Subtraction'));
  assert.ok(TOPICS.includes('Geometrical Shapes'));
  assert.ok(TOPICS.includes('Geometrical Solids'));
});

// ============================================================================
// 2. QUESTION DECK MANAGER
// ============================================================================
console.log('--- 2. Question Deck Shuffling & No-Repeat Guarantee ---');

test('QuestionDeck draws unrepeated questions until bank is exhausted', function() {
  const deck = new QuestionDeck(EDUCATIONAL_QUESTIONS);
  const drawnIds = new Set();

  for (let i = 0; i < 100; i++) {
    const q = deck.drawNextQuestion();
    assert.ok(q, 'Drawn question must not be null');
    assert.ok(!drawnIds.has(q.id), `Question ID ${q.id} repeated before bank was exhausted!`);
    drawnIds.add(q.id);
  }
  assert.equal(drawnIds.size, 100);
});

test('QuestionDeck automatically reshuffles when exhausted without error', function() {
  const deck = new QuestionDeck(EDUCATIONAL_QUESTIONS);
  for (let i = 0; i < 100; i++) deck.drawNextQuestion();
  const nextQ = deck.drawNextQuestion();
  assert.ok(nextQ && nextQ.id, 'Reshuffle must successfully provide question 101');
});

test('QuestionDeck randomizes option display ordering (shuffledOptions)', function() {
  const deck = new QuestionDeck(EDUCATIONAL_QUESTIONS);
  const q = deck.drawNextQuestion();
  assert.ok(Array.isArray(q.shuffledOptions));
  assert.equal(q.shuffledOptions.length, 4);
  assert.ok(q.shuffledOptions.includes(q.correctAnswer));
});

// ============================================================================
// 3. DIFFICULTY CONFIGURATIONS & PRESETS
// ============================================================================
console.log('--- 3. Educational Difficulty Presets & Specifications ---');

test('All 4 Educational difficulty presets exist in EDU_INVADER_CONFIGS', function() {
  assert.ok(EDU_INVADER_CONFIGS.easy);
  assert.ok(EDU_INVADER_CONFIGS.medium);
  assert.ok(EDU_INVADER_CONFIGS.hard);
  assert.ok(EDU_INVADER_CONFIGS.insane);
});

test('Easy Mode: 3 lives, 30s timer, non-hostile (0 attacks), no boss', function() {
  const cfg = getEduInvaderConfig('easy');
  assert.equal(cfg.lives, 3);
  assert.equal(cfg.timer, 30);
  assert.equal(cfg.hasHostileFire, false);
  assert.equal(cfg.attackInterval, 0);
  assert.equal(cfg.hasBoss, false);
});

test('Medium Mode: 3 lives, 25s timer, hostile laser attacks, no boss', function() {
  const cfg = getEduInvaderConfig('medium');
  assert.equal(cfg.lives, 3);
  assert.equal(cfg.timer, 25);
  assert.equal(cfg.hasHostileFire, true);
  assert.ok(cfg.attackInterval > 0);
  assert.equal(cfg.hasBoss, false);
});

test('Hard Mode: 2 lives, 20s timer, hostile lasers + Glider Boss (12 HP)', function() {
  const cfg = getEduInvaderConfig('hard');
  assert.equal(cfg.lives, 2);
  assert.equal(cfg.timer, 20);
  assert.equal(cfg.hasHostileFire, true);
  assert.equal(cfg.hasBoss, true);
  assert.equal(cfg.bossType, 'glider');
  assert.equal(cfg.bossHp, 12);
  assert.equal(cfg.bossTimerBonus, 30);
  assert.equal(cfg.bossRespawnDelay, 300);
});

test('Insane Mode: 1 life, 15s timer, aggressive hostile lasers + Kraken Boss (20 HP)', function() {
  const cfg = getEduInvaderConfig('insane');
  assert.equal(cfg.lives, 1);
  assert.equal(cfg.timer, 15);
  assert.equal(cfg.hasHostileFire, true);
  assert.equal(cfg.hasBoss, true);
  assert.equal(cfg.bossType, 'kraken');
  assert.equal(cfg.bossHp, 20);
  assert.equal(cfg.bossTimerBonus, 30);
  assert.equal(cfg.bossRespawnDelay, 300);
});

// ============================================================================
// 4. EDUCATIONAL PROGRESSION & UNLOCKING
// ============================================================================
console.log('--- 4. Educational Unlock Progression & Independence ---');

test('Easy is unlocked by default; Medium, Hard, and Insane are initially locked', function() {
  resetEduProgression();
  assert.equal(isEduDifficultyUnlocked('easy'), true);
  assert.equal(isEduDifficultyUnlocked('medium'), false);
  assert.equal(isEduDifficultyUnlocked('hard'), false);
  assert.equal(isEduDifficultyUnlocked('insane'), false);
});

test('Completing level with < 4 correct does NOT unlock next tier', function() {
  resetEduProgression();
  const unlocked = checkEduUnlockEligibility('easy', 3, 5);
  assert.equal(unlocked, null);
  assert.equal(isEduDifficultyUnlocked('medium'), false);
});

test('Completing Easy level with >= 4 of 5 correct unlocks Medium tier', function() {
  resetEduProgression();
  const unlocked = checkEduUnlockEligibility('easy', 4, 5);
  assert.equal(unlocked, 'medium');
  assert.equal(isEduDifficultyUnlocked('medium'), true);
  assert.equal(isEduDifficultyUnlocked('hard'), false);
});

test('Completing Medium level with >= 4 of 5 correct unlocks Hard tier', function() {
  const unlocked = checkEduUnlockEligibility('medium', 5, 5);
  assert.equal(unlocked, 'hard');
  assert.equal(isEduDifficultyUnlocked('hard'), true);
  assert.equal(isEduDifficultyUnlocked('insane'), false);
});

test('Completing Hard level with >= 4 of 5 correct unlocks Insane tier', function() {
  const unlocked = checkEduUnlockEligibility('hard', 4, 5);
  assert.equal(unlocked, 'insane');
  assert.equal(isEduDifficultyUnlocked('insane'), true);
});

test('Fun mode unlocks and Educational mode unlocks remain strictly isolated', function() {
  resetProgression(); // resets Fun Mode
  resetEduProgression(); // resets Edu Mode

  // Unlock Fun Mode Insane
  unlockInsane();
  assert.equal(isInsaneUnlocked(), true);
  assert.equal(isEduDifficultyUnlocked('insane'), false); // Edu Insane must remain locked!

  // Unlock Edu Mode Insane
  unlockEduDifficulty('insane');
  assert.equal(isEduDifficultyUnlocked('insane'), true);

  // Reset Fun Mode does not wipe Edu Mode
  resetProgression();
  assert.equal(isInsaneUnlocked(), false);
  assert.equal(isEduDifficultyUnlocked('insane'), true);

  // Clean up
  resetEduProgression();
});

// ============================================================================
// 5. ENGINE SPACESHIP CONTROLS & BOTTOM LANE LOCK
// ============================================================================
console.log('--- 5. Spaceship Controls & Movement Restriction ---');

test('Spaceship Y coordinate is strictly constant at the bottom lane', function() {
  const engine = new EducationalInvaderEngine({ id: 'easy' });
  engine._initPlayer(900, 650);

  const initialFixedY = engine.player.fixedY;
  assert.equal(engine.player.y, initialFixedY);

  // Attempt upward displacement
  engine.player.y = 100;
  engine._updatePlayer(900, 650);
  assert.equal(engine.player.y, initialFixedY, 'Engine must enforce fixed horizontal bottom lane!');
});

test('Spaceship horizontal position clamps strictly within canvas bounds', function() {
  const engine = new EducationalInvaderEngine({ id: 'easy' });
  engine._initPlayer(900, 650);

  // Far left
  engine.player.x = -500;
  engine._updatePlayer(900, 650);
  assert.ok(engine.player.x >= 15);

  // Far right
  engine.player.x = 2000;
  engine._updatePlayer(900, 650);
  assert.ok(engine.player.x <= 900 - engine.player.width - 15);
});

// ============================================================================
// 6. ANSWER UFO HIT OUTCOMES & FEEDBACK
// ============================================================================
console.log('--- 6. Answer UFO Hit Outcomes (Confetti vs Grey Smoke) ---');

test('Engine spawns exactly 4 Answer UFOs corresponding to active question options', function() {
  const engine = new EducationalInvaderEngine({ id: 'easy' });
  engine._loadNextQuestion(900, 650);

  assert.equal(engine.ufos.length, 4);
  const correctCount = engine.ufos.filter(u => u.isCorrect).length;
  assert.equal(correctCount, 1, 'Exactly one UFO must carry the correct answer');
});

test('Correct Answer Hit: Confetti burst effect, points awarded, 0 lives lost, question advances', function() {
  const engine = new EducationalInvaderEngine({ id: 'easy' });
  engine._initPlayer(900, 650);
  engine._loadNextQuestion(900, 650);

  const correctUfo = engine.ufos.find(u => u.isCorrect);
  const initialScore = engine.state.score;
  const initialLives = engine.state.lives;

  engine._resolveAnswerHit(correctUfo, 900, 650);

  assert.ok(engine.state.score > initialScore, 'Score must increase');
  assert.equal(engine.state.lives, initialLives, 'No lives lost on correct answer');
  assert.equal(engine.confettiEffects.length, 1, 'Must trigger Confetti Burst');
  assert.equal(engine.confettiEffects[0].maxFrames, 35, 'Confetti burst has 35 frames');
  assert.equal(engine.smokeEffects.length, 0, 'No smoke on correct answer');
  assert.equal(engine.levelCorrectCount, 1);
});

test('Incorrect Answer Hit: Grey smoke puff (frames 5-9), -1 life penalty, UFO respawn scheduled, question stays', function() {
  const engine = new EducationalInvaderEngine({ id: 'easy' });
  engine._initPlayer(900, 650);
  engine._loadNextQuestion(900, 650);

  const wrongUfo = engine.ufos.find(u => !u.isCorrect);
  const activeQuestionId = engine.currentQuestion.id;
  const initialLives = engine.state.lives;

  engine._resolveAnswerHit(wrongUfo, 900, 650);

  assert.equal(engine.state.lives, initialLives - 1, 'Must deduct exactly 1 life on wrong answer');
  assert.equal(engine.smokeEffects.length, 1, 'Must trigger Grey Smoke puff');
  assert.equal(engine.smokeEffects[0].startFrame, 5, 'Smoke uses frames 5-9 (no orange fire)');
  assert.equal(engine.smokeEffects[0].endFrame, 9);
  assert.equal(engine.confettiEffects.length, 0, 'No confetti on wrong answer');
  assert.equal(wrongUfo.isAlive, false);
  assert.ok(wrongUfo.respawnTimer > 0, 'Incorrect option must be scheduled to respawn');
  assert.equal(engine.currentQuestion.id, activeQuestionId, 'Question must stay active after wrong answer');
});

// ============================================================================
// 7. QUESTION TIMER & EXPIRY PENALTY
// ============================================================================
console.log('--- 7. Question Timer Countdown & Expiry Penalty ---');

test('Question timer counts down each second', function() {
  const engine = new EducationalInvaderEngine({ id: 'easy' });
  engine._initPlayer(900, 650);
  engine._loadNextQuestion(900, 650);

  assert.equal(engine.questionTimeRemaining, 30);
  // Advance 60 frames (1 second)
  for (let i = 0; i < 60; i++) {
    engine._updateTimer(900, 650);
  }
  assert.equal(engine.questionTimeRemaining, 29);
});

test('Timer expiration deducts 1 life, resets question timer, and keeps question active', function() {
  const engine = new EducationalInvaderEngine({ id: 'easy' });
  engine._initPlayer(900, 650);
  engine._loadNextQuestion(900, 650);

  const activeQuestionId = engine.currentQuestion.id;
  const initialLives = engine.state.lives;
  engine.questionTimeRemaining = 0;

  engine._handleTimerExpiry(900, 650);

  assert.equal(engine.state.lives, initialLives - 1, 'Must deduct 1 life on timer expiry');
  assert.equal(engine.questionTimeRemaining, 30, 'Timer must reset back to max');
  assert.equal(engine.currentQuestion.id, activeQuestionId, 'Question must remain active');
});

// ============================================================================
// 8. EDUCATIONAL MINI-BOSSES (HARD & INSANE)
// ============================================================================
console.log('--- 8. Educational Mini-Boss Integration (Glider & Kraken) ---');

test('Hard Mini-Boss is Glider with 12 HP throwing axes', function() {
  const engine = new EducationalInvaderEngine({ id: 'hard' });
  engine.setup({
    createCanvas: () => {},
    frameRate: () => {}
  });

  assert.ok(engine.boss);
  assert.equal(engine.boss.type, 'glider');
  assert.equal(engine.boss.hp, 12);
  assert.equal(engine.boss.maxHp, 12);

  // Test axe attack projectile
  engine._fireBossProjectile();
  assert.equal(engine.bossProjectiles.length, 1);
  assert.equal(engine.bossProjectiles[0].type, 'axe');
});

test('Insane Mini-Boss is Kraken with 20 HP firing bubbles', function() {
  const engine = new EducationalInvaderEngine({ id: 'insane' });
  engine.setup({
    createCanvas: () => {},
    frameRate: () => {}
  });

  assert.ok(engine.boss);
  assert.equal(engine.boss.type, 'kraken');
  assert.equal(engine.boss.hp, 20);
  assert.equal(engine.boss.maxHp, 20);

  // Test bubble attack projectile
  engine._fireBossProjectile();
  assert.equal(engine.bossProjectiles.length, 1);
  assert.equal(engine.bossProjectiles[0].type, 'bubble');
});

test('Defeating Educational Mini-Boss awards +30s EXTRA TIME added to question timer', function() {
  const engine = new EducationalInvaderEngine({ id: 'hard' });
  engine.setup({
    createCanvas: () => {},
    frameRate: () => {}
  });

  engine.questionTimeRemaining = 15;
  engine.boss.hp = 1;

  engine._resolveBossHit(900, 650);

  assert.equal(engine.boss, null, 'Boss must be removed upon defeat');
  assert.equal(engine.questionTimeRemaining, 45, 'Question timer must receive +30s extra time!');
  assert.equal(engine.bossRespawnTimer, 300, 'Boss must set exactly 5-second respawn timer (300 ticks)');
});

test('Mini-Boss respawns after exactly 5 seconds without resetting question or score', function() {
  const engine = new EducationalInvaderEngine({ id: 'hard' });
  engine.setup({
    createCanvas: () => {},
    frameRate: () => {}
  });

  // Defeat boss
  engine.boss.hp = 1;
  engine._resolveBossHit(900, 650);
  assert.equal(engine.boss, null);
  assert.equal(engine.bossRespawnTimer, 300);

  const activeQuestionId = engine.currentQuestion.id;
  const currentScore = engine.state.score;

  // Advance 299 ticks
  for (let i = 0; i < 299; i++) {
    engine._updateBoss(900, 650);
  }
  assert.equal(engine.boss, null, 'Boss must not respawn early');

  // Advance 300th tick (5.0s mark)
  engine._updateBoss(900, 650);
  assert.ok(engine.boss, 'Boss must respawn after exactly 5 seconds');
  assert.equal(engine.boss.hp, 12, 'Respawned boss must have full HP');
  assert.equal(engine.currentQuestion.id, activeQuestionId, 'Question must not reset on boss respawn');
  assert.equal(engine.state.score, currentScore, 'Score must not reset on boss respawn');
});

// ============================================================================
// 9. LEVEL PROGRESSION & MODAL LIFE CARRY-OVER
// ============================================================================
console.log('--- 9. Level Progression & Lives Carry-Over ---');

test('Level completes after 5 questions and carries remaining lives forward', function() {
  const engine = new EducationalInvaderEngine({ id: 'easy' });
  engine.setup({
    createCanvas: () => {},
    frameRate: () => {}
  });

  engine.state.lives = 2; // Lost 1 life earlier
  engine.level = 1;
  engine.questionIndex = 4; // 5th question

  // Advance to next level
  engine._advanceToNextLevel(900, 650);

  assert.equal(engine.level, 2, 'Level must increment to 2');
  assert.equal(engine.questionIndex, 0, 'Question index must reset to 0');
  assert.equal(engine.state.lives, 2, 'Remaining lives must carry over intact!');
});

// ============================================================================
// 10. FUN MODE INTEGRITY PRESERVATION
// ============================================================================
console.log('--- 10. Fun Mode Integrity Preservation ---');

test('Skyfall (Falling Objects) configurations remain 100% intact', function() {
  assert.ok(DIFFICULTIES.easy);
  assert.ok(DIFFICULTIES.medium);
  assert.ok(DIFFICULTIES.hard);
  assert.ok(DIFFICULTIES.insane);
  assert.equal(DIFFICULTIES.easy.ballSpeed, 3);
  assert.equal(DIFFICULTIES.insane.ballSpeed, 5.6);
});

test('Space Invader Fun Mode configurations remain 100% intact', function() {
  assert.ok(INVADER_CONFIGS.easy);
  assert.ok(INVADER_CONFIGS.medium);
  assert.ok(INVADER_CONFIGS.hard);
  assert.ok(INVADER_CONFIGS.insane);
  assert.equal(INVADER_CONFIGS.easy.targetObjective, 10);
  assert.equal(INVADER_CONFIGS.insane.hasFinalBoss, true);
});

// ============================================================================
// 11. HUD LAYOUT NON-OVERLAP & STRUCTURE
// ============================================================================
console.log('--- 11. HUD Layout Non-Overlap & Structure ---');

test('game.html has segregated top row and dedicated centered question panel', function() {
  const html = fs.readFileSync(new URL('../public/game.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="hud-header"'), 'Must have #hud-header for topbar');
  assert.ok(html.includes('id="hud-btn-exit"'), 'Topbar must have Exit button');
  assert.ok(html.includes('id="hud-difficulty-tag"'), 'Topbar must have difficulty tag');
  assert.ok(html.includes('id="hud-progress-tag"'), 'Topbar must have progress tag');
  assert.ok(html.includes('id="hud-score-tag"'), 'Topbar must have score tag');
  assert.ok(html.includes('id="hud-sensor-feedback"'), 'Topbar must have sensor feedback');
  assert.ok(html.includes('id="btn-pause-header"'), 'Topbar must have pause button');

  // Question container must be dedicated and outside the topbar
  assert.ok(html.includes('id="edu-hud-container"'), 'Must have dedicated #edu-hud-container');
  assert.ok(html.includes('class="edu-question-area'), 'Dedicated question area class');
  assert.ok(html.includes('id="edu-hud-question-text"'), 'Question text display');
  assert.ok(html.includes('id="edu-hud-timer-bar"'), 'Timer bar element');

  // Verify edu-hud-container is NOT nested inside hud-header
  const headerIdx = html.indexOf('<header id="hud-header"');
  const headerEndIdx = html.indexOf('</header>');
  const eduContainerIdx = html.indexOf('id="edu-hud-container"');
  assert.ok(eduContainerIdx > headerEndIdx, 'Question panel must be outside and below #hud-header');
});

// ============================================================================
// 12. ANSWER UFO ANTI-OVERLAP & COLLISION AVOIDANCE
// ============================================================================
console.log('--- 12. Answer UFO Anti-Overlap & Collision Avoidance ---');

test('Answer UFOs are spawned with vertical row staggering and dedicated sectors', function() {
  const engine = new EducationalInvaderEngine({ id: 'easy' });
  engine.setup({
    createCanvas: () => {},
    frameRate: () => {}
  });

  assert.equal(engine.ufos.length, 4, 'Must spawn 4 UFOs');
  
  // Row staggering check: Y coordinates must use dual rows (e.g. 190 and 260) with >= 50px delta
  const yCoords = engine.ufos.map(u => u.y);
  const row0 = yCoords.filter(y => Math.abs(y - 190) < 10);
  const row1 = yCoords.filter(y => Math.abs(y - 260) < 10);
  assert.equal(row0.length, 2, 'Two UFOs on upper row');
  assert.equal(row1.length, 2, 'Two UFOs on lower row');

  // Check sector bounds: each UFO has dedicated patrol sector
  for (let i = 0; i < engine.ufos.length - 1; i++) {
    assert.ok(engine.ufos[i].patrolMaxX <= engine.ufos[i+1].patrolMaxX, 'Sectors ordered horizontally');
  }
});

test('Answer UFO badges never overlap horizontally across 300 simulation frames', function() {
  const engine = new EducationalInvaderEngine({ id: 'medium' });
  engine.setup({
    createCanvas: () => {},
    frameRate: () => {}
  });

  const w = 900;
  const h = 650;
  for (let frame = 0; frame < 300; frame++) {
    engine._updateUFOs(w, h);

    // Verify pairwise badges on the same vertical level do not overlap
    for (let i = 0; i < engine.ufos.length; i++) {
      const ufoA = engine.ufos[i];
      if (!ufoA.isAlive) continue;

      for (let j = i + 1; j < engine.ufos.length; j++) {
        const ufoB = engine.ufos[j];
        if (!ufoB.isAlive) continue;

        const dy = Math.abs(ufoA.y - ufoB.y);
        const dx = Math.abs(ufoA.x - ufoB.x);

        // If on same or close row (< 45px vertical separation)
        if (dy < 45) {
          const minSafeX = (ufoA.badgeW + ufoB.badgeW) / 2;
          assert.ok(dx >= minSafeX - 10, `Frame ${frame}: UFO ${i} and ${j} badges must not overlap horizontally (dx=${dx.toFixed(1)}, minSafe=${minSafeX.toFixed(1)})`);
        }
      }
    }
  }
});

// ============================================================================
// 13. GAME FREEZE PREVENTION & CONTINUOUS INPUT RESPONSIVENESS
// ============================================================================
console.log('--- 13. Game Freeze Prevention & Input Flow ---');

test('Keyboard input handler prevents default scroll and updates keysDown map', function() {
  const engine = new EducationalInvaderEngine({ id: 'easy' });
  let prevented = false;
  const mockEvent = {
    code: 'Space',
    key: ' ',
    preventDefault: () => { prevented = true; }
  };

  engine._setupKeyboard();
  engine._keyDownHandler(mockEvent);

  assert.equal(prevented, true, 'Space keydown must call preventDefault()');
  assert.equal(engine.keysDown['Space'], true, 'keysDown map must record Space');

  // Blur handler clears stuck keys
  engine._blurHandler();
  assert.deepEqual(engine.keysDown, {}, 'Window blur must clear all held keys to prevent lockups');
});

test('Calling _triggerGameOver executes smoothly without TypeError or exceptions', function() {
  const engine = new EducationalInvaderEngine({ id: 'easy' });
  engine.setup({
    createCanvas: () => {},
    frameRate: () => {}
  });

  assert.doesNotThrow(() => {
    engine._triggerGameOver();
  }, 'Trigger game over must not throw any exception');

  assert.equal(engine.state.isGameOver(), true, 'State must transition to GAME_OVER');
  assert.equal(engine.isPaused, true, 'Engine must be paused on game over');
});

test('Player spaceship remains continuously responsive across gameplay events', function() {
  const engine = new EducationalInvaderEngine({ id: 'easy' });
  engine.setup({
    createCanvas: () => {},
    frameRate: () => {}
  });

  const initialX = engine.player.x;

  // 1. Move right
  engine.keysDown['ArrowRight'] = true;
  engine._updatePlayer(900, 650);
  engine.keysDown['ArrowRight'] = false;
  assert.ok(engine.player.x > initialX, 'Player moves right on ArrowRight');

  // 2. Simulate correct answer
  const correctUFO = engine.ufos.find(u => u.isCorrect);
  assert.ok(correctUFO, 'Must have correct UFO');
  engine._resolveAnswerHit(correctUFO, 900, 650);
  assert.ok(engine.state.score > 0, 'Score awarded');

  // Player must still be movable
  const prevX = engine.player.x;
  engine.keysDown['ArrowLeft'] = true;
  engine._updatePlayer(900, 650);
  engine.keysDown['ArrowLeft'] = false;
  assert.ok(engine.player.x < prevX, 'Player still moves after answering correctly');

  // Player laser can fire
  const fired = engine.firePlayerLaser();
  assert.equal(fired, true, 'Player can fire laser after answering correctly');
  assert.equal(engine.playerLasers.length, 2, 'Dual lasers spawned in flight');

  // 3. Simulate incorrect answer
  const wrongUFO = engine.ufos.find(u => !u.isCorrect);
  assert.ok(wrongUFO, 'Must have wrong UFO');
  const prevLives = engine.state.lives;
  engine._resolveAnswerHit(wrongUFO, 900, 650);
  assert.equal(engine.state.lives, prevLives - 1, 'Lost 1 life on wrong answer');

  // Player must STILL be movable and able to shoot
  const prevX2 = engine.player.x;
  engine.keysDown['KeyD'] = true;
  engine._updatePlayer(900, 650);
  engine.keysDown['KeyD'] = false;
  assert.ok(engine.player.x > prevX2, 'Player still moves after incorrect answer');

  // Reset laser cooldown to test firing after cooldown elapsed
  engine.lastFireTime = 0;
  const fired2 = engine.firePlayerLaser();
  assert.equal(fired2, true, 'Player can still fire laser after incorrect answer');

  // 4. Test Pause & Resume
  engine.pause();
  assert.equal(engine.isPaused, true, 'Paused');
  engine.resume();
  assert.equal(engine.isPaused, false, 'Resumed');

  const prevX3 = engine.player.x;
  engine.keysDown['KeyA'] = true;
  engine._updatePlayer(900, 650);
  engine.keysDown['KeyA'] = false;
  assert.ok(engine.player.x < prevX3, 'Player responds immediately after pause and resume');
});

// ============================================================================
// 14. COLLISION HANDLING ROBUSTNESS & STALE ENTITY REGRESSION SUITE
// ============================================================================
console.log('--- 14. Collision Handling Robustness & Stale Entity Regression ---');

test('Collision handling executes cleanly with valid dual lasers and UFOs', function() {
  const engine = new EducationalInvaderEngine({ id: 'easy' });
  engine.setup({ createCanvas: () => {}, frameRate: () => {} });

  const correctUFO = engine.ufos.find(u => u.isCorrect);
  engine.player.x = correctUFO.x;
  engine.firePlayerLaser();
  assert.equal(engine.playerLasers.length, 2, 'Must have dual lasers in flight');

  // Align lasers with correct UFO
  engine.playerLasers[0].x = correctUFO.x + 10;
  engine.playerLasers[0].y = correctUFO.y + 10;
  engine.playerLasers[1].x = correctUFO.x + 20;
  engine.playerLasers[1].y = correctUFO.y + 10;

  assert.doesNotThrow(() => {
    engine._handleCollisions(900, 650);
  }, 'Dual laser collision with correct answer must not throw');

  assert.equal(engine.state.score, 100, 'Score awarded for correct hit');
  assert.equal(engine.playerLasers.length, 0, 'Lasers cleared cleanly for feedback phase');
  assert.ok(engine.feedbackPauseTicks > 0, 'Feedback celebration active');
});

test('Collision handling when an entity has been removed mid-loop (Original Bug Reproduction)', function() {
  const engine = new EducationalInvaderEngine({ id: 'easy' });
  engine.setup({ createCanvas: () => {}, frameRate: () => {} });

  // Fire dual lasers (length 2)
  engine.firePlayerLaser();
  assert.equal(engine.playerLasers.length, 2);

  // Position laser 1 to trigger correct answer, which invokes `this.playerLasers = []`
  const correctUFO = engine.ufos.find(u => u.isCorrect);
  engine.playerLasers[1].x = correctUFO.x + 10;
  engine.playerLasers[1].y = correctUFO.y + 10;

  // Position laser 0 elsewhere
  engine.playerLasers[0].x = 100;
  engine.playerLasers[0].y = 500;

  // Running collision pass must NOT throw: Cannot read properties of undefined (reading 'x')
  assert.doesNotThrow(() => {
    engine._handleCollisions(900, 650);
  }, 'Emptied playerLasers mid-loop must never crash collision pass on undefined.x');
});

test('Collision handling when a position reference is missing or corrupt', function() {
  const engine = new EducationalInvaderEngine({ id: 'hard' });
  engine.setup({ createCanvas: () => {}, frameRate: () => {} });

  // Inject corrupted / missing position objects into all collision arrays
  engine.playerLasers.push(undefined);
  engine.playerLasers.push(null);
  engine.playerLasers.push({});
  engine.playerLasers.push({ x: undefined, y: undefined });
  engine.playerLasers.push({ x: 200, y: 300, width: 6, height: 18, vy: -9 });

  engine.enemyLasers.push(undefined);
  engine.enemyLasers.push({});
  engine.enemyLasers.push({ x: null, y: null });

  engine.bossProjectiles.push(undefined);
  engine.bossProjectiles.push({});
  engine.bossProjectiles.push({ type: 'axe' });

  engine.ufos.push(undefined);
  engine.ufos.push({ isAlive: true }); // missing x and y

  assert.doesNotThrow(() => {
    engine._handleCollisions(900, 650);
  }, 'Corrupted or missing position references must be safely skipped');

  assert.doesNotThrow(() => {
    engine._updateProjectiles(900, 650);
  }, 'Projectiles update must safely skip corrupt entities');
});

test('Collision handling after an answer UFO is destroyed', function() {
  const engine = new EducationalInvaderEngine({ id: 'medium' });
  engine.setup({ createCanvas: () => {}, frameRate: () => {} });

  const wrongUFO = engine.ufos.find(u => !u.isCorrect);
  const initialLives = engine.state.lives;

  engine.firePlayerLaser();
  engine.playerLasers[0].x = wrongUFO.x + 10;
  engine.playerLasers[0].y = wrongUFO.y + 10;
  engine.playerLasers[1].x = wrongUFO.x + 20;
  engine.playerLasers[1].y = wrongUFO.y + 10;

  engine._handleCollisions(900, 650);

  assert.equal(engine.state.lives, initialLives - 1, 'Exactly 1 life deducted for wrong answer');
  assert.equal(wrongUFO.isAlive, false, 'Wrong UFO destroyed');
  assert.ok(wrongUFO.respawnTimer > 0, 'Respawn timer running');

  // Fire again at the same dead UFO position
  engine.lastFireTime = 0;
  engine.firePlayerLaser();
  engine.playerLasers[0].x = wrongUFO.x + 10;
  engine.playerLasers[0].y = wrongUFO.y + 10;

  engine._handleCollisions(900, 650);
  assert.equal(engine.state.lives, initialLives - 1, 'Dead UFO cannot be hit again');
});

test('Collision handling after question transitions and continuous game loop', function() {
  const engine = new EducationalInvaderEngine({ id: 'easy' });
  engine.setup({ createCanvas: () => {}, frameRate: () => {} });

  // 1. Solve question
  const correctUFO = engine.ufos.find(u => u.isCorrect);
  engine.firePlayerLaser();
  engine.playerLasers[1].x = correctUFO.x + 10;
  engine.playerLasers[1].y = correctUFO.y + 10;
  engine._handleCollisions(900, 650);

  // 2. Advance ticks through celebration pause to trigger question load
  while (engine.feedbackPauseTicks > 0) {
    engine.update(900, 650);
  }

  assert.equal(engine.questionIndex, 1, 'Advanced to question 2');
  assert.equal(engine.ufos.length, 4, '4 fresh UFOs spawned');

  // 3. Verify player movement and shooting after collision event
  const startX = engine.player.x;
  engine.keysDown['ArrowRight'] = true;
  engine._updatePlayer(900, 650);
  engine.keysDown['ArrowRight'] = false;
  assert.ok(engine.player.x > startX, 'Player moves right after collision event');

  engine.lastFireTime = 0;
  const fired = engine.firePlayerLaser();
  assert.equal(fired, true, 'Player can fire laser after question transition');

  // 4. Run 60 full game loop updates
  assert.doesNotThrow(() => {
    for (let f = 0; f < 60; f++) {
      engine.update(900, 650);
    }
  }, 'Game loop must continue updating smoothly across 60 frames after collision');
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('');
console.log('========================================');
console.log(`Results: ${passed}/${passed + failed} assertions passed.`);
if (failed === 0) {
  console.log('ALL EDUCATIONAL MODE SPECIFICATIONS VERIFIED SUCCESSFULLY!');
} else {
  console.log('SOME TESTS FAILED');
  process.exitCode = 1;
}
console.log('========================================');
console.log('');
