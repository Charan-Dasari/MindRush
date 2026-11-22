import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EducationalEngine } from '../public/js/game/educational-engine.js';
import { EDUCATIONAL_QUESTIONS } from '../public/js/game/educational-questions.js';

describe('EducationalEngine Tightened Constructor Normalizer (8 Acceptance Cases)', () => {
  it('Case 1: All 100 original canonical questions pass normalization cleanly', () => {
    const engine = new EducationalEngine(EDUCATIONAL_QUESTIONS);
    assert.ok(engine.questions.length >= 100);
    assert.ok(engine.questions[0].correctIndex !== undefined);
  });

  it('Case 2: Correct answer can be at any option position (0, 1, 2, 3)', () => {
    const testQuestions = [
      { id: 1, question: 'Pos 0', options: ['A', 'B', 'C', 'D'], correctAnswer: 'A' },
      { id: 2, question: 'Pos 1', options: ['A', 'B', 'C', 'D'], correctAnswer: 'B' },
      { id: 3, question: 'Pos 2', options: ['A', 'B', 'C', 'D'], correctAnswer: 'C' },
      { id: 4, question: 'Pos 3', options: ['A', 'B', 'C', 'D'], correctAnswer: 'D' }
    ];
    const engine = new EducationalEngine(testQuestions);
    assert.equal(engine.questions[0].correctIndex, 0);
    assert.equal(engine.questions[1].correctIndex, 1);
    assert.equal(engine.questions[2].correctIndex, 2);
    assert.equal(engine.questions[3].correctIndex, 3);
  });

  it('Case 3: Missing or undefined or empty correctAnswer throws descriptive error', () => {
    assert.throws(
      () => new EducationalEngine([{ id: 1, options: ['A', 'B'], correctAnswer: undefined }]),
      /INVALID_CORRECT_ANSWER/
    );
    assert.throws(
      () => new EducationalEngine([{ id: 2, options: ['A', 'B'], correctAnswer: '' }]),
      /INVALID_CORRECT_ANSWER/
    );
    assert.throws(
      () => new EducationalEngine([{ id: 3, options: ['A', 'B'], correctAnswer: '   ' }]),
      /INVALID_CORRECT_ANSWER/
    );
  });

  it('Case 4: Correct answer not found in options throws ANSWER_NOT_IN_OPTIONS', () => {
    assert.throws(
      () => new EducationalEngine([{ id: 1, options: ['A', 'B', 'C', 'D'], correctAnswer: 'Z' }]),
      /ANSWER_NOT_IN_OPTIONS/
    );
  });

  it('Case 5: Ambiguous multiple identical matching options throws AMBIGUOUS_OPTIONS', () => {
    assert.throws(
      () => new EducationalEngine([{ id: 1, options: ['A', 'A', 'B', 'C'], correctAnswer: 'A' }]),
      /AMBIGUOUS_OPTIONS/
    );
  });

  it('Case 6: Non-integer or out-of-bounds correctIndex throws descriptive error', () => {
    assert.throws(
      () => new EducationalEngine([{ id: 1, options: ['A', 'B'], correctAnswer: 'A', correctIndex: 1.5 }]),
      /INVALID_CORRECT_INDEX/
    );
    assert.throws(
      () => new EducationalEngine([{ id: 2, options: ['A', 'B'], correctAnswer: 'A', correctIndex: 5 }]),
      /OUT_OF_BOUNDS_CORRECT_INDEX/
    );
  });

  it('Case 7: Conflicting correctIndex throws CONFLICTING_CORRECT_INDEX', () => {
    assert.throws(
      () => new EducationalEngine([{ id: 1, options: ['A', 'B', 'C', 'D'], correctAnswer: 'A', correctIndex: 2 }]),
      /CONFLICTING_CORRECT_INDEX/
    );
  });

  it('Case 8: Options with whitespace or number conversions normalize properly', () => {
    const q = [{ id: 1, options: [10, 20, 30, 40], correctAnswer: ' 20 ' }];
    const engine = new EducationalEngine(q);
    assert.equal(engine.questions[0].correctIndex, 1);
    assert.equal(engine.questions[0].correctAnswer, '20');
  });
});
