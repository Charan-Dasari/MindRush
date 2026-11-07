/**
 * MindRush — Real MongoDB Live Integration Test Suite
 * Tests actual end-to-end authentication against a live running MongoDB instance:
 * 1. Live Mongoose connection and unique index validation in MongoDB
 * 2. Real MongoStore session storage in MongoDB `sessions` collection
 * 3. Document insertion in MongoDB `users` collection with Argon2id hash
 * 4. Duplicate username rejection via MongoDB E11000 unique index
 * 5. Required gender handling (rejects missing, stores valid male/female)
 * 6. Live login, session cookie exchange, and logout
 * 7. MongoDB connection failure handling (503 Service Unavailable, no silent fallback)
 */

import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';
import { createApp } from '../server/app.js';
import { MongoUserModel } from '../server/models/User.js';

console.log('=== MindRush Real MongoDB Live Integration Test Suite ===\n');

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

const TEST_DB_URI = 'mongodb://127.0.0.1:27017/mindrush_live_test';

async function runRealMongoTests() {
  // Check if live MongoDB is reachable
  let canConnect = false;
  try {
    await mongoose.connect(TEST_DB_URI, { serverSelectionTimeoutMS: 2000 });
    canConnect = true;
  } catch (err) {
    console.warn('[NOTICE] Local MongoDB on 127.0.0.1:27017 is not available. Skipping real DB integration.');
    return;
  }

  console.log('[INFO] Connected to Live MongoDB instance at:', TEST_DB_URI);
  process.env.MONGODB_URI = TEST_DB_URI;

  try {
    // Clean up test collection before testing
    await MongoUserModel.deleteMany({});
    const db = mongoose.connection.db;
    try {
      await db.collection('sessions').deleteMany({});
    } catch (e) {}

    // Ensure unique index is built in MongoDB
    await MongoUserModel.init();

    // ========================================================
    // Group 1: MongoStore & Express App Initialization
    // ========================================================
    console.log('\n--- Group 1: Real MongoStore Session Store Initialization ---');

    const app = createApp();
    const server = app.listen(0);
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    let sessionCookie = '';

    try {
      // ========================================================
      // Group 2: Live Registration with Required Gender
      // ========================================================
      console.log('\n--- Group 2: Live Registration in MongoDB ---');

      // 1. Omitted gender fails live registration
      const omittedGenderData = {
        fullName: 'Major Tom',
        username: 'GroundControl_01',
        dob: '1990-05-15',
        password: 'OrbitalPassword2026!',
        confirmPassword: 'OrbitalPassword2026!',
        terms: true
      };
      const resOmitted = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
        body: JSON.stringify(omittedGenderData)
      });
      assert(resOmitted.status === 400, 'Live signup without gender fails with status 400 Bad Request');
      const omittedJson = await resOmitted.json();
      assert(omittedJson.error && omittedJson.error.includes('Gender'), 'Live signup error clearly indicates gender is required');

      // 2. Valid gender ('male') succeeds
      const signupData = {
        ...omittedGenderData,
        gender: 'male'
      };

      const resSignup = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
        body: JSON.stringify(signupData)
      });

      assert(resSignup.status === 201, 'Live signup returns status 201 Created');
      const signupJson = await resSignup.json();
      assert(signupJson.success === true, 'Live signup response confirms success');
      assert(signupJson.user.username === 'groundcontrol_01', 'Username is stored as normalized lowercase');
      assert(signupJson.user.gender === 'male', 'Cadet gender is preserved as "male"');
      assert(signupJson.user.passwordHash === undefined, 'Password hash is strictly omitted from API response');

      // Verify the document ACTUALLY exists in MongoDB!
      const userDoc = await MongoUserModel.findOne({ username: 'groundcontrol_01' }).select('+passwordHash');
      assert(userDoc !== null, 'User document is actually found in MongoDB users collection');
      assert(userDoc.passwordHash.startsWith('$argon2id$'), 'User password hash in MongoDB is a valid Argon2id hash');
      assert(userDoc.fullName === 'Major Tom', 'User fullName in MongoDB is preserved correctly');

      // Verify session cookie was set
      const rawCookie = resSignup.headers.get('set-cookie');
      assert(rawCookie && rawCookie.includes('mindrush.sid='), 'Signup sets mindrush.sid cookie');
      sessionCookie = rawCookie.split(';')[0];

      // Give MongoStore a short moment to write the session document to MongoDB
      await new Promise(r => setTimeout(r, 400));

      // Verify session document in MongoDB `sessions` collection
      const sessionDoc = await db.collection('sessions').findOne({});
      assert(sessionDoc !== null, 'Session document is actually stored in MongoDB sessions collection');
      assert(JSON.stringify(sessionDoc).includes('groundcontrol_01'), 'MongoDB session contains authenticated cadet username');

      // ========================================================
      // Group 3: Real MongoDB Duplicate Username Rejection
      // ========================================================
      console.log('\n--- Group 3: Real MongoDB Duplicate Username Rejection ---');

      const dupSignup = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
        body: JSON.stringify({
          ...signupData,
          username: 'GROUNDCONTROL_01' // Same username with different casing
        })
      });

      assert(dupSignup.status === 409, 'Duplicate username returns 409 Conflict from MongoDB');
      const dupJson = await dupSignup.json();
      assert(dupJson.error.includes('already'), 'Duplicate response returns readable error message');

      // ========================================================
      // Group 4: Live Session Verification & Logout
      // ========================================================
      console.log('\n--- Group 4: Live Session Verification & Logout ---');

      const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { 'Cookie': sessionCookie }
      });
      assert(meRes.status === 200, 'GET /api/auth/me returns 200 with MongoDB session');
      const meJson = await meRes.json();
      assert(meJson.authenticated === true, 'Active session confirms authenticated: true');
      assert(meJson.user.username === 'groundcontrol_01', 'Session returns cadet from MongoDB');

      // Logout
      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Cookie': sessionCookie }
      });
      assert(logoutRes.status === 200, 'POST /api/auth/logout returns 200 OK');

      // Verify subsequent session is revoked
      const postLogoutMe = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { 'Cookie': sessionCookie }
      });
      assert(postLogoutMe.status === 401, 'Subsequent session check is unauthorized (401)');

      // Live Login
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
        body: JSON.stringify({
          username: 'groundcontrol_01',
          password: 'OrbitalPassword2026!'
        })
      });
      assert(loginRes.status === 200, 'POST /api/auth/login succeeds against MongoDB');

    } finally {
      server.close();
    }

    // ========================================================
    // Group 5: MongoDB Connection Failure Handling (No Silent Fallback)
    // ========================================================
    console.log('\n--- Group 5: MongoDB Connection Failure Error Handling ---');

    // Disconnect Mongoose to simulate DB failure while MONGODB_URI is configured
    await mongoose.disconnect();

    const disconnectedApp = createApp();
    const discServer = disconnectedApp.listen(0);
    const discPort = discServer.address().port;

    try {
      const failRes = await fetch(`http://127.0.0.1:${discPort}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
        body: JSON.stringify({
          fullName: 'Lost Cadet',
          username: 'Lost_Cadet',
          dob: '1995-01-01',
          gender: 'male',
          password: 'LostPassword123!',
          confirmPassword: 'LostPassword123!',
          terms: true
        })
      });

      assert(failRes.status === 503, 'Database failure returns status 503 Service Unavailable');
      const failJson = await failRes.json();
      assert(failJson.error && failJson.error.includes('unavailable'), 'Understandable error message returned: database unavailable');
      assert(failJson.success === false, 'Application NEVER pretends registration succeeded when MongoDB is down');
    } finally {
      discServer.close();
    }

  } finally {
    // Clean up
    delete process.env.MONGODB_URI;
    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }

  console.log(`\n========================================================`);
  console.log(`Real MongoDB Live Integration: ${passed} / ${total} assertions passed.`);
  if (passed === total) {
    console.log(`ALL REAL MONGODB LIVE INTEGRATION TESTS PASSED!`);
    process.exit(0);
  } else {
    console.error(`SOME TESTS FAILED.`);
    process.exit(1);
  }
}

runRealMongoTests().catch(err => {
  console.error('Real MongoDB Test execution error:', err);
  process.exit(1);
});
