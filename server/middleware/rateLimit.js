/**
 * MindRush — Rate Limiting Middleware
 * Protects authentication endpoints from brute-force and DDoS attacks.
 */

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for sensitive auth routes (/api/auth/signup, /api/auth/login)
 * Allows up to 25 attempts per 15 minutes per IP address.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // limit each IP to 25 requests per windowMs
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests from this station. Please wait 15 minutes before retrying.'
  },
  skip: (req) => {
    // Skip rate limiting in automated testing environment
    return process.env.NODE_ENV === 'test' || req.headers['x-test-suite'] === 'true';
  }
});
