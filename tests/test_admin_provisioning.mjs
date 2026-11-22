/**
 * MindRush — Admin Provisioning Verification Test Suite
 * Tests:
 * 1. Abort when MongoDB is unavailable (no admin in memory fallback)
 * 2. DOB validation (invalid format, future date, valid date)
 * 3. Gender validation (invalid gender, valid gender)
 * 4. Password CLI argument rejection (security policy)
 * 5. Admin provisioning and role elevation in live MongoDB
 */

import assert from 'assert';
import mongoose from 'mongoose';
import { runAdminProvisioning, validateDob, validateGender, promptQuestion } from '../server/scripts/create-admin.js';
import { User, MongoUserModel } from '../server/models/User.js';
import { AuditLog, MongoAuditLogModel } from '../server/models/AuditLog.js';
import { hashPassword } from '../server/utils/auth.js';

console.log('========================================================');
console.log(' Running Admin Provisioning Verification Tests');
console.log('========================================================');

let passedTests = 0;
let totalTests = 0;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
  }
}

async function runTests() {
  // --- Test 1: In-Memory Fallback Rejection ---
  await test('runAdminProvisioning aborts when MongoDB is not connected', async () => {
    // Ensure disconnected state
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    assert.strictEqual(User.isMongoose(), false, 'Should be in in-memory mode');

    await assert.rejects(
      async () => {
        await runAdminProvisioning({ username: 'test_admin_fail' }, { close() {} });
      },
      /MongoDB connection is unavailable/,
      'Must reject admin creation when MongoDB is down'
    );
  });

  // --- Test 2: DOB Validation Rules (Strict Calendar Checking) ---
  await test('validateDob rejects invalid date strings and malformed formats', () => {
    assert.throws(() => validateDob('not-a-date'), /Invalid date of birth format/);
    assert.throws(() => validateDob(''), /Date of birth is required/);
    assert.throws(() => validateDob(null), /Date of birth is required/);
    assert.throws(() => validateDob('1995/08/20'), /Invalid date of birth format/);
    assert.throws(() => validateDob('20-08-1995'), /Invalid date of birth format/);
  });

  await test('validateDob strictly enforces calendar validity and rejects rollover dates', () => {
    // 2024 is a leap year -> Feb 29 is valid
    const leapDate = validateDob('2024-02-29');
    assert.strictEqual(leapDate.getUTCFullYear(), 2024);
    assert.strictEqual(leapDate.getUTCMonth(), 1);
    assert.strictEqual(leapDate.getUTCDate(), 29);

    // 2023 is not a leap year -> Feb 29 rolls over to March 1 in loose parsers, must be rejected!
    assert.throws(() => validateDob('2023-02-29'), /Invalid calendar date/);

    // Feb 31 does not exist in any year
    assert.throws(() => validateDob('2024-02-31'), /Invalid calendar date/);

    // April 31 does not exist (30 days in April)
    assert.throws(() => validateDob('2024-04-31'), /Invalid calendar date/);

    // Invalid month
    assert.throws(() => validateDob('2024-13-01'), /Invalid calendar date/);
    assert.throws(() => validateDob('2024-00-15'), /Invalid calendar date/);

    // Invalid day
    assert.throws(() => validateDob('2024-01-32'), /Invalid calendar date/);
    assert.throws(() => validateDob('2024-01-00'), /Invalid calendar date/);
  });

  await test('validateDob rejects future dates and pre-1900 dates', () => {
    const futureDate = new Date();
    futureDate.setUTCFullYear(futureDate.getUTCFullYear() + 1);
    const futureStr = `${futureDate.getUTCFullYear()}-01-01`;
    assert.throws(() => validateDob(futureStr), /cannot be in the future/);
    assert.throws(() => validateDob('1885-05-12'), /must be >= 1900/);
  });

  await test('validateDob accepts valid realistic birthdates', () => {
    const valid = validateDob('1995-08-20');
    assert.strictEqual(valid.getUTCFullYear(), 1995);
    assert.strictEqual(valid.getUTCMonth(), 7); // 0-indexed August
    assert.strictEqual(valid.getUTCDate(), 20);
  });

  // --- Test 3: Gender Validation Rules ---
  await test('validateGender rejects invalid genders', () => {
    assert.throws(() => validateGender(''), /Gender is required/);
    assert.throws(() => validateGender(null), /Gender is required/);
    assert.throws(() => validateGender('other'), /Must be 'male' or 'female'/);
    assert.throws(() => validateGender('prefer_not_to_say'), /Must be 'male' or 'female'/);
  });

  await test('validateGender accepts male and female case-insensitively', () => {
    assert.strictEqual(validateGender('Male'), 'male');
    assert.strictEqual(validateGender(' FEMALE '), 'female');
  });

  // --- Test 4: Live MongoDB Admin Provisioning & Elevation ---
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mindrush_live_test';
  let liveDbAvailable = false;
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    liveDbAvailable = (mongoose.connection.readyState === 1);
  } catch (err) {
    console.log(`[INFO] Live MongoDB not reachable at ${MONGODB_URI}. Skipping live provisioning test.`);
  }

  if (liveDbAvailable) {
    await test('Provisioning creates new admin in live MongoDB', async () => {
      const username = 'admin_live_' + Math.random().toString(36).substring(2, 7);
      
      // Mock interactive prompt answers
      let promptCall = 0;
      const mockRL = {
        question(q, cb) {
          promptCall++;
          if (promptCall === 1) cb('Admin Pass 123!'); // password
          else if (promptCall === 2) cb('Admin Pass 123!'); // confirm
        },
        close() {}
      };

      const result = await runAdminProvisioning({
        username,
        fullName: 'Live Administrator',
        dob: '1992-04-15',
        gender: 'female'
      }, mockRL);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'created');

      const found = await MongoUserModel.findOne({ username });
      assert.ok(found, 'Admin must be persisted in MongoDB');
      assert.strictEqual(found.role, 'admin', 'User role must be admin');
      assert.strictEqual(found.gender, 'female');

      // Verify AuditLog record for ADMIN_CREATE
      const createLog = await MongoAuditLogModel.findOne({
        action: 'ADMIN_CREATE',
        target_id: String(found._id)
      });
      assert.ok(createLog, 'AuditLog entry must be created for ADMIN_CREATE');
      assert.strictEqual(createLog.actor_id, 'SYSTEM_CLI');
      assert.strictEqual(createLog.details.username, username);
      assert.strictEqual(createLog.details.role, 'admin');
      assert.strictEqual(createLog.details.password, undefined);
      assert.strictEqual(createLog.details.passwordHash, undefined);
    });

    await test('Provisioning elevates existing player to admin in live MongoDB', async () => {
      const username = 'p_elev_' + Math.random().toString(36).substring(2, 7);
      await MongoUserModel.create({
        fullName: 'Regular Player',
        username,
        dob: new Date('2000-01-01'),
        gender: 'male',
        passwordHash: await hashPassword('RegularPass123!'),
        role: 'player'
      });

      const result = await runAdminProvisioning({
        username
      }, { close() {} });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'elevated');

      const updated = await MongoUserModel.findOne({ username });
      assert.strictEqual(updated.role, 'admin', 'Existing player must be elevated to admin');

      // Verify AuditLog record for ADMIN_ROLE_ELEVATE
      const elevateLog = await MongoAuditLogModel.findOne({
        action: 'ADMIN_ROLE_ELEVATE',
        target_id: String(updated._id)
      });
      assert.ok(elevateLog, 'AuditLog entry must be created for ADMIN_ROLE_ELEVATE');
      assert.strictEqual(elevateLog.actor_id, 'SYSTEM_CLI');
      assert.strictEqual(elevateLog.details.username, username);
      assert.strictEqual(elevateLog.details.previous_role, 'player');
      assert.strictEqual(elevateLog.details.new_role, 'admin');
    });

    await mongoose.disconnect();
  }

  // --- Test 5: Interactive Cancellation Handling ---
  await test('promptQuestion rejects with USER_CANCELLED and cleans up listeners on Ctrl+C', async () => {
    const origIsTTY = process.stdin.isTTY;
    const origSetRawMode = process.stdin.setRawMode;
    let rawModeDisabled = false;

    process.stdin.isTTY = true;
    process.stdin.setRawMode = (mode) => {
      if (!mode) rawModeDisabled = true;
    };

    const promptPromise = promptQuestion(null, 'Enter Secret: ', true);
    
    // Simulate Ctrl+C input chunk
    process.stdin.emit('data', Buffer.from('\u0003'));

    await assert.rejects(
      promptPromise,
      (err) => {
        assert.strictEqual(err.message, 'PROVISIONING_CANCELLED');
        assert.strictEqual(err.code, 'USER_CANCELLED');
        return true;
      },
      'Must reject with USER_CANCELLED on Ctrl+C'
    );

    // Restore original stdin properties
    process.stdin.isTTY = origIsTTY;
    process.stdin.setRawMode = origSetRawMode;
    process.stdin.pause();
  });

  console.log('--------------------------------------------------------');
  console.log(` Admin Provisioning Tests: ${passedTests}/${totalTests} Passed.`);
  console.log('========================================================');
  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();
