/**
 * MindRush — Express Application Setup
 * Configures middleware, sessions, CORS, auth API routes, and static asset serving.
 */

import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import progressRoutes from './routes/progress.js';
import { getSessionStore } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.resolve(__dirname, '..', 'public');

export function createApp() {
  const app = express();

  // Trust reverse proxy (for secure cookies behind Nginx, Render, Heroku, etc.)
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Middleware
  app.use(cors({
    origin: true,
    credentials: true
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Session configuration
  const sessionConfig = {
    name: 'mindrush.sid',
    secret: process.env.SESSION_SECRET || 'mindrush_cosmic_space_secret_key_2026',
    resave: false,
    saveUninitialized: false,
    store: getSessionStore(),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  };

  app.use(session(sessionConfig));

  // Health and Telemetry endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'operational',
      mission: 'MindRush Flight Deck',
      timestamp: new Date().toISOString()
    });
  });

  // Mount Authentication API routes
  app.use('/api/auth', authRoutes);

  // Mount Progress & Leaderboard API routes
  app.use('/api', progressRoutes);

  // Serve static game and UI files from /public
  app.use(express.static(publicPath));

  // Serve SpaceShooterGFX sprite assets directly
  const spaceShooterPath = path.resolve(__dirname, '..', 'SpaceShooterGFX');
  app.use('/SpaceShooterGFX', express.static(spaceShooterPath));

  // Client-side fallback for static assets
  app.get('/login', (req, res) => {
    res.sendFile(path.join(publicPath, 'login.html'));
  });

  app.get('/signup', (req, res) => {
    res.sendFile(path.join(publicPath, 'register.html'));
  });

  app.get('/register', (req, res) => {
    res.sendFile(path.join(publicPath, 'register.html'));
  });

  app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(publicPath, 'dashboard.html'));
  });

  return app;
}
