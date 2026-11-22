/**
 * MindRush — Administrative Routes
 * Handles question generation batches, review, publication, document management, and dashboard analytics.
 */

import { Router } from 'express';
import crypto from 'crypto';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { GenerationBatch } from '../models/GenerationBatch.js';
import { GeneratedQuestion } from '../models/GeneratedQuestion.js';
import { SourceQuestion } from '../models/SourceQuestion.js';
import { SourceDocument } from '../models/SourceDocument.js';
import { ValidationResult } from '../models/ValidationResult.js';
import { AuditLog } from '../models/AuditLog.js';
import { aiClient } from '../services/ai-client.js';
import { questionPublisher } from '../services/question-publisher.js';

const router = Router();

// Protect all admin routes with authentication, role check, and CSRF protection
router.use(requireAdmin);

// Server-side active batch lock for single concurrency
let activeBatchRunning = false;

/**
 * POST /api/admin/generation
 * Dispatches an AI question generation batch.
 * Enforces single-batch concurrency mutex and idempotency.
 */
router.post('/generation', async (req, res) => {
  const {
    curriculum_id,
    standard,
    subject,
    topic,
    difficulty,
    requested_count,
    idempotency_key
  } = req.body;

  if (!curriculum_id || !standard || !subject || !topic || !difficulty || !requested_count) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'All generation fields (curriculum_id, standard, subject, topic, difficulty, requested_count) are required'
    });
  }

  const count = parseInt(requested_count, 10);
  if (isNaN(count) || count < 1 || count > 50) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'requested_count must be between 1 and 50'
    });
  }

  if (idempotency_key) {
    const existing = await GenerationBatch.findOne({ idempotency_key });
    if (existing) {
      return res.status(200).json({
        batch_id: existing.batch_id,
        status: existing.status,
        generated_count: existing.generated_count,
        idempotent_replay: true
      });
    }
  }

  if (activeBatchRunning) {
    return res.status(429).json({
      error: 'CONCURRENCY_LIMIT',
      message: 'Another generation batch is currently being processed. Please wait for it to complete.'
    });
  }

  const batchId = crypto.randomUUID();
  const requestHash = GenerationBatch.computeRequestHash({
    curriculum_id, standard, subject, topic, difficulty, requested_count: count
  });

  let batch;
  try {
    batch = await GenerationBatch.create({
      batch_id: batchId,
      idempotency_key: idempotency_key || null,
      request_hash: requestHash,
      curriculum_id,
      standard,
      subject,
      topic,
      difficulty,
      requested_count: count,
      model_name: 'qwen3.5:4b',
      status: 'pending',
      created_by: req.adminUser ? req.adminUser._id : null
    });
  } catch (err) {
    return res.status(500).json({
      error: 'BATCH_CREATION_FAILED',
      message: err.message
    });
  }

  await AuditLog.log({
    actor_id: req.adminUser ? req.adminUser._id : 'admin',
    action: 'BATCH_GENERATE',
    target_collection: 'generation_batches',
    target_id: batchId,
    details: { curriculum_id, standard, subject, topic, difficulty, requested_count: count },
    ip_address: req.ip || req.socket.remoteAddress
  });

  activeBatchRunning = true;
  res.status(202).json({
    batch_id: batchId,
    status: 'pending',
    message: 'Generation batch queued for execution'
  });

  (async () => {
    try {
      await GenerationBatch.findOneAndUpdate(
        { batch_id: batchId },
        { status: 'generating', started_at: new Date() }
      );

      const sourceQuestions = await SourceQuestion.find({
        curriculum_id,
        standard,
        subject
      });

      const response = await aiClient.generateQuestions({
        curriculum_name: 'CMO (Crest Mathematics Olympiad)',
        standard,
        subject,
        topic,
        difficulty,
        requested_count: count,
        source_questions: sourceQuestions.slice(0, 5)
      });

      const rawQuestions = response.questions || [];
      const createdQuestions = [];

      for (const q of rawQuestions) {
        try {
          const qDoc = await GeneratedQuestion.create({
            question_id: crypto.randomUUID(),
            batch_id: batchId,
            question_text: q.question_text || q.question || '',
            question_type: 'multiple_choice',
            options: Array.isArray(q.options) ? q.options : [],
            correct_option_id: q.correct_option_id || 'A',
            correct_answer: q.correct_answer || { value: '', type: 'string' },
            curriculum_id,
            standard,
            subject,
            topic,
            difficulty,
            explanation: q.explanation || '',
            status: 'pending_review'
          });
          createdQuestions.push(qDoc);
        } catch (qErr) {
          console.error('[ADMIN] Failed to persist generated question:', qErr.message);
        }
      }

      await GenerationBatch.findOneAndUpdate(
        { batch_id: batchId },
        {
          status: 'completed',
          generated_count: createdQuestions.length,
          completed_at: new Date()
        }
      );
    } catch (err) {
      console.error(`[ADMIN] Batch ${batchId} generation error:`, err.message);
      await GenerationBatch.findOneAndUpdate(
        { batch_id: batchId },
        {
          status: 'failed',
          error_message: err.message,
          completed_at: new Date()
        }
      );
    } finally {
      activeBatchRunning = false;
    }
  })();
});

