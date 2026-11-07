/**
 * MindRush — Phase 4.3: Space Invader Reactive UFO AI Test Suite
 * Comprehensive verification of:
 * 1. Progression & Insane unlock enforcement
 * 2. Space Invader difficulty briefing content
 * 3. Mode select dynamic Play button & selection state
 * 4. Horizontal-only movement & fixed Y position
 * 5. Easy mode finite target objective (10 targets) & completion
 * 6. Hostile UFO diving & UFO-player collision detection
 * 7. Mini-Boss & Final Boss Lady integration + lightning
 * 8. Centered loading screen
 * 9. Mode-specific leaderboard categorization
 * 10. Reactive UFO AI (ROAM, EVADE, DIVE, RECOVER)
 */

import fs from 'fs';
import path from 'path';
import { SpaceInvaderEngine, INVADER_CONFIGS, UFO_AI_STATE } from '../public/js/game/space-invader-engine.js';
import { GestureController } from '../public/js/game/gesture.js';
import { DIFFICULTIES, getDifficultyConfig, isInsaneUnlocked, unlockInsane, resetProgression, setProgressionUserContext, clearProgressionUserContext } from '../public/js/game/difficulty.js';
import { Score, memoryScoreStore, normalizeScoreMode } from '../server/models/Score.js';
import { User, memoryUserStore } from '../server/models/User.js';

console.log('=== MindRush Phase 4.3: Space Invader Reactive UFO AI Suite ===\n');

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

