/**
 * MindRush — Progress & Leaderboard Routes
 * API Endpoints:
 * - GET  /api/progress        : Fetch authenticated user's isolated progress
 * - POST /api/progress/sync   : Save/merge authenticated user's progress (badges, progression, high score)
 * - POST /api/scores          : Submit verified game score for the authenticated account
 * - GET  /api/leaderboard     : Fetch top verified star cadets from the database
 */

import { Router } from 'express';
import { User } from '../models/User.js';
import { Score, normalizeScoreMode } from '../models/Score.js';

const router = Router();

/**
 * Middleware: Require active authenticated session
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in to access account progress.'
    });
  }
  next();
}

/**
 * GET /api/progress
 * Retrieve account-isolated progress for the logged-in cadet
 */
router.get('/progress', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Cadet record not found.'
      });
    }

    return res.json({
      success: true,
      user: {
        id: user._id ? user._id.toString() : user.id,
        username: user.username,
        fullName: user.fullName
      },
      badges: user.badges || [],
      highScore: user.highScore || 0,
      insaneUnlocked: Boolean(user.insaneUnlocked)
    });
  } catch (err) {
    console.error('[MindRush Progress] Fetch error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve cadet progress.'
    });
  }
});

/**
 * POST /api/progress/sync
 * Securely synchronize badges and difficulty progression for the authenticated user.
 * Strictly uses req.session.userId — client cannot spoof or modify another user's progress.
 */
router.post('/progress/sync', requireAuth, async (req, res) => {
  try {
    const { badges, highScore, insaneUnlocked } = req.body || {};

    const cleanBadges = Array.isArray(badges)
      ? badges.filter(b => typeof b === 'string' && b.trim().length > 0)
      : undefined;

    const cleanScore = typeof highScore === 'number' && !isNaN(highScore) && highScore >= 0
      ? Math.floor(highScore)
      : undefined;

    const cleanInsane = typeof insaneUnlocked === 'boolean' ? insaneUnlocked : undefined;

    const updated = await User.updateProgress(req.session.userId, {
      badges: cleanBadges,
      highScore: cleanScore,
      insaneUnlocked: cleanInsane
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Cadet account not found.'
      });
    }

    return res.json({
      success: true,
      badges: updated.badges || [],
      highScore: updated.highScore || 0,
      insaneUnlocked: Boolean(updated.insaneUnlocked)
    });
  } catch (err) {
    console.error('[MindRush Progress] Sync error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to synchronize account progress.'
    });
  }
});

/**
 * POST /api/scores
 * Submit a game score for the authenticated cadet to the leaderboard
 */
router.post('/scores', requireAuth, async (req, res) => {
  try {
    const { score, difficulty, mode } = req.body || {};

    const numScore = Number(score);
    if (isNaN(numScore) || numScore < 0 || numScore > 10000000) {
      return res.status(400).json({
        success: false,
        error: 'Score must be a valid non-negative integer.'
      });
    }

    const cleanDifficulty = typeof difficulty === 'string' && difficulty.trim().length > 0
      ? difficulty.trim().toUpperCase()
      : 'MEDIUM';

    const cleanMode = normalizeScoreMode(mode);

    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Cadet account not found.'
      });
    }

    // Suppress duplicate submissions for the same completed run within 5 seconds
    const duplicate = await Score.findRecentDuplicate({
      userId: user._id || user.id,
      score: Math.floor(numScore),
      difficulty: cleanDifficulty,
      mode: cleanMode,
      windowMs: 5000
    });
    if (duplicate) {
      return res.status(200).json({
        success: true,
        score: duplicate.score,
        difficulty: duplicate.difficulty,
        mode: cleanMode,
        cadet: user.username,
        duplicateSuppressed: true
      });
    }

    // Save score record
    const record = await Score.create({
      userId: user._id || user.id,
      username: user.username,
      fullName: user.fullName,
      score: Math.floor(numScore),
      difficulty: cleanDifficulty,
      mode: cleanMode
    });

    // Update user's personal all-time high score if this run beat it
    await User.updateProgress(user._id || user.id, {
      highScore: Math.floor(numScore)
    });

    return res.status(201).json({
      success: true,
      score: record.score,
      difficulty: record.difficulty,
      mode: cleanMode,
      cadet: user.username
    });
  } catch (err) {
    console.error('[MindRush Scores] Submit error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to record flight score.'
    });
  }
});

/**
 * GET /api/leaderboard
 * Retrieve top star cadet scores for the public leaderboard
 * Enforces one best score per user per difficulty per mode, resolved from authentic User records.
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { difficulty, mode } = req.query || {};
    const cleanMode = normalizeScoreMode(mode);

    // If multiplayer requested, return empty array immediately (future category)
    if (cleanMode === 'multiplayer') {
      return res.json({
        success: true,
        mode: 'multiplayer',
        leaderboard: []
      });
    }

    const rawScores = await Score.getTop(10, difficulty, cleanMode);
    const leaderboard = (rawScores || []).map((entry, index) => ({
      rank: index + 1,
      id: entry._id ? entry._id.toString() : entry.id,
      userId: entry.userId ? entry.userId.toString() : entry.userId,
      username: entry.username || 'cadet',
      difficulty: (entry.difficulty || 'MEDIUM').toUpperCase(),
      mode: entry.mode || cleanMode,
      score: entry.score,
      createdAt: entry.createdAt
    }));

    return res.json({
      success: true,
      mode: cleanMode,
      leaderboard
    });
  } catch (err) {
    console.error('[MindRush Leaderboard] Fetch error:', err.message);
    const status = err.status || 500;
    return res.status(status).json({
      success: false,
      error: 'Failed to load leaderboard data.'
    });
  }
});

export default router;
