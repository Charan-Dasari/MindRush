/**
 * MindRush — User Model
 * Production Mongoose model for MongoDB Atlas with fallback in-memory repository
 * Enforces unique normalized usernames and never leaks password hashes.
 */

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [16, 'Username cannot exceed 16 characters'],
    match: [/^[a-zA-Z0-9_]{3,16}$/, 'Username can only contain letters, numbers, and underscores']
  },
  dob: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    lowercase: true,
    enum: ['male', 'female']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required'],
    select: false // never returned in normal queries
  },
  badges: {
    type: [String],
    default: []
  },
  highScore: {
    type: Number,
    default: 0
  },
  insaneUnlocked: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Sanitize user object for JSON serialization — NEVER expose passwordHash
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

export const MongoUserModel = mongoose.models.User || mongoose.model('User', userSchema);

// In-Memory User Store for offline testing or when MongoDB URI is not configured
class MemoryUserStore {
  constructor() {
    this.users = new Map();
  }

  clear() {
    this.users.clear();
  }

  async findOne({ username }) {
    if (!username) return null;
    const normalized = username.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.username === normalized) {
        return { ...user };
      }
    }
    return null;
  }

  async findById(id) {
    const user = this.users.get(String(id));
    if (!user) return null;
    return { ...user };
  }

  async create(userData) {
    const normalized = userData.username.trim().toLowerCase();
    // Unique check
    for (const u of this.users.values()) {
      if (u.username === normalized) {
        const err = new Error('E11000 duplicate key error: username already exists');
        err.code = 11000;
        throw err;
      }
    }

    const id = 'mem_' + Math.random().toString(36).substring(2, 11);
    const user = {
      _id: id,
      id,
      fullName: userData.fullName.trim(),
      username: normalized,
      dob: new Date(userData.dob),
      gender: userData.gender.trim().toLowerCase(),
      badges: Array.isArray(userData.badges) ? [...userData.badges] : [],
      highScore: Number(userData.highScore) || 0,
      insaneUnlocked: Boolean(userData.insaneUnlocked),
      passwordHash: userData.passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.users.set(id, user);

    // Return sanitized object
    const sanitized = { ...user };
    delete sanitized.passwordHash;
    return sanitized;
  }

  async updateProgress(id, { badges, highScore, insaneUnlocked }) {
    const user = this.users.get(String(id));
    if (!user) return null;
    if (Array.isArray(badges)) {
      const current = new Set(user.badges || []);
      badges.forEach(b => current.add(b));
      user.badges = Array.from(current);
    }
    if (typeof highScore === 'number') {
      user.highScore = Math.max(user.highScore || 0, highScore);
    }
    if (insaneUnlocked === true) {
      user.insaneUnlocked = true;
    }
    user.updatedAt = new Date();
    const sanitized = { ...user };
    delete sanitized.passwordHash;
    return sanitized;
  }
}

export const memoryUserStore = new MemoryUserStore();

/**
 * Universal User accessor — enforces real MongoDB when configured or in production.
 * In-memory fallback is strictly permitted ONLY during tests or offline development
 * when MONGODB_URI is intentionally unset.
 */
export const User = {
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

  async findByUsername(username, includePassword = false) {
    this.checkConnection();
    const normalized = (username || '').trim().toLowerCase();
    if (this.isUsingMongo()) {
      const query = MongoUserModel.findOne({ username: normalized });
      if (includePassword) {
        query.select('+passwordHash');
      }
      return await query.exec();
    } else {
      const user = await memoryUserStore.findOne({ username: normalized });
      if (!user) return null;
      if (!includePassword) {
        const copy = { ...user };
        delete copy.passwordHash;
        return copy;
      }
      return user;
    }
  },

  async findById(id) {
    this.checkConnection();
    if (this.isUsingMongo()) {
      return await MongoUserModel.findById(id).exec();
    } else {
      const user = await memoryUserStore.findById(id);
      if (!user) return null;
      const copy = { ...user };
      delete copy.passwordHash;
      return copy;
    }
  },

  async create(userData) {
    this.checkConnection();
    const normalized = (userData.username || '').trim().toLowerCase();
    const cleanGender = String(userData.gender || '').trim().toLowerCase();
    if (this.isUsingMongo()) {
      const doc = new MongoUserModel({
        ...userData,
        username: normalized,
        gender: cleanGender
      });
      const saved = await doc.save();
      return saved.toJSON();
    } else {
      return await memoryUserStore.create({
        ...userData,
        username: normalized,
        gender: cleanGender
      });
    }
  },

  async updateProgress(id, { badges, highScore, insaneUnlocked }) {
    this.checkConnection();
    if (this.isUsingMongo()) {
      const update = {};
      if (Array.isArray(badges) && badges.length > 0) {
        update.$addToSet = { badges: { $each: badges } };
      }
      if (typeof highScore === 'number') {
        update.$max = { highScore: Math.max(0, highScore) };
      }
      if (insaneUnlocked === true) {
        update.$set = { ...(update.$set || {}), insaneUnlocked: true };
      }
      const updated = await MongoUserModel.findByIdAndUpdate(id, update, { returnDocument: 'after' });
      return updated ? updated.toJSON() : null;
    } else {
      return await memoryUserStore.updateProgress(id, { badges, highScore, insaneUnlocked });
    }
  }
};