async function runTests() {
  memoryUserStore.clear();
  memoryScoreStore.clear();
  clearProgressionUserContext();
  resetProgression();

  const mockWidth = 1000;
  const mockHeight = 800;

  // ========================================================
  // Test 1: Correct Difficulty Unlocking & Progression
  // ========================================================
  console.log('\n--- 1. Progression & Insane Difficulty Unlocking ---');
  assert(!isInsaneUnlocked(), 'Insane mode starts strictly locked initially');

  // Verify scoped user context isolation
  setProgressionUserContext('cadet_user_1');
  assert(!isInsaneUnlocked(), 'Insane mode is locked for cadet_user_1');

  unlockInsane();
  assert(isInsaneUnlocked(), 'Insane mode unlocks after conquering Hard mode');

  // Switch to another user: Insane must remain locked for user 2
  setProgressionUserContext('cadet_user_2');
  assert(!isInsaneUnlocked(), 'Insane mode remains locked for cadet_user_2 (no leakage)');

  // Refresh simulation: re-checking cadet_user_1 still retains unlock
  setProgressionUserContext('cadet_user_1');
  assert(isInsaneUnlocked(), 'cadet_user_1 retains Insane unlock across simulated refresh');

  clearProgressionUserContext();
  resetProgression();

  // Skyfall difficulty progression remains intact
  assert(DIFFICULTIES.hard.nextLevel && DIFFICULTIES.hard.nextLevel.threshold === 1000, 'Skyfall Hard threshold is 1000 points');

  // ========================================================
  // Test 2: Space Invader Difficulty Briefing Content
  // ========================================================
  console.log('\n--- 2. Difficulty Briefing Content for Space Invader ---');
  const diffSelectHtml = fs.readFileSync(path.resolve('public/difficulty-select.html'), 'utf8');

  assert(diffSelectHtml.includes('desc-easy'), 'difficulty-select.html has desc-easy element');
  assert(diffSelectHtml.includes('pills-easy'), 'difficulty-select.html has pills-easy element');
  assert(diffSelectHtml.includes('desc-hard'), 'difficulty-select.html has desc-hard element');
  assert(diffSelectHtml.includes('Mini-Boss'), 'difficulty-select.html briefs Mini-Boss for Hard/Insane');
  assert(diffSelectHtml.includes('Final Boss Lady'), 'difficulty-select.html briefs Final Boss Lady for Insane');
  assert(diffSelectHtml.includes('10 Target Goal'), 'difficulty-select.html briefs 10 Target Goal for Easy');

  // ========================================================
  // Test 3: Simplified Mode Selection & Dynamic Play Button
  // ========================================================
  console.log('\n--- 3. Simplified Mode Selection & Dynamic Play Button ---');
  const modeSelectHtml = fs.readFileSync(path.resolve('public/mode-select.html'), 'utf8');

  assert(modeSelectHtml.includes('id="btn-play-fun-mode"'), 'mode-select.html has single dynamic play button');
  assert(modeSelectHtml.includes('id="subgame-skyfall"'), 'mode-select.html has selectable Skyfall card');
  assert(modeSelectHtml.includes('id="subgame-space-invader"'), 'mode-select.html has selectable Space Invader card');
  assert(modeSelectHtml.includes('selectSubgame'), 'mode-select.html has selectSubgame switcher function');
  assert(modeSelectHtml.includes('Play Skyfall'), 'Default button label is Play Skyfall');

  // ========================================================
  // Test 4: Horizontal-Only Movement & Fixed Y Position
  // ========================================================
  console.log('\n--- 4. Horizontal-Only Movement & Fixed Y Position ---');
  const engineCode = fs.readFileSync(path.resolve('public/js/game/space-invader-engine.js'), 'utf8');

  // Verify dotted demarcation line was removed
  assert(!engineCode.includes('setLineDash'), 'Dotted horizontal line removed from space-invader-engine.js');

  // Verify mouse movement is disabled for spaceship (no mouse assist code)
  assert(!engineCode.includes('this.input.currentX'), 'Mouse movement assist removed from _updatePlayer');

  const engine = new SpaceInvaderEngine({ id: 'easy' });
  engine._initPlayer(mockWidth, mockHeight);

  // Player must have a fixedY property
  assert(typeof engine.player.fixedY === 'number', 'Player has fixedY constant property');
  const expectedFixedY = mockHeight - engine.player.height - 40;
  assert(engine.player.fixedY === expectedFixedY, `Player fixedY is ${engine.player.fixedY} === ${expectedFixedY}`);

  // Player Y must match fixedY after initialization
  assert(engine.player.y === engine.player.fixedY, 'Player Y equals fixedY after init');

  // Attempting to set player.y to a different value and clamping should reset to fixedY
  engine.player.y = 100; // attempt to fly into UFO territory
  engine._clampPlayerToBounds(mockWidth, mockHeight);
  assert(engine.player.y === engine.player.fixedY, `Player Y locked to fixedY after upward move attempt (y=${engine.player.y})`);

  engine.player.y = 1500; // attempt to fly below screen
  engine._clampPlayerToBounds(mockWidth, mockHeight);
  assert(engine.player.y === engine.player.fixedY, `Player Y locked to fixedY after downward move attempt (y=${engine.player.y})`);

  // Horizontal clamping still works
  engine.player.x = -100;
  engine._clampPlayerToBounds(mockWidth, mockHeight);
  assert(engine.player.x === 10, 'Player X clamped to left boundary (10)');

  engine.player.x = 5000;
  engine._clampPlayerToBounds(mockWidth, mockHeight);
  assert(engine.player.x === mockWidth - engine.player.width - 10, 'Player X clamped to right boundary');

  // Verify fixedY is consistent across all difficulties
  const diffKeys = ['easy', 'medium', 'hard', 'insane'];
  for (const dk of diffKeys) {
    const eng = new SpaceInvaderEngine({ id: dk });
    eng._initPlayer(mockWidth, mockHeight);
    assert(eng.player.y === eng.player.fixedY, `${dk} mode: player Y equals fixedY at init`);
  }

  // ========================================================
  // Test 5: Easy Difficulty Finite Objective & Completion
  // ========================================================
  console.log('\n--- 5. Easy Difficulty Finite Objective & Completion ---');
  assert(INVADER_CONFIGS.easy.targetObjective === 10, 'Easy mode target objective is set to 10 targets');
  assert(INVADER_CONFIGS.easy.hasHostileFire === false, 'Easy mode has 0 hostile attacks');
  assert(INVADER_CONFIGS.easy.hasDivingUFOs === false, 'Easy mode UFOs do not dive bomb');

  const easyEngine = new SpaceInvaderEngine({ id: 'easy' });
  easyEngine._initPlayer(mockWidth, mockHeight);
  easyEngine._initUFOFleet(mockWidth, mockHeight);

  assert(easyEngine.targetsDestroyed === 0, 'targetsDestroyed starts at 0');
  assert(!easyEngine.easyCompleted, 'easyCompleted starts as false');

  // Simulate destroying 10 targets
  easyEngine.targetsDestroyed = 10;
  easyEngine._checkObjectives({ width: mockWidth, height: mockHeight });
  assert(easyEngine.easyCompleted === true, 'easyCompleted triggers when reaching 10 targets');
  assert(easyEngine.state.isPaused(), 'Game pauses when Easy objective is completed');

  // ========================================================
  // Test 6: Hostile UFO Diving & UFO-Player Collision Detection
  // ========================================================
  console.log('\n--- 6. Hostile UFO Diving & UFO-Player Collision ---');
  assert(INVADER_CONFIGS.medium.hasDivingUFOs === true, 'Medium mode enables hostile diving UFOs');
  assert(INVADER_CONFIGS.hard.hasDivingUFOs === true, 'Hard mode enables hostile diving UFOs');
  assert(INVADER_CONFIGS.insane.hasDivingUFOs === true, 'Insane mode enables hostile diving UFOs');

  const mediumEngine = new SpaceInvaderEngine({ id: 'medium' });
  mediumEngine._initPlayer(mockWidth, mockHeight);
  mediumEngine._initUFOFleet(mockWidth, mockHeight);

  // Trigger diving on a UFO
  const divingUFO = mediumEngine.ufos[0];
  divingUFO.isDiving = true;
  divingUFO.diveVy = 4.0;
  divingUFO.diveTargetX = mediumEngine.player.x;

  // Move diving UFO directly into player coordinates
  divingUFO.x = mediumEngine.player.x;
  divingUFO.y = mediumEngine.player.y;

  const livesBefore = mediumEngine.state.lives;
  mediumEngine.player.invulnerableTicks = 0;
  mediumEngine._checkCollisions({ width: mockWidth, height: mockHeight });

  assert(!divingUFO.isAlive, 'Diving UFO destroyed upon colliding with player');
  assert(mediumEngine.state.lives === livesBefore - 1, 'Player loses 1 life upon direct UFO collision');
  assert(mediumEngine.player.invulnerableTicks > 0, 'Player gains temporary invulnerability protection after collision');

  // ========================================================
  // Test 7: Mini-Boss & Final Boss Lady Integration
  // ========================================================
  console.log('\n--- 7. Mini-Boss & Final Boss Lady Sprites and Spawning ---');
  
  // Verify required boss sprite files exist
  const bossFiles = [
    'SpaceShooterGFX/boss_UFO_0.png',
    'SpaceShooterGFX/boss_UFO_1.png',
    'SpaceShooterGFX/boss_UFO_2.png',
    'SpaceShooterGFX/boss_goddess_0.png',
    'SpaceShooterGFX/boss_goddess_1.png',
    'SpaceShooterGFX/boss_goddess_2.png',
    'SpaceShooterGFX/boss_goddess_halo.png'
  ];
  bossFiles.forEach(bf => {
    assert(fs.existsSync(path.resolve(bf)), `Boss asset exists: ${bf}`);
  });

  // Verify lightning sprites exist
  const lightningFiles = [
    'SpaceShooterGFX/lightning_purple_0.png',
    'SpaceShooterGFX/lightning_purple_1.png',
    'SpaceShooterGFX/lightning_purple_2.png'
  ];
  lightningFiles.forEach(lf => {
    assert(fs.existsSync(path.resolve(lf)), `Lightning asset exists: ${lf}`);
  });

  // Hard mode: Mini-Boss spawn check
  const hardEngine = new SpaceInvaderEngine({ id: 'hard' });
  hardEngine._initPlayer(mockWidth, mockHeight);
  hardEngine.targetsDestroyed = 8;
  hardEngine._checkObjectives({ width: mockWidth, height: mockHeight });

  assert(hardEngine.miniBoss !== null, 'Mini-Boss spawns in Hard mode at threshold');
  assert(hardEngine.miniBoss.hp === 15, 'Mini-Boss has 15 HP in Hard mode');
  assert(hardEngine.miniBoss.width === 64, 'Mini-Boss scaled to 64px width (2x larger than regular UFOs)');

  // Defeat Mini-Boss
  hardEngine.playerLasers = [{
    x: hardEngine.miniBoss.x + 10,
    y: hardEngine.miniBoss.y + 10,
    width: 12,
    height: 26,
    dy: -12,
    isAlive: true
  }];
  hardEngine.miniBoss.hp = 1; // 1 shot left
  hardEngine._checkCollisions({ width: mockWidth, height: mockHeight });

  assert(!hardEngine.miniBoss.isAlive, 'Mini-Boss destroyed when HP reaches 0');
  assert(hardEngine.miniBossDefeated === true, 'miniBossDefeated flag set');
  assert(hardEngine.state.score >= 300, 'Defeating Mini-Boss awards +300 points');

  // Insane mode: Final Boss Lady (distinct from Mini-Boss)
  const insaneEngine = new SpaceInvaderEngine({ id: 'insane' });
  insaneEngine._initPlayer(mockWidth, mockHeight);
  insaneEngine.miniBossDefeated = true; // after Mini-Boss defeated
  insaneEngine._checkObjectives({ width: mockWidth, height: mockHeight });

  assert(insaneEngine.finalBoss !== null, 'Final Boss Lady spawns in Insane mode');
  assert(insaneEngine.finalBoss.hp === 35, 'Final Boss Lady has 35 HP');
  assert(insaneEngine.finalBoss.width === 96, 'Final Boss Lady scaled to 96px width (grand flagship)');
  assert(insaneEngine.finalBoss.type === 'finalBoss', 'Final Boss has type finalBoss');
  assert(typeof insaneEngine.finalBoss.lightningTimer === 'number', 'Final Boss Lady has lightningTimer for lightning attacks');

  // Verify Boss Lady is visually larger than Mini-Boss
  const mbSize = INVADER_CONFIGS.hard.hasMiniBoss ? 64 : 0;
  assert(insaneEngine.finalBoss.width > mbSize, `Boss Lady (${insaneEngine.finalBoss.width}px) larger than Mini-Boss (${mbSize}px)`);

  // Defeat Final Boss Lady
  insaneEngine.finalBoss.hp = 1;
  insaneEngine.playerLasers = [{
    x: insaneEngine.finalBoss.x + 10,
    y: insaneEngine.finalBoss.y + 10,
    width: 12,
    height: 26,
    dy: -12,
    isAlive: true
  }];
  insaneEngine._checkCollisions({ width: mockWidth, height: mockHeight });

  assert(!insaneEngine.finalBoss.isAlive, 'Final Boss Lady destroyed when HP reaches 0');
  assert(insaneEngine.finalBossDefeated === true, 'finalBossDefeated flag set');
  assert(insaneEngine.state.score >= 1000, 'Defeating Final Boss Lady awards +1,000 points');

  // ========================================================
  // Test 7.5: Lightning Bolt Attack Lifecycle
  // ========================================================
  console.log('\n--- 7.5. Lightning Bolt Attack Lifecycle ---');

  const lEngine = new SpaceInvaderEngine({ id: 'insane' });
  lEngine._initPlayer(mockWidth, mockHeight);
  lEngine.miniBossDefeated = true;
  lEngine._checkObjectives({ width: mockWidth, height: mockHeight });
  assert(lEngine.finalBoss !== null, 'Final Boss spawned for lightning test');

  // Verify lightningBolts array exists
  assert(Array.isArray(lEngine.lightningBolts), 'lightningBolts array is initialized');
  assert(lEngine.lightningBolts.length === 0, 'lightningBolts starts empty');

  // Spawn a lightning bolt manually
  lEngine._spawnLightningBolt({ width: mockWidth, height: mockHeight });
  assert(lEngine.lightningBolts.length === 1, 'Lightning bolt spawned');

  const bolt = lEngine.lightningBolts[0];
  assert(bolt.phase === 'telegraph', 'Lightning bolt starts in telegraph phase');
  assert(bolt.isAlive === true, 'Lightning bolt is alive');
  assert(typeof bolt.telegraphDuration === 'number', 'Lightning bolt has telegraph duration');
  assert(typeof bolt.strikeDuration === 'number', 'Lightning bolt has strike duration');

  // Advance through telegraph phase
  for (let t = 0; t < bolt.telegraphDuration; t++) {
    lEngine._updateLightningBolts({ width: mockWidth, height: mockHeight });
  }
  assert(bolt.phase === 'strike', 'Lightning bolt transitions to strike phase after telegraph');

  // Advance through strike phase
  for (let t = 0; t < bolt.strikeDuration; t++) {
    lEngine._updateLightningBolts({ width: mockWidth, height: mockHeight });
  }
  assert(bolt.phase === 'fade', 'Lightning bolt transitions to fade phase after strike');

  // Advance through fade phase
  for (let t = 0; t < bolt.fadeDuration; t++) {
    lEngine._updateLightningBolts({ width: mockWidth, height: mockHeight });
  }
  assert(!bolt.isAlive, 'Lightning bolt dies after fade phase');

  // Test lightning collision with player
  const lEngine2 = new SpaceInvaderEngine({ id: 'insane' });
  lEngine2._initPlayer(mockWidth, mockHeight);
  lEngine2.miniBossDefeated = true;
  lEngine2._checkObjectives({ width: mockWidth, height: mockHeight });
  lEngine2._spawnLightningBolt({ width: mockWidth, height: mockHeight });

  const bolt2 = lEngine2.lightningBolts[0];
  // Force bolt directly on player
  bolt2.x = lEngine2.player.x;
  // Advance to strike phase
  bolt2.phase = 'strike';
  bolt2.strikeTicks = 0;
  lEngine2.player.invulnerableTicks = 0;
  const livesBefore2 = lEngine2.state.lives;
  lEngine2._updateLightningBolts({ width: mockWidth, height: mockHeight });
  assert(bolt2.hasHit === true, 'Lightning bolt registers collision with player');
  assert(lEngine2.state.lives === livesBefore2 - 1, 'Lightning strike reduces player lives by 1');
  assert(lEngine2.player.invulnerableTicks > 0, 'Player gains invulnerability after lightning hit');

  // ========================================================
  // Test 8: Centered Loading Screen
  // ========================================================
  console.log('\n--- 8. Centered Loading Screen ---');
  const gameHtml = fs.readFileSync(path.resolve('public/game.html'), 'utf8');
  assert(gameHtml.includes('id="p5_loading"'), 'game.html contains #p5_loading container');
  assert(gameHtml.includes('loading-box'), 'game.html contains loading-box');

  const gameCss = fs.readFileSync(path.resolve('public/css/game.css'), 'utf8');
  assert(gameCss.includes('#p5_loading'), 'game.css styles #p5_loading');
  assert(gameCss.includes('justify-content: center'), 'game.css centers loading indicator vertically');
  assert(gameCss.includes('align-items: center'), 'game.css centers loading indicator horizontally');

  // ========================================================
  // Test 9: Mode-Specific Leaderboards ('skyfall' vs 'space-invader')
  // ========================================================
  console.log('\n--- 9. Mode-Specific Leaderboard Filtering ---');
  assert(normalizeScoreMode('invader') === 'space-invader', 'normalizeScoreMode converts invader to space-invader');
  assert(normalizeScoreMode('skyfall') === 'skyfall', 'normalizeScoreMode handles skyfall');
  assert(normalizeScoreMode('multiplayer') === 'multiplayer', 'normalizeScoreMode handles multiplayer');
  assert(normalizeScoreMode(undefined) === 'skyfall', 'normalizeScoreMode defaults to skyfall');

  // Create test user
  const testUser = await memoryUserStore.create({
    fullName: 'Leaderboard Pilot',
    username: 'leadpilot',
    dob: '2000-01-01',
    gender: 'male',
    passwordHash: 'hashed'
  });

  // Submit 1 Skyfall score and 1 Space Invader score
  await Score.create({
    userId: testUser._id,
    username: testUser.username,
    score: 850,
    difficulty: 'MEDIUM',
    mode: 'skyfall'
  });

  await Score.create({
    userId: testUser._id,
    username: testUser.username,
    score: 620,
    difficulty: 'MEDIUM',
    mode: 'space-invader'
  });

  const skyfallLeaderboard = await Score.getTop(10, 'MEDIUM', 'skyfall');
  const invaderLeaderboard = await Score.getTop(10, 'MEDIUM', 'space-invader');
  const multiplayerLeaderboard = await Score.getTop(10, 'MEDIUM', 'multiplayer');

  assert(skyfallLeaderboard.length === 1 && skyfallLeaderboard[0].score === 850, 'Skyfall query returns only Skyfall score (850)');
  assert(invaderLeaderboard.length === 1 && invaderLeaderboard[0].score === 620, 'Space Invader query returns only Space Invader score (620)');
  assert(multiplayerLeaderboard.length === 0, 'Multiplayer query returns empty array (coming soon)');

  const dashboardHtml = fs.readFileSync(path.resolve('public/dashboard.html'), 'utf8');
  assert(dashboardHtml.includes('lb-tab-skyfall'), 'dashboard.html has Skyfall leaderboard tab');
  assert(dashboardHtml.includes('lb-tab-invader'), 'dashboard.html has Space Invader leaderboard tab');
  assert(dashboardHtml.includes('lb-tab-multiplayer'), 'dashboard.html has Multiplayer leaderboard tab');
  assert(dashboardHtml.includes('switchLeaderboardMode'), 'dashboard.html has switchLeaderboardMode function');

  // ========================================================
  // Test 10: Reactive UFO AI System
  // ========================================================
  console.log('\n--- 10. Reactive UFO AI System ---');

  // 10.1 AI State Export
  assert(UFO_AI_STATE.ROAM === 'ROAM', 'UFO_AI_STATE.ROAM exported');
  assert(UFO_AI_STATE.EVADE === 'EVADE', 'UFO_AI_STATE.EVADE exported');
  assert(UFO_AI_STATE.DIVE === 'DIVE', 'UFO_AI_STATE.DIVE exported');
  assert(UFO_AI_STATE.RECOVER === 'RECOVER', 'UFO_AI_STATE.RECOVER exported');

  // 10.2 AI config present on all difficulties
  for (const dk of ['easy', 'medium', 'hard', 'insane']) {
    const cfg = INVADER_CONFIGS[dk];
    assert(typeof cfg.ai === 'object', `${dk} config has AI settings`);
    assert(typeof cfg.ai.evadeEnabled === 'boolean', `${dk} AI has evadeEnabled flag`);
    assert(typeof cfg.ai.diveChance === 'number', `${dk} AI has diveChance`);
    assert(typeof cfg.ai.roamVariation === 'number', `${dk} AI has roamVariation`);
    assert(typeof cfg.ai.recoverTicks === 'number', `${dk} AI has recoverTicks`);
  }

  // 10.3 Easy: evade disabled, no dives, no awareness
  assert(INVADER_CONFIGS.easy.ai.evadeEnabled === false, 'Easy AI: evade disabled');
  assert(INVADER_CONFIGS.easy.ai.diveChance === 0, 'Easy AI: diveChance is 0');
  assert(INVADER_CONFIGS.easy.ai.awarenessRadius === 0, 'Easy AI: no player awareness');
  assert(INVADER_CONFIGS.easy.ai.maxSimultaneousDivers === 0, 'Easy AI: no divers');

  // 10.4 Difficulty-scaled AI parameters
  assert(INVADER_CONFIGS.medium.ai.evadeSpeed < INVADER_CONFIGS.hard.ai.evadeSpeed, 'Hard evade faster than Medium');
  assert(INVADER_CONFIGS.hard.ai.evadeSpeed < INVADER_CONFIGS.insane.ai.evadeSpeed, 'Insane evade fastest');
  assert(INVADER_CONFIGS.medium.ai.evadeCooldown > INVADER_CONFIGS.insane.ai.evadeCooldown, 'Insane evade cooldown shorter');
  assert(INVADER_CONFIGS.medium.ai.diveChance < INVADER_CONFIGS.insane.ai.diveChance, 'Insane dives more often');
  assert(INVADER_CONFIGS.insane.ai.maxSimultaneousDivers > INVADER_CONFIGS.medium.ai.maxSimultaneousDivers, 'Insane allows more simultaneous divers');

  // 10.5 UFOs initialize with AI state properties
  const aiEngine = new SpaceInvaderEngine({ id: 'hard' });
  aiEngine._initPlayer(mockWidth, mockHeight);
  aiEngine._initUFOFleet(mockWidth, mockHeight);
  const sampleUfo = aiEngine.ufos[0];

  assert(sampleUfo.aiState === UFO_AI_STATE.ROAM, 'UFO starts in ROAM state');
  assert(sampleUfo.aiTicks === 0, 'UFO aiTicks starts at 0');
  assert(typeof sampleUfo.evadeCooldown === 'number', 'UFO has evadeCooldown');
  assert(typeof sampleUfo.personality === 'number', 'UFO has personality modifier');
  assert(sampleUfo.personality >= 0.8 && sampleUfo.personality <= 1.2, 'Personality within ±20% range');
  assert(typeof sampleUfo.roamDirTimer === 'number', 'UFO has roamDirTimer for varied movement');
  assert(typeof sampleUfo.roamDirInterval === 'number', 'UFO has unique roamDirInterval');

  // 10.6 Personality variation across UFOs (not all identical)
  const personalities = aiEngine.ufos.map(u => u.personality);
  const uniquePersonalities = new Set(personalities.map(p => p.toFixed(3)));
  assert(uniquePersonalities.size > 1, `UFOs have varied personalities (${uniquePersonalities.size} unique values)`);

  // 10.7 ROAM state: UFO stays within bounds after updates
  const roamEngine = new SpaceInvaderEngine({ id: 'medium' });
  roamEngine._initPlayer(mockWidth, mockHeight);
  roamEngine._initUFOFleet(mockWidth, mockHeight);
  const roamUfo = roamEngine.ufos[0];

  for (let t = 0; t < 200; t++) {
    roamEngine._updateUFOs({ width: mockWidth, height: mockHeight });
  }
  const livingUFOs = roamEngine.ufos.filter(u => u.isAlive);
  const allInBounds = livingUFOs.every(u => u.x >= 15 && u.x <= mockWidth - 55);
  assert(allInBounds, 'All roaming UFOs stay within horizontal bounds after 200 frames');

  // 10.8 EVADE state: projectile detection triggers evasion
  const evadeEngine = new SpaceInvaderEngine({ id: 'hard' });
  evadeEngine._initPlayer(mockWidth, mockHeight);
  evadeEngine._initUFOFleet(mockWidth, mockHeight);
  const testUfo = evadeEngine.ufos[0];
  testUfo.evadeCooldown = 0; // allow immediate evade

  // Place a player laser heading toward the UFO
  evadeEngine.playerLasers.push({
    x: testUfo.x + testUfo.width / 2 - 6,
    y: testUfo.y + testUfo.height + 50,
    width: 12,
    height: 26,
    dy: -12,
    isAlive: true
  });

  // Verify detection
  const threat = evadeEngine._detectIncomingProjectile(testUfo, 110);
  assert(threat !== null, 'UFO detects incoming player projectile');

  // Trigger a roam update that should detect and evade
  const prevX = testUfo.x;
  evadeEngine._aiRoam(testUfo, { width: mockWidth, height: mockHeight }, 15, mockWidth - 55, 60, mockHeight * 0.52, evadeEngine.config.ai, 0);
  assert(testUfo.aiState === UFO_AI_STATE.EVADE, 'UFO transitions to EVADE when projectile detected');
  assert(testUfo.evadeDir !== 0, 'UFO has a non-zero evade direction');
  assert(testUfo.evadeCooldown > 0, 'Evade cooldown activated after dodge');

  // 10.9 EVADE → RECOVER transition
  const evUfo = Object.assign({}, testUfo);
  evUfo.aiTicks = 0;
  evUfo.x = 200;
  evUfo.baseY = 150;
  evUfo.vx = 2;
  for (let t = 0; t < 15; t++) {
    evUfo.aiTicks++;
    evadeEngine._aiEvade(evUfo, { width: mockWidth, height: mockHeight }, 15, mockWidth - 55, evadeEngine.config.ai);
    if (evUfo.aiState !== UFO_AI_STATE.EVADE) break;
  }
  assert(evUfo.aiState === UFO_AI_STATE.RECOVER, 'EVADE transitions to RECOVER after completion');

  // 10.10 RECOVER → ROAM transition
  const recUfo = Object.assign({}, evUfo);
  recUfo.aiState = UFO_AI_STATE.RECOVER;
  recUfo.aiTicks = 0;
  recUfo.recoverTargetY = recUfo.baseY;
  recUfo.y = recUfo.baseY + 5; // close to target
  recUfo.isDiving = false;

  for (let t = 0; t < 50; t++) {
    recUfo.aiTicks++;
    evadeEngine._aiRecover(recUfo, { width: mockWidth, height: mockHeight }, 15, mockWidth - 55, 60, mockHeight * 0.52, evadeEngine.config.ai);
    if (recUfo.aiState === UFO_AI_STATE.ROAM) break;
  }
  assert(recUfo.aiState === UFO_AI_STATE.ROAM, 'RECOVER transitions back to ROAM');

  // 10.11 DIVE state: telegraph then descend
  const diveEngine = new SpaceInvaderEngine({ id: 'hard' });
  diveEngine._initPlayer(mockWidth, mockHeight);
  diveEngine._initUFOFleet(mockWidth, mockHeight);
  const diveUfo = diveEngine.ufos[0];

  // Force into DIVE
  diveUfo.aiState = UFO_AI_STATE.DIVE;
  diveUfo.aiTicks = 0;
  diveUfo.diveWarningTicks = 15;
  diveUfo.diveVy = 5.0;
  diveUfo.diveTargetX = diveEngine.player.x;
  diveUfo.isDiving = false;
  const preWarningY = diveUfo.y;

  // During warning phase, UFO should NOT move
  diveEngine._aiDive(diveUfo, { width: mockWidth, height: mockHeight }, 15, mockWidth - 55, diveEngine.config.ai);
  assert(diveUfo.y === preWarningY, 'UFO does not move during dive telegraph');
  assert(diveUfo.isDiving === false, 'isDiving stays false during telegraph');

  // Exhaust telegraph
  diveUfo.diveWarningTicks = 0;
  diveEngine._aiDive(diveUfo, { width: mockWidth, height: mockHeight }, 15, mockWidth - 55, diveEngine.config.ai);
  assert(diveUfo.isDiving === true, 'UFO begins actual dive after telegraph expires');
  assert(diveUfo.y > preWarningY, 'UFO Y position increases during active dive');

  // Continue dive until screen bottom → transitions to RECOVER
  for (let t = 0; t < 300; t++) {
    diveUfo.aiTicks++;
    diveEngine._aiDive(diveUfo, { width: mockWidth, height: mockHeight + 100 }, 15, mockWidth - 55, diveEngine.config.ai);
    if (diveUfo.aiState !== UFO_AI_STATE.DIVE) break;
  }
  assert(diveUfo.aiState === UFO_AI_STATE.RECOVER, 'DIVE transitions to RECOVER after reaching screen bottom');
  assert(diveUfo.isDiving === false, 'isDiving reset after dive completes');

  // 10.12 Easy mode: UFOs never evade or dive
  const easyAIEngine = new SpaceInvaderEngine({ id: 'easy' });
  easyAIEngine._initPlayer(mockWidth, mockHeight);
  easyAIEngine._initUFOFleet(mockWidth, mockHeight);

  // Place a laser near first UFO
  const easyUfo = easyAIEngine.ufos[0];
  easyAIEngine.playerLasers.push({
    x: easyUfo.x + easyUfo.width / 2 - 6,
    y: easyUfo.y + easyUfo.height + 50,
    width: 12,
    height: 26,
    dy: -12,
    isAlive: true
  });

  // Run updates — UFO should stay in ROAM
  for (let t = 0; t < 100; t++) {
    easyAIEngine._updateUFOs({ width: mockWidth, height: mockHeight });
  }
  assert(easyAIEngine.ufos[0].aiState === UFO_AI_STATE.ROAM, 'Easy mode: UFO stays in ROAM despite incoming projectile');

  // 10.13 UFO destruction during active AI state
  const destEngine = new SpaceInvaderEngine({ id: 'medium' });
  destEngine._initPlayer(mockWidth, mockHeight);
  destEngine._initUFOFleet(mockWidth, mockHeight);
  const destUfo = destEngine.ufos[0];
  destUfo.aiState = UFO_AI_STATE.EVADE;
  destUfo.isAlive = false; // destroyed mid-evade

  // Should not crash when processing dead UFOs
  try {
    destEngine._updateUFOs({ width: mockWidth, height: mockHeight });
    assert(true, 'Dead UFO in EVADE state does not crash AI loop');
  } catch (e) {
    assert(false, 'Dead UFO in EVADE state does not crash AI loop');
  }

  // 10.14 Insane allows more simultaneous divers than Medium
  assert(INVADER_CONFIGS.insane.ai.maxSimultaneousDivers === 3, 'Insane allows 3 simultaneous divers');
  assert(INVADER_CONFIGS.medium.ai.maxSimultaneousDivers === 1, 'Medium allows only 1 simultaneous diver');

  // 10.15 Compatibility: bosses and player movement unaffected
  const compatEngine = new SpaceInvaderEngine({ id: 'insane' });
  compatEngine._initPlayer(mockWidth, mockHeight);
  assert(compatEngine.player.fixedY === mockHeight - compatEngine.player.height - 40, 'Player fixedY unchanged with AI');
  compatEngine.miniBossDefeated = true;
  compatEngine._checkObjectives({ width: mockWidth, height: mockHeight });
  assert(compatEngine.finalBoss !== null, 'Final Boss Lady still spawns with AI system active');
  assert(compatEngine.finalBoss.hp === 35, 'Final Boss Lady still has 35 HP');

  console.log(`\n========================================`);
  console.log(`Phase 4.3 Reactive UFO AI: ${passed}/${total} Passed!`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
