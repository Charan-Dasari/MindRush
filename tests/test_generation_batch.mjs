import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { User, memoryUserStore } from '../server/models/User.js';
import { GenerationBatch } from '../server/models/GenerationBatch.js';
import { AuditLog } from '../server/models/AuditLog.js';

describe('Admin Generation Batch & Idempotency Integration Tests', () => {
  it('Setup and verify admin user store', async () => {
    memoryUserStore.clear();

    const admin = await User.create({
      fullName: 'Super Admin',
      username: 'generation_admin',
      dob: new Date('1990-01-01'),
      gender: 'male',
      passwordHash: 'dummy_hash',
      role: 'admin'
    });

    assert.equal(admin.role, 'admin');
    assert.equal(admin.username, 'generation_admin');
  });

  it('Idempotency keys prevent duplicate generation batches', async () => {
    const memoryBatchStore = GenerationBatch._getMemoryStore();
    memoryBatchStore.clear();

    const batch1 = await GenerationBatch.create({
      batch_id: 'batch_uuid_1001',
      idempotency_key: 'idemp_key_unique_1',
      curriculum_id: 'cmo_std_1_math',
      standard: 1,
      subject: 'Mathematics',
      topic: 'Addition',
      difficulty: 'medium',
      requested_count: 5,
      status: 'pending'
    });

    assert.equal(batch1.batch_id, 'batch_uuid_1001');

    // Attempting to create batch with duplicate idempotency key should throw
    await assert.rejects(
      async () => {
        await GenerationBatch.create({
          batch_id: 'batch_uuid_1002',
          idempotency_key: 'idemp_key_unique_1',
          curriculum_id: 'cmo_std_1_math',
          standard: 1,
          subject: 'Mathematics',
          topic: 'Addition',
          difficulty: 'medium',
          requested_count: 5,
          status: 'pending'
        });
      },
      /duplicate key error/
    );
  });

  it('GenerationBatch computeRequestHash is deterministic', () => {
    const hash1 = GenerationBatch.computeRequestHash({
      curriculum_id: 'cmo_std_1_math',
      standard: 1,
      subject: 'Mathematics',
      topic: 'Addition',
      difficulty: 'medium',
      requested_count: 5
    });

    const hash2 = GenerationBatch.computeRequestHash({
      curriculum_id: 'cmo_std_1_math',
      standard: 1,
      subject: 'Mathematics',
      topic: 'Addition',
      difficulty: 'medium',
      requested_count: 5
    });

    assert.equal(hash1, hash2);
    assert.equal(typeof hash1, 'string');
    assert.equal(hash1.length, 16);
  });

  it('AuditLog records BATCH_GENERATE action without error', async () => {
    const memoryAuditStore = AuditLog._getMemoryStore();
    memoryAuditStore.clear();

    const logEntry = await AuditLog.log({
      actor_id: 'admin_test_1',
      action: 'BATCH_GENERATE',
      target_collection: 'generation_batches',
      target_id: 'batch_uuid_1001',
      details: { count: 5 }
    });

    assert.equal(logEntry.action, 'BATCH_GENERATE');
    assert.equal(logEntry.target_id, 'batch_uuid_1001');
  });
});
