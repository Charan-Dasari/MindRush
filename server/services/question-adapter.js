/**
 * MindRush — Question Adapter Service
 * Adapts MongoDB GeneratedQuestion documents into the canonical EducationalEngine game format.
 * 
 * Rules:
 * - Only adapts questions where question_type === 'multiple_choice' and status === 'approved'
 * - Requires exactly 4 options
 * - Maps options: [{id, text}] -> [optA.text, optB.text, optC.text, optD.text]
 * - Maps correct_answer.value -> correctAnswer: String(val).trim()
 * - Non-MCQ questions remain unpublished in MongoDB
 */

export function adaptQuestionForGame(q, assignedPublishedId) {
  if (!q) {
    throw new Error('Question document is required for adaptation');
  }

  if (q.question_type !== 'multiple_choice') {
    return null; // Non-MCQ questions are omitted from publication
  }

  const options = Array.isArray(q.options) ? q.options : [];
  if (options.length !== 4) {
    throw new Error(`MCQ question must have exactly 4 options, found ${options.length}`);
  }

  const optionTexts = options.map(opt => String(opt.text !== undefined ? opt.text : opt).trim());
  
  let rawAnswer = '';
  if (q.correct_answer && q.correct_answer.value !== undefined) {
    rawAnswer = String(q.correct_answer.value).trim();
  } else if (q.correctAnswer !== undefined) {
    rawAnswer = String(q.correctAnswer).trim();
  } else {
    throw new Error('Question missing correct_answer');
  }

  // Ensure answer is present in options
  if (!optionTexts.includes(rawAnswer)) {
    throw new Error(`Correct answer "${rawAnswer}" not found among option texts: ${optionTexts.join(', ')}`);
  }

  return {
    id: assignedPublishedId,
    question: q.question_text || q.question || '',
    options: optionTexts,
    correctAnswer: rawAnswer,
    topic: q.topic || 'General'
  };
}
