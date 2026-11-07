/**
 * MindRush — Score Model & Leaderboard Repository
 * Stores verified game scores and serves the Star Cadet Leaderboard.
 * Supports both MongoDB with Mongoose and an in-memory repository for offline/test environments.
 */

import mongoose from 'mongoose';

const scoreSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  fullName: {
    type: String,
    trim: true
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 10000000
  },
  difficulty: {
    type: String,
    required: true,
    trim: true
  },
  mode: {
    type: String,
    enum: ['skyfall', 'space-invader', 'multiplayer'],
    default: 'skyfall',
    trim: true,
    lowercase: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

scoreSchema.index({ mode: 1, score: -1, createdAt: 1 });
scoreSchema.index({ userId: 1, mode: 1, difficulty: 1, score: -1 });

export const MongoScoreModel = mongoose.models.Score || mongoose.model('Score', scoreSchema);

import { memoryUserStore } from './User.js';

export function normalizeScoreMode(m) {
  const clean = String(m || 'skyfall').toLowerCase().trim();
  if (clean === 'invader' || clean === 'space-invader') return 'space-invader';
  if (clean === 'multiplayer') return 'multiplayer';
  return 'skyfall';
}

// In-Memory Score Store for offline testing
class MemoryScoreStore {
  constructor() {
    this.scores = [];
  }

  clear() {
    this.scores = [];
  }

  async create(scoreData) {
    const id = 'score_' + Math.random().toString(36).substring(2, 11);
    const doc = {
      _id: id,
      id,
      userId: scoreData.userId,
      username: String(scoreData.username || '').toLowerCase(),
      fullName: scoreData.fullName || scoreData.username,
      score: Number(scoreData.score) || 0,
      difficulty: String(scoreData.difficulty || 'medium').toUpperCase(),
      mode: normalizeScoreMode(scoreData.mode),
      createdAt: new Date()
    };
    this.scores.push(doc);
    return { ...doc };
  }

  async getTop(limit = 10, difficulty = null, mode = 'skyfall') {
    const targetMode = normalizeScoreMode(mode);
    if (targetMode === 'multiplayer') {
      return [];
    }

    let filtered = this.scores.filter(s => {
      const sMode = normalizeScoreMode(s.mode);
      return sMode === targetMode;
    });

    if (difficulty && typeof difficulty === 'string') {
      const targetDiff = difficulty.trim().toUpperCase();
      filtered = filtered.filter(s => s.difficulty === targetDiff);
    }

    // Sort by score descending and createdAt ascending
    filtered.sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);

    // Group by (userId, mode, difficulty) to ensure one best score per user per difficulty per mode
    const bestByUserDiff = new Map();
    for (const entry of filtered) {
      const key = `${String(entry.userId)}:${entry.mode}:${String(entry.difficulty).toUpperCase()}`;
      if (!bestByUserDiff.has(key)) {
        bestByUserDiff.set(key, entry);
      } else {
        const existing = bestByUserDiff.get(key);
        if (entry.score > existing.score) {
          bestByUserDiff.set(key, entry);
        }
      }
    }

    const aggregated = Array.from(bestByUserDiff.values());
    aggregated.sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);

    // Resolve authentic username from memoryUserStore using authenticated userId
    const results = [];
    for (const item of aggregated.slice(0, limit)) {
      const user = await memoryUserStore.findById(item.userId);
      if (!user) continue; // Skip orphaned test records without an existing user
      results.push({
        _id: item._id,
        id: item.id || item._id,
        userId: String(item.userId),
        username: user.username,
        mode: item.mode,
        difficulty: item.difficulty,
        score: item.score,
        createdAt: item.createdAt
      });
    }

    return results;
  }

  async getUserTop(userId) {
    const userScores = this.scores.filter(s => String(s.userId) === String(userId));
    if (userScores.length === 0) return null;
    return userScores.sort((a, b) => b.score - a.score)[0];
  }
}

export const memoryScoreStore = new MemoryScoreStore();

