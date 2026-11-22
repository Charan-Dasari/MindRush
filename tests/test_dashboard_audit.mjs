import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GenerationBatch } from '../server/models/GenerationBatch.js';
import { GeneratedQuestion } from '../server/models/GeneratedQuestion.js';
import { SourceDocument } from '../server/models/SourceDocument.js';
import { AuditLog } from '../server/models/AuditLog.js';

describe('Admin Dashboard Metrics & Audit Log Aggregation Tests', () => {
  it('Dashboard aggregates counts across documents, batches, and questions', async () => {
    const memBatches = GenerationBatch._getMemoryStore();
    const memQuestions = GeneratedQuestion._getMemoryStore();
    const memDocs = SourceDocument._getMemoryStore();

    memBatches.clear();
    memQuestions.clear();
    memDocs.clear();

    await GenerationBatch.create({
      batch_id: 'batch_dash_1',
      curriculum_id: 'cmo_std_1_math',
      standard: 1,
      subject: 'Mathematics',
      topic: 'Addition',
      difficulty: 'medium',
      requested_count: 5,
      status: 'completed'
    });

    await GeneratedQuestion.create({
      question_id: 'q_dash_1',
      batch_id: 'batch_dash_1',
      question_text: 'What is 1 + 1?',
      question_type: 'multiple_choice',
      options: [
        { id: 'A', text: '2' },
        { id: 'B', text: '3' },
        { id: 'C', text: '4' },
        { id: 'D', text: '5' }
      ],
      correct_option_id: 'A',
      correct_answer: { value: '2', type: 'number' },
      curriculum_id: 'cmo_std_1_math',
      standard: 1,
      subject: 'Mathematics',
      topic: 'Addition',
      difficulty: 'easy',
      status: 'pending_review'
    });

    await SourceDocument.create({
      filename: 'test_doc.pdf',
      file_path: 'C:/fake/test_doc.pdf',
      file_hash: 'dummyhash',
      file_format: 'pdf',
      curriculum_id: 'cmo_std_1_math',
      standard: 1,
      subject: 'Mathematics',
      processing_status: 'extracted'
    });

    const totalBatches = await GenerationBatch.countDocuments();
    const pendingQuestions = await GeneratedQuestion.countDocuments({ status: 'pending_review' });
    const totalDocs = await SourceDocument.countDocuments();

    assert.equal(totalBatches, 1);
    assert.equal(pendingQuestions, 1);
    assert.equal(totalDocs, 1);
  });

  it('Audit logs can be retrieved and sorted by recency', async () => {
    const memAudit = AuditLog._getMemoryStore();
    memAudit.clear();

    await AuditLog.log({
      actor_id: 'admin_1',
      action: 'BATCH_GENERATE',
      target_collection: 'generation_batches',
      target_id: 'batch_dash_1'
    });

    await new Promise(r => setTimeout(r, 10));

    await AuditLog.log({
      actor_id: 'admin_1',
      action: 'QUESTION_PUBLISH',
      target_collection: 'generated_questions',
      target_id: 'batch_dash_1'
    });

    const logs = await AuditLog.find();
    assert.equal(logs.length, 2);
    assert.equal(logs[0].action, 'QUESTION_PUBLISH'); // most recent first
  });
});
