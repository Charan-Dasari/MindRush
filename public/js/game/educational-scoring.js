/**
 * MindRush — Educational Mode Progressive Scoring System
 * Configurable scoring schedule with controlled bounded variation.
 *
 * Scoring increases rewards and penalties progressively as questions advance:
 *   - Correct rewards increase (positive)
 *   - Wrong penalties increase in severity (negative)
 *   - Missed penalties increase in severity and are strictly more severe than wrong penalties
 *   - Values are generated once per question and remain fixed for that question
 *   - Restart resets the progression and seeds a fresh sequence
 */

// -- Base Schedule (initial progression reference) --
export const BASE_SCORING_SCHEDULE = [
  { questionNumber: 1, correct: 20, wrong: -10, missed: -25 },
  { questionNumber: 2, correct: 30, wrong: -25, missed: -40 },
  { questionNumber: 3, correct: 45, wrong: -35, missed: -50 },
  { questionNumber: 4, correct: 55, wrong: -45, missed: -60 },
  { questionNumber: 5, correct: 70, wrong: -55, missed: -75 }
];

// -- Configurable variation bounds and post-Q5 progression scaling --
export const SCORING_VARIATION_BOUNDS = {
  // Bounded random variation (± points) around the base values
  correctVariance: 3,  // ±3 pts around base correct
  wrongVariance: 2,    // ±2 pts around base wrong
  missedVariance: 2,   // ±2 pts around base missed
  // Progressive step per question beyond Q5 (if bank has >5 questions)
  postQ5Step: {
    correct: 15,
    wrong: -10,
    missed: -15
  }
};

export class EducationalScoringManager {
  /**
   * @param {object} [options]
   * @param {Array} [options.baseSchedule]
   * @param {object} [options.variationBounds]
   * @param {Function} [options.randomFn]
   */
  constructor(options = {}) {
    this.baseSchedule = options.baseSchedule || BASE_SCORING_SCHEDULE;
    this.variationBounds = options.variationBounds || SCORING_VARIATION_BOUNDS;
    this.randomFn = options.randomFn || Math.random;
    this._cache = new Map();
  }

  /**
   * Resets the progression cache for a new session.
   * Generates a fresh randomized sequence of values on next access.
   */
  reset() {
    this._cache.clear();
  }

  /**
   * Returns or generates the fixed scoring values for a given 0-based question index.
   * Values are fixed for the lifetime of that question in the session.
   *
   * @param {number} questionIndex - 0-based index of question (0 = Question 1)
   * @returns {{
   *   questionNumber: number,
   *   correct: number,
   *   wrong: number,
   *   missed: number,
   *   baseCorrect: number,
   *   baseWrong: number,
   *   baseMissed: number
   * }}
   */
  getScoringForQuestion(questionIndex) {
    if (this._cache.has(questionIndex)) {
      return this._cache.get(questionIndex);
    }

    const qNum = questionIndex + 1;
    let base;
    if (questionIndex < this.baseSchedule.length) {
      base = this.baseSchedule[questionIndex];
    } else {
      const lastBase = this.baseSchedule[this.baseSchedule.length - 1];
      const diff = questionIndex - (this.baseSchedule.length - 1);
      const step = this.variationBounds.postQ5Step;
      base = {
        questionNumber: qNum,
        correct: lastBase.correct + diff * step.correct,
        wrong: lastBase.wrong + diff * step.wrong,
        missed: lastBase.missed + diff * step.missed
      };
    }

    const cVar = this.variationBounds.correctVariance || 0;
    const wVar = this.variationBounds.wrongVariance || 0;
    const mVar = this.variationBounds.missedVariance || 0;

    // Generate integer jitter within [-var, +var]
    const cOffset = cVar > 0 ? Math.floor(this.randomFn() * (2 * cVar + 1)) - cVar : 0;
    const wOffset = wVar > 0 ? Math.floor(this.randomFn() * (2 * wVar + 1)) - wVar : 0;
    const mOffset = mVar > 0 ? Math.floor(this.randomFn() * (2 * mVar + 1)) - mVar : 0;

    let correct = base.correct + cOffset;
    let wrong = base.wrong + wOffset;
    let missed = base.missed + mOffset;

    // Hard bounds and signs: correct is always positive, penalties always negative
    if (correct < 1) correct = 1;
    if (wrong > -1) wrong = -1;
    if (missed > -2) missed = -2;

    // Enforce strict bounded variation limits around base values
    correct = Math.min(base.correct + cVar, Math.max(base.correct - cVar, correct));
    wrong = Math.min(base.wrong + wVar, Math.max(base.wrong - wVar, wrong));
    missed = Math.min(base.missed + mVar, Math.max(base.missed - mVar, missed));

    // Verify progression invariants over previous question
    if (questionIndex > 0) {
      const prev = this.getScoringForQuestion(questionIndex - 1);
      if (correct <= prev.correct) {
        correct = prev.correct + 1;
      }
      if (wrong >= prev.wrong) {
        wrong = prev.wrong - 1;
      }
      if (missed >= prev.missed) {
        missed = prev.missed - 1;
      }
    }

    // Missed-answer penalty must be strictly more severe than wrong-answer penalty (|missed| > |wrong|)
    if (missed >= wrong) {
      missed = wrong - 5;
    }

    const scoring = {
      questionNumber: qNum,
      correct: correct,
      wrong: wrong,
      missed: missed,
      baseCorrect: base.correct,
      baseWrong: base.wrong,
      baseMissed: base.missed
    };

    this._cache.set(questionIndex, scoring);
    return scoring;
  }
}

