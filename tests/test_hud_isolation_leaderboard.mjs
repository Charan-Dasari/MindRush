/**
 * MindRush — Task 1, 2, 3 & 4 Verification Test Suite
 * Covers:
 * 1. Gameplay HUD: Score visibility, initialization, live updates, removal of duplicate centered mode label, preservation across all 4 difficulties.
 * 2. Account-Isolated Progress: Badges, high scores, Insane unlocks are isolated per user session; no data leaks between accounts; server enforces session identity.
 * 3. Leaderboard Identity & Data: Real authenticated usernames, server-sorted entries, empty state (no fake cadet rows), rejection of spoofed client IDs.
 * 4. Guest Mode & Backward Compatibility.
 */

import { createApp } from '../server/app.js';
import { User, memoryUserStore } from '../server/models/User.js';
import { Score, memoryScoreStore } from '../server/models/Score.js';
import { DIFFICULTIES, getDifficultyConfig, isInsaneUnlocked, unlockInsane, resetProgression, setProgressionUserContext, clearProgressionUserContext } from '../public/js/game/difficulty.js';
import { setBadgeUserContext, clearBadgeUserContext, getUnlockedBadges, unlockBadge, resetBadgeCollection } from '../public/js/game/badges.js';
import { setActiveUser, clearActiveUser, getScopedStorageKey } from '../public/js/game/storage.js';
import { GameState } from '../public/js/game/state.js';
import { GameEngine } from '../public/js/game/engine.js';
import fs from 'fs';
import path from 'path';

console.log('=== MindRush HUD, Account Isolation & Leaderboard Verification Suite ===\n');

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

