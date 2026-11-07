/**
 * MindRush — Authentication & Backend Test Suite
 * Tests:
 * 1. Argon2id Password Hashing & Verification
 * 2. Signup Form Validation & Phone Number Rejection
 * 3. User Model Integrity & Duplicate Username Enforcement
 * 4. Auth Endpoints: /api/auth/signup, /api/auth/login, /api/auth/logout, /api/auth/me
 * 5. Session Persistence, Cookie Headers & Protected Route Flow
 */

import { createApp } from '../server/app.js';
import { hashPassword, verifyPassword, validateUsername, validatePassword, validateSignupPayload } from '../server/utils/auth.js';
import { User, memoryUserStore } from '../server/models/User.js';

console.log('=== MindRush Authentication & Session Test Suite ===\n');

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
  // Clear any existing in-memory users for a fresh test environment
  memoryUserStore.clear();

  // ========================================================
  // Test Group 1: Argon2id Password Hashing & Verification
  // ========================================================
  console.log('\n--- Test Group 1: Argon2id Password Hashing & Verification ---');

  const rawPassword = 'CadetSecretPass123!';
  const hash = await hashPassword(rawPassword);

  assert(hash.startsWith('$argon2id$'), 'Argon2id hashing produces valid $argon2id$ algorithm string');
  assert(hash !== rawPassword, 'Plaintext password is never stored or returned directly');

  const matchCorrect = await verifyPassword(hash, rawPassword);
  assert(matchCorrect === true, 'Argon2id verify succeeds with correct password');

  const matchWrong = await verifyPassword(hash, 'WrongPassword999!');
  assert(matchWrong === false, 'Argon2id verify fails with incorrect password');

  const matchEmpty = await verifyPassword(hash, '');
  assert(matchEmpty === false, 'Argon2id verify fails with empty password');

  // ========================================================
  // Test Group 2: Signup Form Validation & Security Policy
  // ========================================================
  console.log('\n--- Test Group 2: Signup Form Validation & Strict Field Policy ---');

  // Valid payload
  const validPayload = {
    fullName: 'Alex Vance',
    username: 'Cadet_Alex99',
    dob: '2005-04-12',
    gender: 'male',
    password: 'Password123!',
    confirmPassword: 'Password123!',
    terms: true
  };
  const validRes = validateSignupPayload(validPayload);
  assert(validRes.valid === true, 'Valid signup payload passes validation with 0 errors');

  // Gender is required (Male or Female)
  const maleGenderPayload = { ...validPayload, gender: 'male' };
  assert(validateSignupPayload(maleGenderPayload).valid === true, 'Signup payload with male gender passes validation');

  const femaleGenderPayload = { ...validPayload, gender: 'female' };
  assert(validateSignupPayload(femaleGenderPayload).valid === true, 'Signup payload with female gender passes validation');

  const noGenderPayload = { ...validPayload, gender: undefined };
  const noGenderRes = validateSignupPayload(noGenderPayload);
  assert(noGenderRes.valid === false, 'Signup payload without gender fails validation (gender is required)');
  assert(noGenderRes.errors.some(e => e.includes('Gender is required')), 'Clear error message returned when gender is missing');

  const emptyGenderPayload = { ...validPayload, gender: '' };
  const emptyGenderRes = validateSignupPayload(emptyGenderPayload);
  assert(emptyGenderRes.valid === false, 'Signup payload with empty string gender fails validation');

  const invalidGenderPayload = { ...validPayload, gender: 'alien' };
  const invalidGenderRes = validateSignupPayload(invalidGenderPayload);
  assert(invalidGenderRes.valid === false, 'Signup payload with unsupported gender fails validation');

  const unspecifiedGenderPayload = { ...validPayload, gender: 'unspecified' };
  const unspecifiedGenderRes = validateSignupPayload(unspecifiedGenderPayload);
  assert(unspecifiedGenderRes.valid === false, 'Signup payload with "unspecified" gender fails validation');

  // Phone number strictly forbidden
  const phonePayload = { ...validPayload, phone: '+1234567890' };
  const phoneRes = validateSignupPayload(phonePayload);
  assert(phoneRes.valid === false, 'Payload with phone number is strictly rejected');
  assert(phoneRes.errors.some(e => e.includes('Phone numbers are not collected')), 'Useful error returned explaining phone numbers are not collected');

  const mobilePayload = { ...validPayload, countryCode: '+1' };
  const mobileRes = validateSignupPayload(mobilePayload);
  assert(mobileRes.valid === false, 'Payload with country code is strictly rejected');

  // Username validation (3-16 chars, letters/numbers/underscore)
  assert(validateUsername('al').valid === false, 'Username < 3 characters rejected');
  assert(validateUsername('a'.repeat(17)).valid === false, 'Username > 16 characters rejected');
  assert(validateUsername('cadet-alex').valid === false, 'Username with hyphen rejected (only letters, numbers, underscore allowed)');
  assert(validateUsername('cadet alex').valid === false, 'Username with space rejected');
  assert(validateUsername('cadet_alex_99').valid === true, 'Username with letters, numbers, underscore accepted');

  // Password length policy (>= 8 chars)
  assert(validatePassword('short').valid === false, 'Password < 8 characters rejected');
  assert(validatePassword('12345678').valid === true, 'Password >= 8 characters accepted');

  // Confirm password mismatch
  const mismatchPayload = { ...validPayload, confirmPassword: 'DifferentPassword!' };
  assert(validateSignupPayload(mismatchPayload).valid === false, 'Password confirmation mismatch rejected');

  // Terms not agreed
  const termsPayload = { ...validPayload, terms: false };
  assert(validateSignupPayload(termsPayload).valid === false, 'Unchecked terms and conditions rejected');

  // ========================================================
  // Test Group 3: User Model & Normalized Unique Username
  // ========================================================
  console.log('\n--- Test Group 3: User Model & Unique Username Enforcement ---');

  const createdUser = await User.create({
    fullName: 'Pilot Sarah',
    username: 'Pilot_Sarah',
    dob: new Date('2004-08-20'),
    gender: 'female',
    passwordHash: await hashPassword('FlightDeckPass789')
  });

  assert(createdUser.username === 'pilot_sarah', 'Username is normalized to lowercase');
  assert(createdUser.fullName === 'Pilot Sarah', 'Full name is preserved accurately');
  assert(createdUser.passwordHash === undefined, 'Password hash is strictly omitted from sanitized user object');

  // Duplicate username (even with different case) must be rejected
  let duplicateThrown = false;
  try {
    await User.create({
      fullName: 'Imposter Sarah',
      username: 'PILOT_SARAH', // same normalized username
      dob: new Date('2004-08-20'),
      gender: 'female',
      passwordHash: await hashPassword('AnotherPass123')
    });
  } catch (err) {
    duplicateThrown = true;
    assert(err.code === 11000 || err.message.includes('already exists'), 'Duplicate username triggers duplicate key error');
  }
  assert(duplicateThrown === true, 'Duplicate username attempt was blocked');

  // ========================================================
  // Test Group 4: Express Auth Endpoints Integration
  // ========================================================
  console.log('\n--- Test Group 4: Express Auth API Endpoints ---');

  const app = createApp();
  const server = app.listen(0); // dynamic port
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let cookieHeader = '';

  try {
    // 1. POST /api/auth/signup (Success)
    const signupPayload = {
      fullName: 'Commander Shepard',
      username: 'Shepard_N7',
      dob: '2000-01-01',
      gender: 'male',
      password: 'SpectrePassword2026!',
      confirmPassword: 'SpectrePassword2026!',
      terms: true
    };

    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
      body: JSON.stringify(signupPayload)
    });

    assert(signupRes.status === 201, 'POST /api/auth/signup returns status 201 Created');
    const signupData = await signupRes.json();
    assert(signupData.success === true, 'Signup response has success: true');
    assert(signupData.user.username === 'shepard_n7', 'Signup response contains normalized username');
    assert(signupData.user.passwordHash === undefined, 'Signup response never contains password hash');

    // Extract session cookie
    const setCookie = signupRes.headers.get('set-cookie');
    assert(setCookie && setCookie.includes('mindrush.sid='), 'Signup sets mindrush.sid session cookie');
    assert(setCookie && setCookie.includes('HttpOnly'), 'Session cookie includes HttpOnly flag');
    assert(setCookie && setCookie.includes('SameSite=Lax'), 'Session cookie includes SameSite=Lax flag');
    cookieHeader = setCookie.split(';')[0];

    // 1b. POST /api/auth/signup (Rejected when gender is missing or invalid)
    const badGenderRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
      body: JSON.stringify({ ...signupPayload, username: 'Shepard_NoGen', gender: '' })
    });
    assert(badGenderRes.status === 400, 'POST /api/auth/signup with empty gender returns status 400');
    const badGenderData = await badGenderRes.json();
    assert(badGenderData.error && badGenderData.error.includes('Gender'), 'API returns clear gender error when gender is omitted');

    // 2. POST /api/auth/signup (Duplicate Username Conflict)
    const dupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
      body: JSON.stringify(signupPayload)
    });
    assert(dupRes.status === 409, 'Duplicate signup attempt returns status 409 Conflict');
    const dupData = await dupRes.json();
    assert(dupData.error && dupData.error.includes('already'), 'Duplicate signup returns readable error message');

    // 3. GET /api/auth/me (Authenticated Session Check)
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Cookie': cookieHeader }
    });
    assert(meRes.status === 200, 'GET /api/auth/me with valid session cookie returns 200 OK');
    const meData = await meRes.json();
    assert(meData.authenticated === true, 'GET /api/auth/me confirms authenticated: true');
    assert(meData.user.fullName === 'Commander Shepard', 'GET /api/auth/me returns active cadet name');

    // 4. GET /api/auth/me (Unauthenticated)
    const unauthRes = await fetch(`${baseUrl}/api/auth/me`);
    assert(unauthRes.status === 401, 'GET /api/auth/me without session returns 401 Unauthorized');
    const unauthData = await unauthRes.json();
    assert(unauthData.authenticated === false, 'Unauthenticated response confirms authenticated: false');

    // 5. POST /api/auth/logout
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': cookieHeader }
    });
    assert(logoutRes.status === 200, 'POST /api/auth/logout returns 200 OK');
    const logoutData = await logoutRes.json();
    assert(logoutData.success === true, 'Logout confirms success: true');

    // 6. Verify Session is Invalidated after Logout
    const postLogoutMe = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Cookie': cookieHeader }
    });
    assert(postLogoutMe.status === 401, 'Subsequent /api/auth/me with old cookie is rejected (401)');

    // 7. POST /api/auth/login (Success)
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
      body: JSON.stringify({
        username: 'shepard_n7',
        password: 'SpectrePassword2026!'
      })
    });
    assert(loginRes.status === 200, 'POST /api/auth/login with valid credentials returns 200 OK');
    const loginData = await loginRes.json();
    assert(loginData.success === true, 'Login confirms success: true');
    assert(loginData.user.fullName === 'Commander Shepard', 'Login returns authenticated user');

    const newCookie = loginRes.headers.get('set-cookie');
    assert(newCookie && newCookie.includes('mindrush.sid='), 'Login issues new session cookie');

    // 8. POST /api/auth/login (Wrong Password)
    const badPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
      body: JSON.stringify({
        username: 'shepard_n7',
        password: 'WrongPassword999!'
      })
    });
    assert(badPassRes.status === 401, 'POST /api/auth/login with bad password returns 401 Unauthorized');
    const badPassData = await badPassRes.json();
    assert(badPassData.error.includes('Invalid username or security passcode'), 'Bad password returns generic security message');

    // 9. POST /api/auth/login (Non-existent user)
    const nonUserRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-suite': 'true' },
      body: JSON.stringify({
        username: 'ghost_pilot_00',
        password: 'SomePassword123!'
      })
    });
    assert(nonUserRes.status === 401, 'POST /api/auth/login with unknown user returns 401 Unauthorized');

  } finally {
    server.close();
  }

  console.log(`\n========================================================`);
  console.log(`Authentication Results: ${passed} / ${total} assertions passed.`);
  if (passed === total) {
    console.log(`ALL AUTHENTICATION TESTS PASSED!`);
  } else {
    console.error(`SOME TESTS FAILED.`);
    process.exitCode = 1;
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
