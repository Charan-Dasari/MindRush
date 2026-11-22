import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ValidationResult } from '../server/models/ValidationResult.js';
import { GeneratedQuestion } from '../server/models/GeneratedQuestion.js';
import { batchProcessor } from '../server/services/batch-processor.js';

describe('Automated Validation Pipeline Unit & Contract Tests', () => {
  it('ValidationResult model records multi-tier checks in memory store', async () => {
    const memoryStore = ValidationResult._getMemoryStore();
    memoryStore.clear();

    const result = await ValidationResult.create({
      question_id: 'q_test_101',
      schema_valid: true,
      answer_valid: true,
      recalculated_value: 42,
      duplicate_check: 'passed',
      similarity_score: 0.12,
      curriculum_check: 'passed',
      difficulty_check: 'passed',
      language_check: 'passed',
      option_check: 'passed',
      overall_status: 'pending_review',
      errors: []
    });

    assert.equal(result.question_id, 'q_test_101');
    assert.equal(result.schema_valid, true);
    assert.equal(result.recalculated_value, 42);
    assert.equal(result.overall_status, 'pending_review');
  });

  it('BatchProcessor handles empty batch gracefully', async () => {
    const res = await batchProcessor.processBatchValidation('non_existent_batch');
    assert.equal(res.validated_count, 0);
  });
});