/**
 * GET /api/admin/generation/:batchId
 * Polls status of a generation batch.
 */
router.get('/generation/:batchId', async (req, res) => {
  const { batchId } = req.params;
  const batch = await GenerationBatch.findOne({ batch_id: batchId });

  if (!batch) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      message: `Batch ${batchId} not found`
    });
  }

  res.json({ batch });
});

/**
 * GET /api/admin/questions/pending-review (T030)
 * Returns questions in pending_review status alongside validation findings.
 */
router.get('/questions/pending-review', async (req, res) => {
  try {
    const questions = await GeneratedQuestion.find({ status: 'pending_review' });
    const enriched = [];

    for (const q of questions) {
      const val = await ValidationResult.findOne({ question_id: q.question_id });
      enriched.push({
        question: q,
        validation: val || null
      });
    }

    res.json({ questions: enriched });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/admin/questions/:id/review (T030)
 * Reviewer decision: approved, rejected (mandatory reason), or correction_requested.
 */
router.post('/questions/:id/review', async (req, res) => {
  const { id } = req.params;
  const { decision, reason } = req.body;

  if (!['approved', 'rejected', 'correction_requested'].includes(decision)) {
    return res.status(400).json({
      error: 'INVALID_DECISION',
      message: 'Decision must be approved, rejected, or correction_requested'
    });
  }

  if (decision === 'rejected' && (!reason || !reason.trim())) {
    return res.status(400).json({
      error: 'REASON_REQUIRED',
      message: 'Rejection requires a mandatory reason'
    });
  }

  // Find question by _id or question_id
  let question = await GeneratedQuestion.findOne({ _id: id });
  if (!question) {
    question = await GeneratedQuestion.findOne({ question_id: id });
  }

  if (!question) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Question not found' });
  }

  const update = {
    status: decision,
    reviewed_by: req.adminUser ? req.adminUser._id : null,
    reviewed_at: new Date()
  };

  if (decision === 'rejected') {
    update.rejection_reason = reason.trim();
  }

  const updated = await GeneratedQuestion.findByIdAndUpdate(question._id, update);

  // Record audit log
  await AuditLog.log({
    actor_id: req.adminUser ? req.adminUser._id : 'admin',
    action: decision === 'approved' ? 'QUESTION_APPROVE' : 'QUESTION_REJECT',
    target_collection: 'generated_questions',
    target_id: String(question._id),
    details: { decision, reason: update.rejection_reason || null },
    ip_address: req.ip || req.socket.remoteAddress
  });

  res.json({ success: true, question: updated });
});

/**
 * PATCH /api/admin/questions/:id (T030)
 * Modifies question stem or options.
 */
router.patch('/questions/:id', async (req, res) => {
  const { id } = req.params;
  const { question_text, options, correct_option_id, correct_answer, explanation } = req.body;

  let question = await GeneratedQuestion.findOne({ _id: id });
  if (!question) {
    question = await GeneratedQuestion.findOne({ question_id: id });
  }

  if (!question) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Question not found' });
  }

  const update = {};
  if (question_text) update.question_text = question_text.trim();
  if (options) update.options = options;
  if (correct_option_id) update.correct_option_id = correct_option_id;
  if (correct_answer) update.correct_answer = correct_answer;
  if (explanation) update.explanation = explanation;

  const updated = await GeneratedQuestion.findByIdAndUpdate(question._id, update);

  await AuditLog.log({
    actor_id: req.adminUser ? req.adminUser._id : 'admin',
    action: 'QUESTION_EDIT',
    target_collection: 'generated_questions',
    target_id: String(question._id),
    details: { edited_fields: Object.keys(update) },
    ip_address: req.ip || req.socket.remoteAddress
  });

  res.json({ success: true, question: updated });
});

/**
 * POST /api/admin/questions/publish (T035)
 * Publishes all approved questions to educational-questions-published.js.
 */
router.post('/questions/publish', async (req, res) => {
  try {
    const pubResult = await questionPublisher.publishApprovedQuestions();

    await AuditLog.log({
      actor_id: req.adminUser ? req.adminUser._id : 'admin',
      action: 'QUESTION_PUBLISH',
      target_collection: 'generated_questions',
      target_id: 'batch_publication',
      details: { published_count: pubResult.published_count, total_published: pubResult.total_published },
      ip_address: req.ip || req.socket.remoteAddress
    });

    res.json({ success: true, ...pubResult });
  } catch (err) {
    res.status(500).json({ error: 'PUBLICATION_FAILED', message: err.message });
  }
});

/**
 * POST /api/admin/questions/:id/disable (T035)
 * Disables a question from future publications.
 */
router.post('/questions/:id/disable', async (req, res) => {
  const { id } = req.params;
  try {
    const disabled = await questionPublisher.disableQuestion(id);

    await AuditLog.log({
      actor_id: req.adminUser ? req.adminUser._id : 'admin',
      action: 'QUESTION_DISABLE',
      target_collection: 'generated_questions',
      target_id: String(id),
      details: { status: 'disabled' },
      ip_address: req.ip || req.socket.remoteAddress
    });

    res.json({ success: true, question: disabled });
  } catch (err) {
    res.status(500).json({ error: 'DISABLE_FAILED', message: err.message });
  }
});

/**
 * GET /api/admin/documents (T044)
 * Returns catalog of ingested source documents.
 */
router.get('/documents', async (req, res) => {
  try {
    const docs = await SourceDocument.find();
    res.json({ documents: docs });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * POST /api/admin/documents (T044)
 * Registers a new source document, enforcing PDF format.
 */
router.post('/documents', async (req, res) => {
  const { filename, file_path, file_hash, curriculum_id, standard, subject, license_info } = req.body;

  if (!filename || !file_path || !file_hash || !curriculum_id || !standard || !subject) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Missing required document fields' });
  }

  if (!filename.toLowerCase().endsWith('.pdf') || !file_path.toLowerCase().endsWith('.pdf')) {
    return res.status(400).json({
      error: 'UNSUPPORTED_FORMAT',
      message: 'Only PDF format is supported in Feature 001. XLSX, XLS, and DOCX are planned for Phase 3b.'
    });
  }

  try {
    const doc = await SourceDocument.create({
      filename,
      file_path,
      file_hash,
      file_format: 'pdf',
      curriculum_id,
      standard,
      subject,
      license_info: license_info || null,
      processing_status: 'pending'
    });

    await AuditLog.log({
      actor_id: req.adminUser ? req.adminUser._id : 'admin',
      action: 'DOCUMENT_UPLOAD',
      target_collection: 'source_documents',
      target_id: String(doc._id),
      details: { filename, file_format: 'pdf' },
      ip_address: req.ip || req.socket.remoteAddress
    });

    res.status(201).json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ error: 'DOCUMENT_CREATION_FAILED', message: err.message });
  }
});

/**
 * GET /api/admin/dashboard (T047)
 * Returns operational metrics across batches, questions, and documents.
 */
router.get('/dashboard', async (req, res) => {
  try {
    const totalBatches = await GenerationBatch.countDocuments();
    const pendingReviewCount = await GeneratedQuestion.countDocuments({ status: 'pending_review' });
    const approvedCount = await GeneratedQuestion.countDocuments({ status: 'approved' });
    const publishedCount = await GeneratedQuestion.countDocuments({ status: 'published' });
    const rejectedCount = await GeneratedQuestion.countDocuments({ status: 'rejected' });
    const totalDocuments = await SourceDocument.countDocuments();

    res.json({
      metrics: {
        total_batches: totalBatches,
        pending_review: pendingReviewCount,
        approved: approvedCount,
        published: publishedCount,
        rejected: rejectedCount,
        source_documents: totalDocuments
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * GET /api/admin/audit-logs (T047)
 * Returns append-only audit trail entries.
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const logs = await AuditLog.find();
    res.json({ audit_logs: logs });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

/**
 * GET /api/admin/batches (T047)
 * Returns list of recent generation batches.
 */
router.get('/batches', async (req, res) => {
  try {
    const batches = await GenerationBatch.find();
    res.json({ batches });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
  }
});

export default router;
