/**
 * MindRush — Gameplay Question Delivery Routes
 */

import { Router } from 'express';
import { QuestionReport } from '../models/QuestionReport.js';

const router = Router();

/**
 * GET /api/questions/random
 * Prepared gameplay delivery endpoint for remote question fetching.
 */
router.get('/random', (req, res) => {
  res.json({ message: 'Gameplay delivery capability operational' });
});

/**
 * POST /api/questions/:id/report
 * Enables cadets or admins to report problematic questions during or after gameplay.
 */
router.post('/:id/report', async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'REASON_REQUIRED', message: 'Report reason is required' });
  }

  const report = await QuestionReport.create({
    question_id: id,
    reported_by: req.session ? req.session.userId : null,
    reason: reason.trim()
  });

  res.json({ success: true, report });
});

export default router;
