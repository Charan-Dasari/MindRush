/**
 * MindRush — Real MongoDB Atlas Live Integration Test Suite
 * Verifies live connection to MongoDB Atlas, MongoStore initialization with 'MindRush' database,
 * session lifecycle, score submission, duplicate suppression, account isolation, and leaderboard hygiene.
 */

import dotenv from 'dotenv';
dotenv.config();

import assert from 'assert';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../server/db.js';
import { createApp } from '../server/app.js';
import { User } from '../server/models/User.js';
import { Score } from '../server/models/Score.js';

console.log('=== MindRush Real MongoDB Atlas Live Integration Test Suite ===\n');

async function runAtlasTests() {
  const uri = process.env.MONGODB_URI;
  assert(uri, 'MONGODB_URI must be present in .env for Atlas verification');

  console.log('[Test 1] Connecting to MongoDB Atlas cluster...');
  const connected = await connectDB(uri);
  assert.strictEqual(connected, true, 'connectDB must return true');
  assert.strictEqual(mongoose.connection.name, 'MindRush', 'Database name must be "MindRush"');
  console.log('[PASS] Connected to MongoDB Atlas. Active database:', mongoose.connection.name);

  console.log('\n[Test 2] Starting Express Application & Session Store...');
  const app = createApp();
  const server = await new Promise((resolve) => {
    const s = app.listen(3099, () => resolve(s));
  });
  console.log('[PASS] Express server running on port 3099 with MongoStore active.');

  const baseUrl = 'http://localhost:3099';
  let sessionCookie = '';
  const testUsername = `c_${Date.now().toString().slice(-8)}`;

  try {
    // 1. Health check
    console.log('\n[Test 3] Health Check');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(healthRes.status, 200, 'Health endpoint must return 200');
    console.log('[PASS] /api/health returned 200 OK');

    // 2. Verify legacy test entries are completely gone from the Leaderboard
    console.log('\n[Test 4] Leaderboard Hygiene — Verify Legacy Test Entries Are Gone');
    const cleanLbRes = await fetch(`${baseUrl}/api/leaderboard`);
    assert.strictEqual(cleanLbRes.status, 200);
    const cleanLbData = await cleanLbRes.json();
    const usernamesInLb = cleanLbData.leaderboard.map(e => e.username);
    assert(!usernamesInLb.includes('c_87103516'), 'c_87103516 must NOT be in leaderboard');
    assert(!usernamesInLb.includes('c_87195662'), 'c_87195662 must NOT be in leaderboard');
    assert(!usernamesInLb.includes('cadet'), '"cadet" must NOT be in leaderboard');
    console.log('[PASS] All three legacy test entries (c_87103516, c_87195662, cadet) are confirmed absent.');
    console.log('Current legitimate entries:', usernamesInLb);

    // 3. Signup test cadet
    console.log('\n[Test 5] Atlas Signup');
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Atlas Test Cadet',
        username: testUsername,
        dob: '2000-01-01',
        gender: 'female',
        password: 'ValidPassword123',
        confirmPassword: 'ValidPassword123',
        terms: true
      })
    });
    const signupData = await signupRes.json();
    assert.strictEqual(signupRes.status, 201, 'Signup must return 201 Created');
    assert.strictEqual(signupData.success, true);
    assert.strictEqual(signupData.user.username, testUsername);

    const setCookie = signupRes.headers.get('set-cookie');
    assert(setCookie && setCookie.includes('mindrush.sid='), 'Signup must issue mindrush.sid cookie');
    sessionCookie = setCookie.split(';')[0];
    console.log('[PASS] Live signup succeeded on Atlas. Session cookie received.');

    // 4. Verify in MongoDB Atlas collections
    console.log('\n[Test 6] Direct Atlas Collection Inspection');
    const userDoc = await User.findByUsername(testUsername);
    assert(userDoc, 'User document must exist in MindRush.users collection');
    assert.strictEqual(userDoc.username, testUsername);

    const sessionCount = await mongoose.connection.db.collection('sessions').countDocuments();
    assert(sessionCount > 0, 'MindRush.sessions collection must contain session records');
    console.log(`[PASS] Verified User in MindRush.users and active sessions in MindRush.sessions (${sessionCount} records).`);

    // 5. Session Persistence & Profile Data (GET /api/auth/me)
    console.log('\n[Test 7] Session Authentication & Atlas Profile Check (/api/auth/me)');
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: sessionCookie }
    });
    assert.strictEqual(meRes.status, 200, '/api/auth/me must return 200');
    const meData = await meRes.json();
    assert.strictEqual(meData.authenticated, true);
    assert.strictEqual(meData.user.username, testUsername);
    assert(Array.isArray(meData.user.badges), 'Profile must include badges array');
    assert(typeof meData.user.highScore === 'number', 'Profile must include highScore');
    assert(typeof meData.user.insaneUnlocked === 'boolean', 'Profile must include insaneUnlocked');
    console.log('[PASS] Authenticated profile verified from Atlas with badges, highScore, and progression.');

    // 6. Submit Score to Atlas
    console.log('\n[Test 8] Submit Score to Atlas (/api/scores)');
    const scoreRes = await fetch(`${baseUrl}/api/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie
      },
      body: JSON.stringify({
        score: 550,
        difficulty: 'medium'
      })
    });
    assert.strictEqual(scoreRes.status, 201, 'Score submission must return 201 Created');
    console.log('[PASS] Score 550 saved to MindRush.scores on Atlas.');

    // 7. Duplicate Submission Prevention
    console.log('\n[Test 9] Duplicate Score Submission Prevention');
    const dupRes = await fetch(`${baseUrl}/api/scores`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie
      },
      body: JSON.stringify({
        score: 550,
        difficulty: 'medium'
      })
    });
    assert.strictEqual(dupRes.status, 200, 'Duplicate submission within window must return 200');
    const dupData = await dupRes.json();
    assert.strictEqual(dupData.duplicateSuppressed, true, 'Duplicate submission must be suppressed');
    console.log('[PASS] Duplicate score submission correctly detected and suppressed.');

    // 8. Leaderboard Verification
    console.log('\n[Test 10] Fetch Leaderboard (/api/leaderboard)');
    const lbRes = await fetch(`${baseUrl}/api/leaderboard?difficulty=medium`);
    assert.strictEqual(lbRes.status, 200, 'Leaderboard must return 200');
    const lbData = await lbRes.json();
    assert(Array.isArray(lbData.leaderboard), 'Leaderboard must return array');
    const myEntry = lbData.leaderboard.find(e => e.username === testUsername);
    assert(myEntry, 'Leaderboard must contain submitted test cadet');
    assert.strictEqual(myEntry.score, 550, 'Leaderboard score must match 550');
    assert(!myEntry.fullName, 'Leaderboard must NEVER expose fullName');
    console.log('[PASS] Leaderboard reflects deduplicated Atlas score with authentic username.');

    // 9. Account Isolation: Unauthenticated cannot access /api/progress
    console.log('\n[Test 11] Account Isolation Verification');
    const unauthProgress = await fetch(`${baseUrl}/api/progress`);
    assert.strictEqual(unauthProgress.status, 401, 'Unauthenticated progress access must return 401');
    console.log('[PASS] Unauthenticated access strictly rejected (401).');

    // 10. Logout
    console.log('\n[Test 12] Logout (/api/auth/logout)');
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: sessionCookie }
    });
    assert.strictEqual(logoutRes.status, 200, 'Logout must return 200');

    const meAfterLogout = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: sessionCookie }
    });
    assert.strictEqual(meAfterLogout.status, 401, 'Session after logout must be 401 Unauthorized');
    console.log('[PASS] Logout successfully invalidated session on Atlas.');

    console.log('\n========================================================');
    console.log('ALL ATLAS LIVE INTEGRATION TESTS PASSED CLEANLY (100%)');
    console.log('========================================================\n');
  } finally {
    // Guaranteed cleanup in Atlas
    if (mongoose.connection && mongoose.connection.readyState === 1 && testUsername) {
      try {
        await mongoose.connection.db.collection('users').deleteOne({ username: testUsername });
        await mongoose.connection.db.collection('scores').deleteMany({ username: testUsername });
        console.log('[Cleanup] Safely removed test account and scores from Atlas.');
      } catch (cleanErr) {
        console.error('[Cleanup Error]', cleanErr.message);
      }
    }
    server.close();
    await disconnectDB();
    process.exit(0);
  }
}

runAtlasTests().catch((err) => {
  console.error('\n❌ Atlas Integration Test Failed:', err);
  process.exit(1);
});