export const Score = {
  isUsingMongo() {
    return mongoose.connection && mongoose.connection.readyState === 1;
  },

  isMongoRequired() {
    return Boolean(process.env.MONGODB_URI) || process.env.NODE_ENV === 'production';
  },

  checkConnection() {
    if (this.isMongoRequired() && !this.isUsingMongo()) {
      const err = new Error('Mission database connection unavailable. MongoDB is not connected.');
      err.status = 503;
      throw err;
    }
  },

  async create(scoreData) {
    this.checkConnection();
    const cleanMode = normalizeScoreMode(scoreData.mode);
    if (this.isUsingMongo()) {
      const doc = new MongoScoreModel({
        userId: scoreData.userId,
        username: String(scoreData.username || '').toLowerCase(),
        fullName: scoreData.fullName || scoreData.username,
        score: scoreData.score,
        difficulty: String(scoreData.difficulty || 'medium').toUpperCase(),
        mode: cleanMode
      });
      const saved = await doc.save();
      return saved.toJSON();
    } else {
      return await memoryScoreStore.create(scoreData);
    }
  },

  async getTop(limit = 10, difficulty = null, mode = 'skyfall') {
    this.checkConnection();
    const targetMode = normalizeScoreMode(mode);
    if (targetMode === 'multiplayer') {
      return [];
    }

    if (this.isUsingMongo()) {
      const matchStage = {};
      if (targetMode === 'skyfall') {
        // Safe backward-compatible matching: legacy records without mode belong to skyfall
        matchStage.$or = [{ mode: 'skyfall' }, { mode: { $exists: false } }, { mode: null }];
      } else {
        matchStage.mode = targetMode;
      }

      if (difficulty && typeof difficulty === 'string') {
        matchStage.difficulty = difficulty.trim().toUpperCase();
      }

      const pipeline = [];
      pipeline.push({ $match: matchStage });

      pipeline.push(
        // Sort highest scores first so $first picks the best run
        { $sort: { score: -1, createdAt: 1 } },
        // Group by user, mode, and difficulty: exactly 1 best score per user per difficulty per mode
        {
          $group: {
            _id: { userId: '$userId', mode: { $ifNull: ['$mode', 'skyfall'] }, difficulty: '$difficulty' },
            scoreId: { $first: '$_id' },
            userId: { $first: '$userId' },
            mode: { $first: { $ifNull: ['$mode', 'skyfall'] } },
            difficulty: { $first: '$difficulty' },
            score: { $max: '$score' },
            createdAt: { $first: '$createdAt' }
          }
        },
        // Sort the aggregated best scores descending
        { $sort: { score: -1, createdAt: 1 } },
        { $limit: limit },
        // Lookup user document by userId to resolve authentic username
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: {
            path: '$user',
            preserveNullAndEmptyArrays: false
          }
        },
        // Project only necessary fields — strictly authentic username, NEVER fullName
        {
          $project: {
            _id: '$scoreId',
            id: { $toString: '$scoreId' },
            userId: { $toString: '$userId' },
            mode: '$mode',
            difficulty: '$difficulty',
            score: '$score',
            createdAt: '$createdAt',
            username: '$user.username'
          }
        }
      );

      return await MongoScoreModel.aggregate(pipeline).exec();
    } else {
      return await memoryScoreStore.getTop(limit, difficulty, mode);
    }
  },

  async findRecentDuplicate({ userId, score, difficulty, mode = 'skyfall', windowMs = 5000 }) {
    this.checkConnection();
    const since = new Date(Date.now() - windowMs);
    const cleanDiff = String(difficulty || 'MEDIUM').toUpperCase();
    const cleanMode = normalizeScoreMode(mode);

    if (this.isUsingMongo()) {
      const query = {
        userId,
        score,
        difficulty: cleanDiff,
        createdAt: { $gte: since }
      };
      if (cleanMode === 'skyfall') {
        query.$or = [{ mode: 'skyfall' }, { mode: { $exists: false } }, { mode: null }];
      } else {
        query.mode = cleanMode;
      }
      return await MongoScoreModel.findOne(query).lean().exec();
    } else {
      return memoryScoreStore.scores.find(s =>
        String(s.userId) === String(userId) &&
        s.score === score &&
        s.difficulty === cleanDiff &&
        normalizeScoreMode(s.mode) === cleanMode &&
        s.createdAt >= since
      ) || null;
    }
  },

  async getUserTop(userId) {
    this.checkConnection();
    if (this.isUsingMongo()) {
      return await MongoScoreModel.findOne({ userId })
        .sort({ score: -1 })
        .lean()
        .exec();
    } else {
      return await memoryScoreStore.getUserTop(userId);
    }
  }
};
