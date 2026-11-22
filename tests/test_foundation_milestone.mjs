/**
 * MindRush — Foundation Milestone Verification Test Suite (T003–T012)
 * Tests models, admin security, counter atomicity, and curriculum seed.
 */

import assert from 'assert';
import { User } from '../server/models/User.js';
import { Curriculum } from '../server/models/Curriculum.js';
import { Counter } from '../server/models/Counter.js';
import { AuditLog, MongoAuditLogModel } from '../server/models/AuditLog.js';
import { requireAdmin } from '../server/middleware/requireAdmin.js';
import { hashPassword } from '../server/utils/auth.js';

console.log('========================================================');
console.log(' Running Foundation Milestone Test Suite (T003–T012)');
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
  // --- Test 1: User Role Field & Defaults (T005) ---
  await test('User model defaults to role: player', async () => {
    const user = await User.create({
      fullName: 'Test Player',
      username: 'cadet_player_' + Math.random().toString(36).substring(2, 7),
      dob: new Date('2000-01-01'),
      gender: 'male',
      passwordHash: await hashPassword('Password123!')
    });
    assert.strictEqual(user.role, 'player', 'User role should default to player');
  });

  await test('User model supports role: admin', async () => {
    const admin = await User.create({
      fullName: 'Test Admin',
      username: 'admin_' + Math.random().toString(36).substring(2, 7),
      dob: new Date('1990-01-01'),
      gender: 'female',
      passwordHash: await hashPassword('AdminPass123!'),
      role: 'admin'
    });
    assert.strictEqual(admin.role, 'admin', 'User role should be admin');
  });

  // --- Test 2: Curriculum Model Hierarchy (T006) ---
  await test('Curriculum model stores and retrieves syllabus tree', async () => {
    const testId = 'test-curriculum-' + Math.random().toString(36).substring(2, 7);
    await Curriculum.create({
      curriculum_id: testId,
      name: 'Test Board Math',
      board: 'TEST_BOARD',
      country: 'India',
      standards: [
        {
          standard: 1,
          subjects: [
            {
              subject_id: 'math',
              name: 'Mathematics',
              topics: [
                {
                  topic_id: 'addition',
                  name: 'Addition',
                  difficulty_definitions: { easy: 'e', medium: 'm', hard: 'h' }
                }
              ]
            }
          ]
        }
      ]
    });

    const fetched = await Curriculum.findOne({ curriculum_id: testId });
    assert.ok(fetched, 'Curriculum must be found');
    assert.strictEqual(fetched.name, 'Test Board Math');
    assert.strictEqual(fetched.standards[0].subjects[0].topics[0].topic_id, 'addition');
  });

  // --- Test 3: Atomic Counter Sequential Allocation (T007) ---
  await test('Counter increments sequentially starting from 1000', async () => {
    const counterKey = 'test_seq_' + Math.random().toString(36).substring(2, 7);
    await Counter.initSequence(counterKey, 1000);
    const seq1 = await Counter.getNextSequence(counterKey);
    const seq2 = await Counter.getNextSequence(counterKey);
    const seq3 = await Counter.getNextSequence(counterKey);

    assert.strictEqual(seq1, 1001, 'First sequence must be 1001');
    assert.strictEqual(seq2, 1002, 'Second sequence must be 1002');
    assert.strictEqual(seq3, 1003, 'Third sequence must be 1003');
  });

  // --- Test 4: AuditLog Recording & Retrieval (T008) ---
  await test('AuditLog records administrative actions', async () => {
    const dummyActorId = 'usr_' + Math.random().toString(36).substring(2, 7);
    const logEntry = await AuditLog.log({
      actor_id: dummyActorId,
      action: 'QUESTION_APPROVE',
      target_collection: 'generated_questions',
      target_id: 'q_test_123',
      details: { decision: 'approved', reviewer: 'sysadmin' },
      ip_address: '127.0.0.1'
    });

    assert.ok(logEntry._id, 'Log entry must have an ID');
    assert.strictEqual(logEntry.action, 'QUESTION_APPROVE');
    assert.strictEqual(logEntry.target_id, 'q_test_123');

    const logs = await AuditLog.find({ action: 'QUESTION_APPROVE' });
    assert.ok(logs.length > 0, 'Should find logged action');
  });

  await test('AuditLog enforces append-only semantics and blocks mutating queries and bulkWrite', async () => {
    // Memory store update / delete block
    await assert.rejects(
      async () => {
        await AuditLog._getMemoryStore().update();
      },
      /append-only/,
      'Memory store update must be blocked'
    );

    await assert.rejects(
      async () => {
        await AuditLog._getMemoryStore().delete();
      },
      /append-only/,
      'Memory store delete must be blocked'
    );

    // MongoAuditLogModel bulkWrite override block
    await assert.rejects(
      async () => {
        await MongoAuditLogModel.bulkWrite([
          { updateOne: { filter: { _id: '123' }, update: { action: 'MUTATED' } } }
        ]);
      },
      /append-only.*bulkWrite/,
      'bulkWrite updateOne must be blocked'
    );

    await assert.rejects(
      async () => {
        await MongoAuditLogModel.bulkWrite([
          { deleteOne: { filter: { _id: '123' } } }
        ]);
      },
      /append-only.*bulkWrite/,
      'bulkWrite deleteOne must be blocked'
    );

    await assert.rejects(
      async () => {
        await MongoAuditLogModel.bulkWrite([
          { replaceOne: { filter: { _id: '123' }, replacement: {} } }
        ]);
      },
      /append-only.*bulkWrite/,
      'bulkWrite replaceOne must be blocked'
    );
  });

  // --- Test 5: requireAdmin Middleware Authentication (T010) ---
  await test('requireAdmin rejects unauthenticated requests with 401', async () => {
    const req = { session: {}, headers: {}, method: 'GET' };
    let status = null;
    let json = null;
    const res = {
      status(s) { status = s; return this; },
      json(j) { json = j; }
    };

    await requireAdmin(req, res, () => {});
    assert.strictEqual(status, 401);
    assert.strictEqual(json.error, 'AUTHENTICATION_REQUIRED');
  });

  await test('requireAdmin rejects non-admin users with 403', async () => {
    const player = await User.create({
      fullName: 'Player Only',
      username: 'player_' + Math.random().toString(36).substring(2, 7),
      dob: new Date('2001-01-01'),
      gender: 'male',
      passwordHash: await hashPassword('Pass123!')
    });

    const req = {
      session: { userId: player._id || player.id },
      headers: {},
      method: 'GET'
    };
    let status = null;
    let json = null;
    const res = {
      status(s) { status = s; return this; },
      json(j) { json = j; }
    };

    await requireAdmin(req, res, () => {});
    assert.strictEqual(status, 403);
    assert.strictEqual(json.error, 'ADMIN_REQUIRED');
  });

  await test('requireAdmin rejects untrusted Origin on state-changing requests', async () => {
    const admin = await User.create({
      fullName: 'Admin User',
      username: 'admin_' + Math.random().toString(36).substring(2, 7),
      dob: new Date('1990-01-01'),
      gender: 'male',
      passwordHash: await hashPassword('AdminPass123!'),
      role: 'admin'
    });

    const req = {
      session: { userId: admin._id || admin.id },
      headers: {
        origin: 'http://malicious-site.com',
        'x-requested-with': 'MindRush-Admin'
      },
      method: 'POST'
    };
    let status = null;
    let json = null;
    const res = {
      status(s) { status = s; return this; },
      json(j) { json = j; }
    };

    await requireAdmin(req, res, () => {});
    assert.strictEqual(status, 403);
    assert.strictEqual(json.error, 'ORIGIN_FORBIDDEN');
  });

  await test('requireAdmin rejects missing CSRF header on state-changing requests', async () => {
    const admin = await User.create({
      fullName: 'Admin User 2',
      username: 'admin2_' + Math.random().toString(36).substring(2, 7),
      dob: new Date('1990-01-01'),
      gender: 'female',
      passwordHash: await hashPassword('AdminPass123!'),
      role: 'admin'
    });

    const req = {
      session: { userId: admin._id || admin.id },
      headers: {
        origin: 'http://localhost:3000'
      },
      method: 'POST'
    };
    let status = null;
    let json = null;
    const res = {
      status(s) { status = s; return this; },
      json(j) { json = j; }
    };

    await requireAdmin(req, res, () => {});
    assert.strictEqual(status, 403);
    assert.strictEqual(json.error, 'CSRF_HEADER_REQUIRED');
  });

  await test('requireAdmin permits admin with valid session and CSRF header', async () => {
    const admin = await User.create({
      fullName: 'Admin User 3',
      username: 'admin3_' + Math.random().toString(36).substring(2, 7),
      dob: new Date('1990-01-01'),
      gender: 'female',
      passwordHash: await hashPassword('AdminPass123!'),
      role: 'admin'
    });

    const req = {
      session: { userId: admin._id || admin.id },
      headers: {
        origin: 'http://localhost:3000',
        'x-requested-with': 'MindRush-Admin'
      },
      method: 'POST'
    };
    let nextCalled = false;
    const res = {
      status() { return this; },
      json() {}
    };

    await requireAdmin(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true, 'next() must be called');
    assert.strictEqual(req.adminUser.role, 'admin');
  });

  await test('requireAdmin permits missing Origin when valid CSRF header is present', async () => {
    const admin = await User.create({
      fullName: 'Admin User 4',
      username: 'admin4_' + Math.random().toString(36).substring(2, 7),
      dob: new Date('1990-01-01'),
      gender: 'male',
      passwordHash: await hashPassword('AdminPass123!'),
      role: 'admin'
    });

    const req = {
      session: { userId: admin._id || admin.id },
      headers: {
        'x-requested-with': 'MindRush-Admin'
      },
      method: 'POST'
    };
    let nextCalled = false;
    const res = {
      status() { return this; },
      json() {}
    };

    await requireAdmin(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true, 'Same-origin without Origin header should pass if CSRF header is valid');
  });

  await test('requireAdmin respects configured ADMIN_ALLOWED_ORIGINS deployment origins', async () => {
    process.env.ADMIN_ALLOWED_ORIGINS = 'https://admin.mindrush.org,https://portal.mindrush.internal';
    const admin = await User.create({
      fullName: 'Admin User 5',
      username: 'admin5_' + Math.random().toString(36).substring(2, 7),
      dob: new Date('1990-01-01'),
      gender: 'female',
      passwordHash: await hashPassword('AdminPass123!'),
      role: 'admin'
    });

    const req = {
      session: { userId: admin._id || admin.id },
      headers: {
        origin: 'https://admin.mindrush.org',
        'x-requested-with': 'MindRush-Admin'
      },
      method: 'POST'
    };
    let nextCalled = false;
    const res = {
      status() { return this; },
      json() {}
    };

    await requireAdmin(req, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true, 'Configured deployment origin must be allowed');
    delete process.env.ADMIN_ALLOWED_ORIGINS;
  });

  await test('requireAdmin supports wildcard origin patterns in ADMIN_ALLOWED_ORIGINS', async () => {
    process.env.ADMIN_ALLOWED_ORIGINS = 'https://*.mindrush.org';
    const admin = await User.create({
      fullName: 'Admin User Wildcard',
      username: 'admin_wc_' + Math.random().toString(36).substring(2, 7),
      dob: new Date('1990-01-01'),
      gender: 'male',
      passwordHash: await hashPassword('AdminPass123!'),
      role: 'admin'
    });

    // Subdomain matching wildcard
    const validReq = {
      session: { userId: admin._id || admin.id },
      headers: {
        origin: 'https://subdomain.mindrush.org',
        'x-requested-with': 'MindRush-Admin'
      },
      method: 'POST'
    };
    let nextCalled = false;
    const res = { status() { return this; }, json() {} };
    await requireAdmin(validReq, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true, 'Wildcard subdomain origin must be allowed');

    // Unmatched origin
    let status = null;
    let json = null;
    const rejectRes = {
      status(s) { status = s; return this; },
      json(j) { json = j; }
    };
    const invalidReq = {
      session: { userId: admin._id || admin.id },
      headers: {
        origin: 'https://subdomain.evilmindrush.org',
        'x-requested-with': 'MindRush-Admin'
      },
      method: 'POST'
    };
    await requireAdmin(invalidReq, rejectRes, () => {});
    assert.strictEqual(status, 403);
    assert.strictEqual(json.error, 'ORIGIN_FORBIDDEN');
    delete process.env.ADMIN_ALLOWED_ORIGINS;
  });

  await test('requireAdmin validates Referer header when Origin header is absent', async () => {
    const admin = await User.create({
      fullName: 'Admin User Referer',
      username: 'admin_ref_' + Math.random().toString(36).substring(2, 7),
      dob: new Date('1990-01-01'),
      gender: 'female',
      passwordHash: await hashPassword('AdminPass123!'),
      role: 'admin'
    });

    // 1. Trusted Referer
    const validRefReq = {
      session: { userId: admin._id || admin.id },
      headers: {
        referer: 'http://localhost:3000/admin/dashboard',
        'x-requested-with': 'MindRush-Admin'
      },
      method: 'POST'
    };
    let validNext = false;
    await requireAdmin(validRefReq, { status() { return this; }, json() {} }, () => { validNext = true; });
    assert.strictEqual(validNext, true, 'Trusted referer origin must be accepted');

    // 2. Untrusted Referer
    let refStatus = null;
    let refJson = null;
    const invalidRefReq = {
      session: { userId: admin._id || admin.id },
      headers: {
        referer: 'http://malicious.org/attack',
        'x-requested-with': 'MindRush-Admin'
      },
      method: 'POST'
    };
    await requireAdmin(invalidRefReq, {
      status(s) { refStatus = s; return this; },
      json(j) { refJson = j; }
    }, () => {});
    assert.strictEqual(refStatus, 403);
    assert.strictEqual(refJson.error, 'ORIGIN_FORBIDDEN');

    // 3. Malformed Referer
    let malStatus = null;
    let malJson = null;
    const malformedRefReq = {
      session: { userId: admin._id || admin.id },
      headers: {
        referer: 'not-a-valid-url',
        'x-requested-with': 'MindRush-Admin'
      },
      method: 'POST'
    };
    await requireAdmin(malformedRefReq, {
      status(s) { malStatus = s; return this; },
      json(j) { malJson = j; }
    }, () => {});
    assert.strictEqual(malStatus, 403);
    assert.strictEqual(malJson.error, 'ORIGIN_FORBIDDEN');
  });

  console.log('--------------------------------------------------------');
  console.log(` Tests Completed: ${passedTests}/${totalTests} Passed.`);
  console.log('========================================================');
  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();
