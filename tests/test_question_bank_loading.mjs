import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EDUCATIONAL_QUESTIONS } from '../public/js/game/educational-questions.js';
import { PUBLISHED_QUESTIONS } from '../public/js/game/educational-questions-published.js';

describe('Question Bank ES Module Loading & Companion Integration Tests', () => {
  it('Synchronous question bank loading guarantees zero undefined loads', () => {
    assert.ok(Array.isArray(EDUCATIONAL_QUESTIONS));
    assert.ok(EDUCATIONAL_QUESTIONS.length >= 100);
  });

  it('Fallback companion file exports empty array without 404 or crash', () => {
    assert.ok(Array.isArray(PUBLISHED_QUESTIONS));
  });

  it('Every question has required fields and unique IDs', () => {
    const seenIds = new Set();
    EDUCATIONAL_QUESTIONS.forEach(q => {
      assert.ok(q.id);
      assert.ok(!seenIds.has(q.id), `Duplicate ID: ${q.id}`);
      seenIds.add(q.id);
      assert.ok(q.question);
      assert.ok(Array.isArray(q.options));
      assert.ok(q.options.length >= 2);
      assert.ok(q.correctAnswer);
    });
  });
});
