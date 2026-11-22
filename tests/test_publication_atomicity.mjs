import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Counter } from '../server/models/Counter.js';
import { GeneratedQuestion } from '../server/models/GeneratedQuestion.js';
import { questionPublisher } from '../server/services/question-publisher.js';

describe('Publication Atomicity & Staged File Writing Tests', () => {
  it('Monotonic sequence increments IDs to 1001+', async () => {
    const memCounter = Counter._getMemoryStore();
    memCounter.clear();

    const id1 = await Counter.getNextSequence('published_question_id');
    const id2 = await Counter.getNextSequence('published_question_id');

    assert.equal(id1, 1001);
    assert.equal(id2, 1002);
  });

  it('Publishing approved questions transitions status to published', async () => {
    const memQ = GeneratedQuestion._getMemoryStore();
    memQ.clear();

    const q = await GeneratedQuestion.create({
      question_id: 'q_pub_test_1',
      batch_id: 'batch_1',
      question_text: 'What is 20 + 20?',
      question_type: 'multiple_choice',
      options: [
        { id: 'A', text: '39' },
        { id: 'B', text: '40' },
        { id: 'C', text: '41' },
        { id: 'D', text: '42' }
      ],
      correct_option_id: 'B',
      correct_answer: { value: '40', type: 'number' },
      curriculum_id: 'cmo_std_1_math',
      standard: 1,
      subject: 'Mathematics',
      topic: 'Addition',
      difficulty: 'easy',
      status: 'approved'
    });

    const result = await questionPublisher.publishApprovedQuestions();
    assert.ok(result.published_count >= 1);

    const updated = await GeneratedQuestion.findByIdAndUpdate(q._id, {});
    assert.equal(updated.status, 'published');
    assert.ok(updated.published_id >= 1001);
  });
});
