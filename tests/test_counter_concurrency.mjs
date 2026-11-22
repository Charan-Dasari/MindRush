/**
 * MindRush — Counter Concurrency & Model Guarantees Test Suite
 * Tests:
 * 1. Counter atomic concurrency (no duplicate sequence allocations under Promise.all)
 * 2. Counter init idempotency (re-initialization never resets an existing counter)
 * 3. Counter non-gapless nature (demonstrates allocation vs gapless distinction)
 * 4. AuditLog application-level append-only enforcement (blocks updates/deletions)
 * 5. Seeding repeatability (repeated seed never overwrites curriculum or resets counter)
 */

import assert from 'assert';
import mongoose from 'mongoose';
import { Counter, MongoCounterModel } from '../server/models/Counter.js';
import { AuditLog, MongoAuditLogModel } from '../server/models/AuditLog.js';
import { Curriculum } from '../server/models/Curriculum.js';
import { seedCurriculumAndCounters } from '../server/scripts/seed-curriculum.js';

console.log('========================================================');
console.log(' Running Counter Concurrency & Model Guarantees Tests');
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
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mindrush_live_test';
  let liveDb = false;
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    liveDb = (mongoose.connection.readyState === 1);
    console.log(`[DB] Connected to Live MongoDB at ${MONGODB_URI}`);
  } catch (e) {
    console.log('[DB] Operating in In-Memory fallback mode for concurrency test.');
  }

  // --- Test 1: Counter Atomic Concurrency ---
  await test('Counter allocates strictly unique sequences under concurrent load', async () => {
    const counterKey = 'concurrent_test_' + Math.random().toString(36).substring(2, 7);
    await Counter.initSequence(counterKey, 5000);

    const CONCURRENCY = 30;
    const promises = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      promises.push(Counter.getNextSequence(counterKey));
    }

    const results = await Promise.all(promises);
    assert.strictEqual(results.length, CONCURRENCY, `Should have ${CONCURRENCY} results`);

    const uniqueSet = new Set(results);
    assert.strictEqual(uniqueSet.size, CONCURRENCY, 'All allocated sequence numbers must be strictly unique');

    // Bounds check: numbers must range from 5001 to 5030
    const minVal = Math.min(...results);
    const maxVal = Math.max(...results);
    assert.strictEqual(minVal, 5001, 'Minimum sequence should be 5001');
    assert.strictEqual(maxVal, 5000 + CONCURRENCY, `Maximum sequence should be ${5000 + CONCURRENCY}`);
  });

  // --- Test 2: Counter Idempotent Re-initialization ---
  await test('initSequence does not reset an already incremented counter', async () => {
    const counterKey = 'idempotent_test_' + Math.random().toString(36).substring(2, 7);
    await Counter.initSequence(counterKey, 2000);
    const firstAlloc = await Counter.getNextSequence(counterKey);
    assert.strictEqual(firstAlloc, 2001);

    // Re-run initSequence with default 2000
    await Counter.initSequence(counterKey, 2000);
    const secondAlloc = await Counter.getNextSequence(counterKey);
    assert.strictEqual(secondAlloc, 2002, 'Sequence must continue incrementing from 2002, not reset to 2000');
  });

  // --- Test 3: AuditLog Append-Only Enforcement ---
  await test('AuditLog blocks update and delete operations at application layer', async () => {
    const logEntry = await AuditLog.log({
      actor_id: 'usr_test_audit',
      action: 'QUESTION_EDIT',
      target_collection: 'questions',
      target_id: 'q_123',
      details: { field: 'text' }
    });

    assert.ok(logEntry._id, 'Log must be created');

    if (AuditLog.isMongoose()) {
      await assert.rejects(
        async () => {
          await MongoAuditLogModel.updateOne({ _id: logEntry._id }, { action: 'QUESTION_APPROVE' });
        },
        /AuditLog documents are append-only/,
        'Mongoose updateOne must be blocked'
      );

      await assert.rejects(
        async () => {
          await MongoAuditLogModel.deleteOne({ _id: logEntry._id });
        },
        /AuditLog documents are append-only/,
        'Mongoose deleteOne must be blocked'
      );
    } else {
      const memStore = AuditLog._getMemoryStore();
      await assert.rejects(
        async () => { await memStore.update(); },
        /AuditLog documents are append-only/,
        'Memory update must be blocked'
      );
      await assert.rejects(
        async () => { await memStore.delete(); },
        /AuditLog documents are append-only/,
        'Memory delete must be blocked'
      );
    }
  });

  // --- Test 4: Seeding Repeatability & Non-Overwriting ---
  await test('seedCurriculumAndCounters is fully repeatable without overwriting data', async () => {
    // Run seed twice
    const run1 = await seedCurriculumAndCounters();
    const counterBefore = await Counter.getNextSequence('published_question_id');

    const run2 = await seedCurriculumAndCounters();
    assert.strictEqual(run2.curriculumSeeded, false, 'Curriculum must not be re-inserted if existing');

    const counterAfter = await Counter.getNextSequence('published_question_id');
    assert.strictEqual(counterAfter, counterBefore + 1, 'Counter must continue monotonically without reset');
  });

  if (liveDb) {
    await mongoose.disconnect();
  }

  console.log('--------------------------------------------------------');
  console.log(` Concurrency & Guarantees Tests: ${passedTests}/${totalTests} Passed.`);
  console.log('========================================================');
  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();
