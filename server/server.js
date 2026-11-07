/**
 * MindRush — Production & Local Server Entry Point
 */

import dotenv from 'dotenv';
dotenv.config();

import { connectDB } from './db.js';
import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;

async function startServer() {
  // Connect to MongoDB Atlas (or graceful in-memory fallback)
  await connectDB(process.env.MONGODB_URI);

  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 MindRush Server running at http://localhost:${PORT}`);
    console.log(`📡 Auth API: http://localhost:${PORT}/api/auth`);
    console.log(`🎮 Dashboard: http://localhost:${PORT}/dashboard.html`);
    console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`====================================================`);
  });

  return server;
}

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { startServer };
