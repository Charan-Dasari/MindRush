/**
 * MindRush — Batch Processor Service
 * Coordinates automated question validation and batch question status transitions.
 */

import { GeneratedQuestion } from '../models/GeneratedQuestion.js';
import { ValidationResult } from '../models/ValidationResult.js';
import { GenerationBatch } from '../models/GenerationBatch.js';
import { aiClient } from './ai-client.js';

export class BatchProcessor {
  /**
   * Validates all questions belonging to a batch and records ValidationResults.
   * Updates question statuses accordingly (pending_review vs validation_failed).
   */
  async processBatchValidation(batchId) {
    const questions = await GeneratedQuestion.find({ batch_id: batchId });
    if (!questions || questions.length === 0) {
      return { validated_count: 0, passed_count: 0, failed_count: 0 };
    }

    await GenerationBatch.findOneAndUpdate(
      { batch_id: batchId },
      { status: 'validating' }
    );

    let passedCount = 0;
    let failedCount = 0;

    for (const q of questions) {
      try {
        const valResponse = await aiClient.validateQuestion({
          question_text: q.question_text,
          options: q.options,
          correct_option_id: q.correct_option_id,
          correct_answer: q.correct_answer,
          topic: q.topic,
          explanation: q.explanation
        });

        // Store ValidationResult in MongoDB
        await ValidationResult.create({
          question_id: q.question_id,
          schema_valid: valResponse.schema_valid,
          answer_valid: valResponse.answer_valid,
          recalculated_value: valResponse.recalculated_value,
          duplicate_check: valResponse.duplicate_check,
          similarity_score: valResponse.similarity_score,
          most_similar_id: valResponse.most_similar_id,
          curriculum_check: valResponse.curriculum_check,
          difficulty_check: valResponse.difficulty_check,
          language_check: valResponse.language_check,
          option_check: valResponse.option_check,
          overall_status: valResponse.overall_status,
          errors: valResponse.errors || []
        });

        const newStatus = valResponse.overall_status === 'pending_review' ? 'pending_review' : 'validation_failed';
        await GeneratedQuestion.findByIdAndUpdate(q._id, { status: newStatus });

        if (newStatus === 'pending_review') {
          passedCount++;
        } else {
          failedCount++;
        }
      } catch (valErr) {
        console.error(`[VALIDATION] Failed to validate question ${q.question_id}:`, valErr.message);
        await GeneratedQuestion.findByIdAndUpdate(q._id, { status: 'validation_failed' });
        failedCount++;
      }
    }

    await GenerationBatch.findOneAndUpdate(
      { batch_id: batchId },
      { status: 'completed' }
    );

    return {
      validated_count: questions.length,
      passed_count: passedCount,
      failed_count: failedCount
    };
  }
}

export const batchProcessor = new BatchProcessor();
