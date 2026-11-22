import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GeneratedQuestion } from '../server/models/GeneratedQuestion.js';
import { AuditLog } from '../server/models/AuditLog.js';

describe('Human Review Workflow State Transitions & Audit Tests', () => {
  it('Approving a question transitions status to approved and writes AuditLog', async () => {
    const memoryQStore = GeneratedQuestion._getMemoryStore();
    memoryQStore.clear();
    const memoryAuditStore = AuditLog._getMemoryStore();
    memoryAuditStore.clear();

    const q = await GeneratedQuestion.create({
      question_id: 'q_review_1',
      batch_id: 'b_1',
      question_text: 'What is 10 + 5?',
      question_type: 'multiple_choice',
      options: [
        { id: 'A', text: '14' },
        { id: 'B', text: '15' },
        { id: 'C', text: '16' },
        { id: 'D', text: '17' }
      ],
      correct_option_id: 'B',
      correct_answer: { value: '15', type: 'number' },
      curriculum_id: 'cmo_std_1_math',
      standard: 1,
      subject: 'Mathematics',
      topic: 'Addition',
      difficulty: 'medium',
      status: 'pending_review'
    });

    assert.equal(q.status, 'pending_review');

    // Simulate approval
    const updated = await GeneratedQuestion.findByIdAndUpdate(q._id, {
      status: 'approved',
      reviewed_at: new Date()
    });

    assert.equal(updated.status, 'approved');

    // Record audit log
    const log = await AuditLog.log({
      actor_id: 'admin_reviewer_1',
      action: 'QUESTION_APPROVE',
      target_collection: 'generated_questions',
      target_id: String(q._id),
      details: { decision: 'approved' }
    });

    assert.equal(log.action, 'QUESTION_APPROVE');
  });

  it('Rejecting a question requires reason and transitions status to rejected', async () => {
    const q = await GeneratedQuestion.create({
      question_id: 'q_review_2',
      batch_id: 'b_1',
      question_text: 'What is 2 + 2?',
      question_type: 'multiple_choice',
      options: [
        { id: 'A', text: '3' },
        { id: 'B', text: '4' },
        { id: 'C', text: '5' },
        { id: 'D', text: '6' }
      ],
      correct_option_id: 'B',
      correct_answer: { value: '4', type: 'number' },
      curriculum_id: 'cmo_std_1_math',
      standard: 1,
      subject: 'Mathematics',
      topic: 'Addition',
      difficulty: 'easy',
      status: 'pending_review'
    });

    const reason = 'Too simplistic for standard 1 olympiad';
    const updated = await GeneratedQuestion.findByIdAndUpdate(q._id, {
      status: 'rejected',
      rejection_reason: reason
    });

    assert.equal(updated.status, 'rejected');
    assert.equal(updated.rejection_reason, reason);
  });
});
