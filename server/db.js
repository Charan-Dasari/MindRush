/**
 * MindRush — Database Connection & Session Store Configuration
 * Configures MongoDB Atlas with Mongoose and production connect-mongo session store.
 */

import mongoose from 'mongoose';
import MongoStore from 'connect-mongo';

let mongoConnected = false;

/**
 * Sanitizes MongoDB connection URIs to prevent exposing passwords in logs
 * @param {string} rawUri 
 * @returns {string}
 */
export function sanitizeMongoUri(rawUri) {
  if (!rawUri || typeof rawUri !== 'string') return '';
  return rawUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
}

/**
 * Normalizes Atlas MongoDB URIs to use the canonical 'MindRush' database name
 * Prevents MongoServerError: db already exists with different case [MindRush] vs [mindrush]
 * @param {string} rawUri 
 * @returns {string}
 */
export function normalizeMongoUri(rawUri) {
  if (!rawUri || typeof rawUri !== 'string') return rawUri;
  const isAtlas = rawUri.includes('.mongodb.net') || rawUri.startsWith('mongodb+srv://');
  if (isAtlas) {
    const match = rawUri.match(/(\/[^/?]+)(\?|$)/);
    if (match && match[1].toLowerCase() === '/mindrush') {
      return rawUri.replace(match[1], '/MindRush');
    }
  }
  return rawUri;
}

/**
 * Connect to MongoDB Atlas or local MongoDB instance
 * @param {string} uri 
 * @returns {Promise<boolean>}
 */
export async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[MindRush DB] Fatal: Production deployment requires a valid MONGODB_URI. In-memory mode is strictly forbidden in production.');
    }
    console.warn('[MindRush DB] No MONGODB_URI provided. Operating in local in-memory mode for development and testing.');
    mongoConnected = false;
    return false;
  }

  const normalized = normalizeMongoUri(uri);
  const sanitized = sanitizeMongoUri(normalized);
  const isAtlas = normalized.includes('.mongodb.net') || normalized.startsWith('mongodb+srv://');
  const targetLabel = isAtlas ? 'MongoDB Atlas cluster' : 'MongoDB instance';

  try {
    await mongoose.connect(normalized, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });
    mongoConnected = true;
    console.log(`[MindRush DB] Successfully connected to ${targetLabel} (${sanitized}) [Database: ${mongoose.connection.name}].`);
    return true;
  } catch (err) {
    mongoConnected = false;
    const cleanMsg = sanitizeMongoUri(err.message);
    console.error(`[MindRush DB] Failed to connect to ${targetLabel}:`, cleanMsg);
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`[MindRush DB] Production database connection failed: ${cleanMsg}`);
    }
    return false;
  }
}

/**
 * Disconnect from MongoDB Atlas
 */
export async function disconnectDB() {
  if (mongoose.connection && mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    mongoConnected = false;
  }
}

/**
 * Build the session store
 * In production or with MongoDB Atlas configured, uses connect-mongo (MongoStore).
 * Explicitly synchronizes the database name with the normalized URI to prevent DatabaseDifferCase errors.
 * In development or testing without a MongoDB URI, falls back to MemoryStore.
 * @returns {object} Session store instance
 */
export function getSessionStore() {
  const uri = normalizeMongoUri(process.env.MONGODB_URI);

  const buildStoreOptions = () => {
    return {
      mongoUrl: uri,
      collectionName: 'sessions',
      ttl: 7 * 24 * 60 * 60, // 7 days
      autoRemove: 'native'
    };
  };

  if (process.env.NODE_ENV === 'production') {
    if (!uri) {
      throw new Error('[MindRush Session] Production deployment requires MONGODB_URI for MongoStore session persistence. In-memory sessions are strictly forbidden in production.');
    }
    return MongoStore.create(buildStoreOptions());
  }

  if (uri && (mongoConnected || uri.startsWith('mongodb'))) {
    try {
      console.log(`[MindRush Session] Initializing MongoStore for persistent session storage (Database: ${mongoose.connection?.name || 'MindRush'}).`);
      return MongoStore.create(buildStoreOptions());
    } catch (err) {
      console.error('[MindRush Session] Failed to initialize MongoStore:', err.message);
      if (process.env.NODE_ENV === 'production') {
        throw err;
      }
    }
  }

  console.log('[MindRush Session] Operating in local development/test session mode.');
  return undefined; // express-session defaults to MemoryStore when store is undefined
}

export function isMongoConnected() {
  return mongoConnected && mongoose.connection.readyState === 1;
}
