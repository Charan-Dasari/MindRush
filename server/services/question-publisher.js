/**
 * MindRush — Question Publisher Service
 * Publishes approved questions to public/js/game/educational-questions-published.js
 * using atomic MongoDB sequences (IDs >= 1001) and staged atomic file writes (.tmp -> rename).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Counter } from '../models/Counter.js';
import { GeneratedQuestion } from '../models/GeneratedQuestion.js';
import { adaptQuestionForGame } from './question-adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLISHED_FILE_PATH = path.resolve(__dirname, '..', '..', 'public', 'js', 'game', 'educational-questions-published.js');

let publicationMutex = false;

export class QuestionPublisher {
  /**
   * Publishes all questions currently in 'approved' status.
   * Allocates monotonic IDs starting at 1001 using Counter.
   * Performs atomic file replacement via .tmp staging.
   */
  async publishApprovedQuestions() {
    if (publicationMutex) {
      throw new Error('Publication currently in progress. Please wait.');
    }

    publicationMutex = true;
    try {
      const approvedQuestions = await GeneratedQuestion.find({ status: 'approved' });
      if (!approvedQuestions || approvedQuestions.length === 0) {
        return { published_count: 0, message: 'No approved questions to publish' };
      }

      // Read already published questions if file exists
      const existingPublished = await GeneratedQuestion.find({ status: 'published' });
      const publishedDeck = [];

      // 1. Maintain existing published questions
      for (const eq of existingPublished) {
        if (eq.published_id && eq.status !== 'disabled') {
          try {
            const adapted = adaptQuestionForGame(eq, eq.published_id);
            if (adapted) publishedDeck.push(adapted);
          } catch (e) {
            console.warn(`[PUBLISH] Skipping corrupt published question ${eq._id}: ${e.message}`);
          }
        }
      }

      // 2. Assign atomic IDs and publish new approved questions
      const newPublishedDocs = [];
      for (const aq of approvedQuestions) {
        const nextId = await Counter.getNextSequence('published_question_id');
        const adapted = adaptQuestionForGame(aq, nextId);

        if (adapted) {
          publishedDeck.push(adapted);
          await GeneratedQuestion.findByIdAndUpdate(aq._id, {
            status: 'published',
            published_id: nextId
          });
          newPublishedDocs.push(adapted);
        }
      }

      // 3. Staged atomic file replacement
      const fileContent = `/**
 * MindRush — Published Educational Question Bank Companion Module
 * Generated dynamically by MindRush Question Publisher Service.
 * Total Published Questions: ${publishedDeck.length}
 */

export const PUBLISHED_QUESTIONS = ${JSON.stringify(publishedDeck, null, 2)};
`;

      const tmpPath = `${PUBLISHED_FILE_PATH}.tmp`;
      fs.writeFileSync(tmpPath, fileContent, 'utf-8');
      fs.renameSync(tmpPath, PUBLISHED_FILE_PATH);

      return {
        published_count: newPublishedDocs.length,
        total_published: publishedDeck.length,
        questions: newPublishedDocs
      };
    } finally {
      publicationMutex = false;
    }
  }

  /**
   * Disables a previously published question, omitting it from future publication files.
   */
  async disableQuestion(questionId) {
    const q = await GeneratedQuestion.findByIdAndUpdate(questionId, {
      status: 'disabled'
    });
    return q;
  }
}

export const questionPublisher = new QuestionPublisher();
