/**
 * MindRush — Administrative Security & CSRF Middleware
 * 
 * Protects administrative routes by:
 * 1. Preserving session authentication (req.session.userId).
 * 2. Enforcing administrator role check (user.role === 'admin').
 * 3. Enforcing configurable Origin validation against untrusted external origins.
 * 4. Requiring custom CSRF header (X-Requested-With: MindRush-Admin) for state-changing requests.
 */

import { User } from '../models/User.js';

export function getAllowedOriginPatterns() {
  const patterns = [
    /^https?:\/\/localhost(:[0-9]+)?$/,
    /^https?:\/\/127\.0\.0\.1(:[0-9]+)?$/
  ];

  const configured = process.env.ADMIN_ALLOWED_ORIGINS;
  if (configured && typeof configured === 'string') {
    configured.split(',').map(s => s.trim()).filter(Boolean).forEach(orig => {
      try {
        // Escape regex special chars while translating * to wildcard subdomain/host matcher
        const escaped = orig
          .replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&')
          .replace(/\*/g, '[a-zA-Z0-9.-]+');
        patterns.push(new RegExp(`^${escaped}$`));
      } catch (e) {
        patterns.push(new RegExp(`^${orig}$`));
      }
    });
  }

  return patterns;
}

export function isOriginAllowed(originUrl) {
  if (!originUrl || typeof originUrl !== 'string') return false;
  const patterns = getAllowedOriginPatterns();
  return patterns.some(pattern => pattern.test(originUrl.trim()));
}

export async function requireAdmin(req, res, next) {
  // 1. Session Authentication Check
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Active administrator session required.'
    });
  }

  try {
    // 2. Fetch User and verify 'admin' role
    const user = await User.findById(req.session.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'ADMIN_REQUIRED',
        message: 'Access denied: Administrator privileges required.'
      });
    }

    // 3. Origin & CSRF Defense for State-Changing Requests
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());

    if (isStateChanging) {
      // Validate Origin header if present
      const origin = req.headers.origin;
      if (origin) {
        if (!isOriginAllowed(origin)) {
          return res.status(403).json({
            success: false,
            error: 'ORIGIN_FORBIDDEN',
            message: 'Cross-origin request rejected from untrusted origin.'
          });
        }
      } else if (req.headers.referer) {
        // Fallback: validate Referer origin if present
        try {
          const refererOrigin = new URL(req.headers.referer).origin;
          if (!isOriginAllowed(refererOrigin)) {
            return res.status(403).json({
              success: false,
              error: 'ORIGIN_FORBIDDEN',
              message: 'Cross-origin request rejected from untrusted referer origin.'
            });
          }
        } catch (e) {
          // If referer is unparseable, reject
          return res.status(403).json({
            success: false,
            error: 'ORIGIN_FORBIDDEN',
            message: 'Malformed referer header rejected.'
          });
        }
      }

      // Validate Custom CSRF Header
      const customHeader = req.headers['x-requested-with'];
      if (!customHeader || customHeader !== 'MindRush-Admin') {
        return res.status(403).json({
          success: false,
          error: 'CSRF_HEADER_REQUIRED',
          message: 'Missing or invalid CSRF verification header (X-Requested-With: MindRush-Admin).'
        });
      }
    }

    // Attach authenticated administrator to request context
    req.adminUser = user;
    next();
  } catch (err) {
    console.error('[SECURITY] Error during requireAdmin authorization:', err);
    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'Failed to authorize administrative request.'
    });
  }
}
