/**
 * MindRush — Authentication Routes
 * API Endpoints:
 * - POST /api/auth/signup  : Register new cadet
 * - POST /api/auth/login   : Authenticate cadet session
 * - POST /api/auth/logout  : Invalidate session and clear cookie
 * - GET  /api/auth/me      : Inspect current active session
 */

import { Router } from 'express';
import { User } from '../models/User.js';
import { hashPassword, verifyPassword, validateSignupPayload } from '../utils/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';

const router = Router();

/**
 * POST /api/auth/signup
 * Create a new user account with Argon2id hash and establish session
 */
router.post('/signup', authRateLimiter, async (req, res) => {
  try {
    const { fullName, username, dob, gender, password, confirmPassword, terms } = req.body || {};

    // 1. Strict validation
    const validation = validateSignupPayload({
      fullName,
      username,
      dob,
      gender,
      password,
      confirmPassword,
      terms
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.errors[0],
        errors: validation.errors
      });
    }

    const normalizedUsername = username.trim().toLowerCase();

    // 2. Pre-check for duplicate username
    const existing = await User.findByUsername(normalizedUsername);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Username is already taken. Please choose another username.'
      });
    }

    // 3. Hash password using Argon2id
    const passwordHash = await hashPassword(password);

    // 4. Create user in database
    let newUser;
    try {
      newUser = await User.create({
        fullName: fullName.trim(),
        username: normalizedUsername,
        dob: new Date(dob),
        gender: String(gender).trim().toLowerCase(),
        passwordHash
      });
    } catch (dbErr) {
      // Catch MongoDB unique index collision (E11000)
      if (dbErr.code === 11000 || (dbErr.message && dbErr.message.includes('11000'))) {
        return res.status(409).json({
          success: false,
          error: 'Username is already registered. Please choose another username.'
        });
      }
      throw dbErr;
    }

    // 5. Establish authenticated session
    const cleanGender = String(gender).trim().toLowerCase();
    const sessionUser = {
      id: newUser._id || newUser.id,
      fullName: newUser.fullName,
      username: newUser.username,
      gender: cleanGender,
      dob: newUser.dob
    };

    req.session.userId = sessionUser.id;
    req.session.user = sessionUser;

    return res.status(201).json({
      success: true,
      message: 'Cadet profile created successfully! Telemetry initialized.',
      user: sessionUser
    });
  } catch (err) {
    console.error('[MindRush Auth] Signup error:', err.message);
    if (err.status === 503 || err.name === 'MongooseError' || err.name === 'MongoServerSelectionError' || err.name === 'MongoNetworkError') {
      return res.status(503).json({
        success: false,
        error: 'Mission database connection unavailable. Please check your MongoDB configuration.'
      });
    }
    return res.status(500).json({
      success: false,
      error: 'An internal mission control error occurred during registration. Please try again.'
    });
  }
});

/**
 * POST /api/auth/login
 * Verify credentials and establish session
 */
router.post('/login', authRateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and passcode are both required.'
      });
    }

    const normalized = username.trim().toLowerCase();

    // 1. Fetch user including password hash
    const user = await User.findByUsername(normalized, true);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or security passcode.'
      });
    }

    // 2. Verify password with Argon2id
    const isMatch = await verifyPassword(user.passwordHash, password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or security passcode.'
      });
    }

    // 3. Session fixation protection: regenerate session ID
    req.session.regenerate((err) => {
      if (err) {
        console.error('[MindRush Auth] Session regenerate error:', err);
        return res.status(500).json({
          success: false,
          error: 'Failed to initialize session. Please try logging in again.'
        });
      }

      const sessionUser = {
        id: user._id || user.id,
        fullName: user.fullName,
        username: user.username,
        gender: user.gender,
        dob: user.dob
      };

      req.session.userId = sessionUser.id;
      req.session.user = sessionUser;

      return res.status(200).json({
        success: true,
        message: `Welcome back, Cadet ${sessionUser.fullName}! Access granted.`,
        user: sessionUser
      });
    });
  } catch (err) {
    console.error('[MindRush Auth] Login error:', err.message);
    if (err.status === 503 || err.name === 'MongooseError' || err.name === 'MongoServerSelectionError' || err.name === 'MongoNetworkError') {
      return res.status(503).json({
        success: false,
        error: 'Mission database connection unavailable. Please check your MongoDB configuration.'
      });
    }
    return res.status(500).json({
      success: false,
      error: 'Authentication failed due to server error. Please try again.'
    });
  }
});

/**
 * POST /api/auth/logout
 * Invalidate server-side session and clear cookie
 */
router.post('/logout', (req, res) => {
  if (!req.session) {
    res.clearCookie('mindrush.sid');
    return res.json({ success: true, message: 'Logged out successfully.' });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('[MindRush Auth] Logout session destruction error:', err);
      return res.status(500).json({
        success: false,
        error: 'Error terminating session.'
      });
    }
    res.clearCookie('mindrush.sid', { path: '/' });
    return res.status(200).json({
      success: true,
      message: 'Cadet logged out successfully. Mission session closed.'
    });
  });
});

/**
 * GET /api/auth/me
 * Check current authentication state and retrieve cadet profile
 */
router.get('/me', async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        authenticated: false,
        user: null,
        error: 'No active cadet session found.'
      });
    }

    const user = await User.findById(req.session.userId);
    if (!user) {
      // User was deleted or no longer exists
      req.session.destroy(() => {});
      res.clearCookie('mindrush.sid');
      return res.status(401).json({
        authenticated: false,
        user: null,
        error: 'Station session expired or cadet record not found.'
      });
    }

    return res.status(200).json({
      authenticated: true,
      user: {
        id: user._id || user.id,
        fullName: user.fullName,
        username: user.username,
        gender: user.gender,
        dob: user.dob,
        badges: user.badges || [],
        highScore: user.highScore || 0,
        insaneUnlocked: Boolean(user.insaneUnlocked),
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('[MindRush Auth] /me error:', err);
    return res.status(500).json({
      authenticated: false,
      error: 'Failed to verify session telemetry.'
    });
  }
});

export default router;