async function runAllTests() {
  // Clear stores
  memoryUserStore.clear();
  memoryScoreStore.clear();
  clearActiveUser();
  clearBadgeUserContext();
  clearProgressionUserContext();

  // ========================================================
  // Task 1: Gameplay HUD & Score Visibility
  // ========================================================
  console.log('\n--- Task 1: Gameplay HUD & Score Visibility ---');

  // Read game.html and verify DOM structure
  const gameHtml = fs.readFileSync(path.resolve('public/game.html'), 'utf8');

  assert(gameHtml.includes('id="hud-score-tag"'), 'game.html contains dedicated score pill (#hud-score-tag)');
  assert(gameHtml.includes('id="hud-score-val"'), 'game.html contains score value element (#hud-score-val)');
  assert(gameHtml.includes('id="hud-diff-name"'), 'game.html preserves top-left difficulty indicator (#hud-diff-name)');
  assert(gameHtml.includes('id="hud-btn-exit"'), 'game.html preserves exit button (#hud-btn-exit)');
  assert(gameHtml.includes('id="btn-pause-header"'), 'game.html preserves pause button (#btn-pause-header)');
  assert(gameHtml.includes('id="hud-sensor-feedback"'), 'game.html preserves sensor status (#hud-sensor-feedback)');

  // Verify all 4 difficulties exist and configure correctly
  const diffKeys = ['easy', 'medium', 'hard', 'insane'];
  for (const diff of diffKeys) {
    const cfg = getDifficultyConfig(diff);
    assert(cfg && cfg.id === diff, `Difficulty "${diff}" resolves valid game configuration`);
    assert(cfg.name && typeof cfg.name === 'string', `Difficulty "${diff}" has formatted display name: ${cfg.name}`);
  }

  // Inspect engine.js _renderHUD implementation
  const engineJs = fs.readFileSync(path.resolve('public/js/game/engine.js'), 'utf8');

  assert(!engineJs.includes("MODE: ' + this.config.name"), 'engine.js does NOT render redundant centered MODE text');
  assert(!engineJs.includes('p.width / 2, 38'), 'engine.js removed legacy centered mode canvas coordinates');
  assert(!engineJs.includes('p.text(`Score: ${this.state.score}'), 'engine.js removed redundant plain score text from canvas');
  assert(engineJs.includes('Lives: ${this.state.lives}'), 'engine.js renders live lives on canvas');
  assert(engineJs.includes("hudScoreEl.textContent = String(this.state.score)"), 'engine.js synchronizes HTML topbar score with game-state variable');

  // Verify GameState score initialization and manipulation
  const state = new GameState(3);
  assert(state.score === 0, 'New GameState initializes score to 0');
  state.addScore(150);
  assert(state.score === 150, 'addScore updates game-state score to 150');
  state.reset();
  assert(state.score === 0, 'state.reset() resets score back to 0 for new mission');

  // Mock p5 canvas render test for HUD
  const renderedTexts = [];
  const mockP5 = {
    push: () => {},
    pop: () => {},
    fill: () => {},
    noStroke: () => {},
    textFont: () => {},
    textSize: () => {},
    textAlign: () => {},
    text: (str, x, y) => {
      renderedTexts.push({ str, x, y });
    },
    width: 800,
    height: 600
  };

  const domScoreEl = { textContent: '0' };
  global.document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementById: (id) => {
      if (id === 'hud-score-val') return domScoreEl;
      return null;
    }
  };

  const mediumConfig = getDifficultyConfig('medium');
  const engine = new GameEngine(mediumConfig);
  engine.state.addScore(450);

  // Invoke HUD render
  engine._renderHUD(mockP5);

  assert(domScoreEl.textContent === '450', 'DOM styled score element #hud-score-val is dynamically synchronized with engine state');

  const canvasPlainScore = renderedTexts.find(t => t.str.includes('Score:'));
  assert(!canvasPlainScore, 'Canvas HUD render contains NO plain score text (avoids duplicate HUD display)');

  const livesText = renderedTexts.find(t => t.str.includes('Lives: 3'));
  assert(Boolean(livesText), 'HUD renders lives "Lives: 3" on canvas');
  assert(livesText && livesText.y >= 70, `Lives is positioned below HTML header overlay (y=${livesText?.y})`);

  const duplicateModeText = renderedTexts.find(t => t.str.includes('MODE:'));
  assert(!duplicateModeText, 'HUD canvas render contains NO redundant centered MODE label');

  // ========================================================
  // Task 2: Account-Isolated Progress
  // ========================================================
  console.log('\n--- Task 2: Account-Isolated Progress & Badges ---');

  // Launch test Express server with progress routes
  const app = createApp({ isTestEnv: true });
  const server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Register Account A (pilot_alpha)
    const signupARes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Alpha Pilot',
        username: 'pilot_alpha',
        dob: '2005-03-12',
        gender: 'female',
        password: 'PasswordAlpha123!',
        confirmPassword: 'PasswordAlpha123!',
        terms: true
      })
    });
    const signupAData = await signupARes.json();
    assert(signupARes.status === 201 && signupAData.success, 'Account A (pilot_alpha) created successfully');
    const cookieA = signupARes.headers.get('set-cookie')?.split(';')[0];
    const userA = signupAData.user;

    // 2. Register Account B (pilot_beta)
    const signupBRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Beta Navigator',
        username: 'pilot_beta',
        dob: '2004-07-21',
        gender: 'male',
        password: 'PasswordBeta123!',
        confirmPassword: 'PasswordBeta123!',
        terms: true
      })
    });
    const signupBData = await signupBRes.json();
    assert(signupBRes.status === 201 && signupBData.success, 'Account B (pilot_beta) created successfully');
    const cookieB = signupBRes.headers.get('set-cookie')?.split(';')[0];
    const userB = signupBData.user;

    // 3. Sync progress for Account A: 3 badges, highScore 1250, insaneUnlocked true
    const syncARes = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
      body: JSON.stringify({
        badges: ['golden_star', 'water_droplet', 'golden_ring'],
        highScore: 1250,
        insaneUnlocked: true
      })
    });
    const syncAData = await syncARes.json();
    assert(syncARes.status === 200 && syncAData.success, 'Progress synced for Account A');
    assert(syncAData.badges.length === 3, 'Account A has 3 badges on server');
    assert(syncAData.insaneUnlocked === true, 'Account A has Insane mode unlocked on server');

    // 4. Fetch progress for Account B: MUST be empty (0 badges, 0 highScore, insaneUnlocked false)
    const fetchBRes = await fetch(`${baseUrl}/api/progress`, {
      method: 'GET',
      headers: { 'Cookie': cookieB }
    });
    const fetchBData = await fetchBRes.json();
    assert(fetchBRes.status === 200 && fetchBData.success, 'Progress retrieved for Account B');
    assert(fetchBData.badges.length === 0, 'Account B starts with 0 badges (Account A badges NOT leaked)');
    assert(fetchBData.highScore === 0, 'Account B starts with 0 high score (Account A score NOT leaked)');
    assert(fetchBData.insaneUnlocked === false, 'Account B starts with Insane locked (Account A progression NOT leaked)');

    // 5. Client Scoped Storage Keys Isolation Test
    const keyA_badges = getScopedStorageKey('mindrush_unlocked_badges', userA.id);
    const keyB_badges = getScopedStorageKey('mindrush_unlocked_badges', userB.id);
    assert(keyA_badges !== keyB_badges, 'Account A and Account B have distinct storage keys');
    assert(keyA_badges === `mindrush_unlocked_badges_${userA.id}`, 'Account A key is namespaced by user ID');
    assert(keyB_badges === `mindrush_unlocked_badges_${userB.id}`, 'Account B key is namespaced by user ID');

    // Set client context for Account A and unlock badges
    setBadgeUserContext(userA.id);
    setProgressionUserContext(userA.id);
    unlockBadge('silver_hexagon');
    unlockInsane();
    assert(getUnlockedBadges().includes('silver_hexagon'), 'Account A has silver_hexagon');
    assert(isInsaneUnlocked() === true, 'Account A has Insane unlocked');

    // Switch context to Account B
    setBadgeUserContext(userB.id);
    setProgressionUserContext(userB.id);
    assert(!getUnlockedBadges().includes('silver_hexagon'), 'Account B does NOT see Account A silver_hexagon badge');
    assert(isInsaneUnlocked() === false, 'Account B does NOT see Account A Insane unlock');

    // Account B unlocks ice_crystal
    unlockBadge('ice_crystal');
    assert(getUnlockedBadges().includes('ice_crystal'), 'Account B unlocked ice_crystal');
    assert(!getUnlockedBadges().includes('silver_hexagon'), 'Account B still has only its own badge');

    // Switch back to Account A
    setBadgeUserContext(userA.id);
    setProgressionUserContext(userA.id);
    assert(getUnlockedBadges().includes('silver_hexagon'), 'Account A still has silver_hexagon');
    assert(!getUnlockedBadges().includes('ice_crystal'), 'Account A does NOT have Account B ice_crystal');

    // 6. Security Test: Attempt client ID spoofing
    // Pilot B tries to overwrite Pilot A's progress by sending Pilot A's ID in body
    const spoofRes = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieB },
      body: JSON.stringify({
        userId: userA.id, // Spoofed!
        id: userA.id,     // Spoofed!
        badges: ['cheater_badge'],
        highScore: 999999,
        insaneUnlocked: true
      })
    });
    assert(spoofRes.status === 200, 'Sync responds to authenticated Pilot B');

    // Verify Pilot A was NOT modified by Pilot B's spoofed request
    const checkARes = await fetch(`${baseUrl}/api/progress`, {
      headers: { 'Cookie': cookieA }
    });
    const checkAData = await checkARes.json();
    assert(!checkAData.badges.includes('cheater_badge'), 'Security check: Pilot A was NOT altered by Pilot B spoofed user ID');
    assert(checkAData.highScore === 1250, 'Security check: Pilot A high score remained 1250, not spoofed 999999');

    // Verify unauthenticated calls to /api/progress/sync are rejected
    const unauthSyncRes = await fetch(`${baseUrl}/api/progress/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ badges: ['rogue'] })
    });
    assert(unauthSyncRes.status === 401, 'Unauthenticated /api/progress/sync is rejected (401)');

    // ========================================================
    // Task 3: Leaderboard Identity & Data
    // ========================================================
    console.log('\n--- Task 3: Leaderboard Identity & Data ---');

    // 1. Empty Leaderboard Check
    const emptyLbRes = await fetch(`${baseUrl}/api/leaderboard`);
    const emptyLbData = await emptyLbRes.json();
    assert(emptyLbRes.status === 200, 'GET /api/leaderboard returns 200 OK');
    assert(Array.isArray(emptyLbData.leaderboard), 'Leaderboard returns array');
    assert(emptyLbData.leaderboard.length === 0, 'Clean database returns empty leaderboard array (no fake records)');

    // Check dashboard.html handles empty leaderboard with empty state
    const dashHtml = fs.readFileSync(path.resolve('public/dashboard.html'), 'utf8');
    assert(!dashHtml.includes('CADET ALEX'), 'dashboard.html does NOT contain hardcoded CADET ALEX');
    assert(!dashHtml.includes('Nova_Rocket'), 'dashboard.html does NOT contain fake Nova_Rocket row');
    assert(!dashHtml.includes('CosmicMaya'), 'dashboard.html does NOT contain fake CosmicMaya row');
    assert(!dashHtml.includes('PixelLeo'), 'dashboard.html does NOT contain fake PixelLeo row');
    assert(dashHtml.includes('NO FLIGHT RECORDS YET'), 'dashboard.html contains proper empty state for new players');

    // 2. Submit real scores from Account A and Account B
    const scoreARes = await fetch(`${baseUrl}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
      body: JSON.stringify({ score: 650, difficulty: 'MEDIUM' })
    });
    assert(scoreARes.status === 201, 'Account A submitted score 650 on MEDIUM');

    const scoreBRes = await fetch(`${baseUrl}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieB },
      body: JSON.stringify({ score: 1420, difficulty: 'HARD' })
    });
    assert(scoreBRes.status === 201, 'Account B submitted score 1420 on HARD');

    // 2.1 Deduplication & Highest Valid Score Test: Account A submits a higher score on MEDIUM
    const scoreA2Res = await fetch(`${baseUrl}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
      body: JSON.stringify({ score: 920, difficulty: 'MEDIUM' })
    });
    assert(scoreA2Res.status === 201, 'Account A submitted improved score 920 on MEDIUM');

    // 3. Retrieve populated Leaderboard — One Best Score Per User Per Difficulty
    const populatedLbRes = await fetch(`${baseUrl}/api/leaderboard`);
    const populatedLbData = await populatedLbRes.json();
    assert(populatedLbData.leaderboard.length === 2, 'Leaderboard deduplicates multiple runs: exactly 2 entries (one best score per user per difficulty)');

    const topEntry = populatedLbData.leaderboard[0];
    const secondEntry = populatedLbData.leaderboard[1];

    assert(topEntry.score === 1420, 'Top score is 1420 (sorted highest first)');
    assert(topEntry.username === 'pilot_beta', 'Top entry username is "pilot_beta" (account username, not full name)');
    assert(topEntry.fullName === undefined, 'Leaderboard entry does NOT expose user full name');
    assert(topEntry.difficulty === 'HARD', 'Top entry difficulty is HARD');
    assert(topEntry.userId === userB.id, 'Top entry correctly associated with userB ID');

    assert(secondEntry.score === 920, 'Second entry reflects Account A best score 920 (previous 650 superseded)');
    assert(secondEntry.username === 'pilot_alpha', 'Second entry username is "pilot_alpha" (not full name)');
    assert(secondEntry.fullName === undefined, 'Leaderboard entry does NOT expose user full name');
    assert(secondEntry.difficulty === 'MEDIUM', 'Second entry difficulty is MEDIUM');
    assert(secondEntry.userId === userA.id, 'Second entry correctly associated with userA ID');

    // 3.1 Verify Continue & Next-Level Lifecycle Mechanics
    // Reaching milestone (750 in Medium) and clicking Continue ("Keep Playing") must NOT submit an intermediate score
    let scoreSubmittedOnContinue = false;
    const testContinueEngine = new GameEngine(getDifficultyConfig('medium'));
    testContinueEngine.state.addScore(755);
    // Trigger milestone modal
    testContinueEngine.ui.showNextLevelModal = () => {};
    testContinueEngine.ui.hideNextLevelModal = () => {};
    // Mock submitScoreToServer
    const originalSubmit = global.submitScoreToServer;
    testContinueEngine._saveFlightRecord = () => { scoreSubmittedOnContinue = true; };

    // Player selects Continue ("KEEP PLAYING")
    testContinueEngine.declineNextLevel();
    assert(scoreSubmittedOnContinue === false, 'Selecting Continue (Keep Playing) does NOT submit an intermediate score to leaderboard');
    assert(testContinueEngine.state.score === 755, 'Continue retains in-progress score (755 points)');
    assert(testContinueEngine.state.isPlaying(), 'Continue resumes active game run');

    // 4. Security: Score submission identity forgery attempt
    const forgeScoreRes = await fetch(`${baseUrl}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': cookieB },
      body: JSON.stringify({
        score: 5000,
        difficulty: 'INSANE',
        username: 'pilot_alpha', // Forged username in body!
        userId: userA.id        // Forged userId in body!
      })
    });
    const forgeData = await forgeScoreRes.json();
    assert(forgeScoreRes.status === 201, 'Score accepted for authenticated session');
    assert(forgeData.cadet === 'pilot_beta', 'Server attributed score to session owner "pilot_beta", ignoring forged username');

    // Check leaderboard after forgery attempt
    const verifyLbRes = await fetch(`${baseUrl}/api/leaderboard`);
    const verifyLbData = await verifyLbRes.json();
    const newTop = verifyLbData.leaderboard[0];
    assert(newTop.score === 5000, 'Score 5000 is top of leaderboard');
    assert(newTop.username === 'pilot_beta', 'Server strictly saved username as pilot_beta');
    assert(newTop.userId === userB.id, 'Server strictly saved userId as userB ID');

    // 5. Logout & Account Switching
    const logoutARes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': cookieA }
    });
    assert(logoutARes.status === 200, 'Pilot A logged out');

    // After logout, session is revoked
    const revokedRes = await fetch(`${baseUrl}/api/progress`, {
      headers: { 'Cookie': cookieA }
    });
    assert(revokedRes.status === 401, 'Revoked session cannot access progress');

  } finally {
    server.close();
  }

  // ========================================================
  // Task 4: Guest Mode & Backward Compatibility
  // ========================================================
  console.log('\n--- Task 4: Guest Mode & Backward Compatibility ---');

  clearActiveUser();
  clearBadgeUserContext();
  clearProgressionUserContext();

  const guestBadgeKey = getScopedStorageKey('mindrush_unlocked_badges');
  assert(guestBadgeKey === 'mindrush_unlocked_badges', 'Unauthenticated/Guest mode falls back to default base key');

  const guestScoreKey = getScopedStorageKey('mindrush_high_score');
  assert(guestScoreKey === 'mindrush_high_score', 'Unauthenticated/Guest mode high score uses base key');

  const guestInsaneKey = getScopedStorageKey('mindrush_insane_unlocked');
  assert(guestInsaneKey === 'mindrush_insane_unlocked', 'Unauthenticated/Guest mode progression uses base key');

  // Verify fresh guest starts with 0 badges and resets clean
  resetBadgeCollection();
  assert(getUnlockedBadges().length === 0, 'Guest mode resets badge collection cleanly');

  console.log('\n========================================================');
  console.log(`Results: ${passed} / ${total} assertions passed.`);
  if (passed === total) {
    console.log('ALL HUD, ACCOUNT ISOLATION & LEADERBOARD TESTS PASSED!');
  } else {
    console.error('SOME TESTS FAILED.');
    process.exitCode = 1;
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
