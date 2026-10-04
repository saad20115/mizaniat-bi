/**
 * Authentication middleware for Mizaniat BI
 * Two layers: Admin (JWT) and Viewer (session token)
 * Extensible for Odoo IdP in the future.
 */
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/connection');

// Secret key for JWT — in production, use env variable
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is required in production mode!');
    process.exit(1);
  }
  console.warn('[SECURITY WARNING] JWT_SECRET is not set in environment variables! Using default fallback secret.');
}
const JWT_SECRET = process.env.JWT_SECRET || 'mizaniat-bi-secret-key-2026';
const JWT_EXPIRES = '7d';

/**
 * Generate JWT token for admin
 */
function generateAdminToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, role: 'admin' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

/**
 * Central identity resolver: extracts and authenticates credentials from request.
 * Returns { userType: 'admin'|'viewer', userId, displayName, role: 'admin'|'viewer' } or null.
 * Pluggable for future IdPs (e.g. Odoo).
 */
function resolveUser(req) {
  const db = getDb();

  // 1. Check Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded && decoded.role === 'admin') {
      const admin = db.prepare('SELECT id, email, name, is_active FROM admin_users WHERE id = ?').get(decoded.id);
      if (admin && admin.is_active) {
        return {
          userType: 'admin',
          userId: admin.id,
          displayName: admin.name || admin.email,
          email: admin.email,
          role: 'admin',
          admin
        };
      }
    }

    // Check if Bearer token is a viewer session token
    const vSession = db.prepare(
      "SELECT vs.*, av.id as viewer_id, av.name as viewer_name, av.is_active FROM viewer_sessions vs INNER JOIN allowed_viewers av ON av.phone = vs.phone WHERE vs.token = ? AND vs.expires_at > datetime('now') AND av.is_active = 1"
    ).get(token);
    if (vSession) {
      return {
        userType: 'viewer',
        userId: vSession.viewer_id || vSession.phone,
        displayName: vSession.viewer_name || vSession.phone,
        phone: vSession.phone,
        role: 'viewer',
        viewer: { id: vSession.viewer_id, phone: vSession.phone, name: vSession.viewer_name }
      };
    }
  }

  // 2. Check x-viewer-token (query param token is intentionally disallowed for security)
  const viewerToken = req.headers['x-viewer-token'];
  if (viewerToken) {
    const vSession = db.prepare(
      "SELECT vs.*, av.id as viewer_id, av.name as viewer_name, av.is_active FROM viewer_sessions vs INNER JOIN allowed_viewers av ON av.phone = vs.phone WHERE vs.token = ? AND vs.expires_at > datetime('now') AND av.is_active = 1"
    ).get(viewerToken);
    if (vSession) {
      return {
        userType: 'viewer',
        userId: vSession.viewer_id || vSession.phone,
        displayName: vSession.viewer_name || vSession.phone,
        phone: vSession.phone,
        role: 'viewer',
        viewer: { id: vSession.viewer_id, phone: vSession.phone, name: vSession.viewer_name }
      };
    }
  }

  return null;
}

/**
 * Middleware: require admin authentication
 */
function requireAdmin(req, res, next) {
  const user = resolveUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(401).json({ error: 'غير مصرح — يرجى تسجيل الدخول كمسؤول', code: 'UNAUTHORIZED' });
  }

  req.user = user;
  req.admin = user.admin;
  next();
}

/**
 * Middleware: require viewer authentication
 * Allows both admin and viewer to access viewer-permitted routes
 */
function requireViewer(req, res, next) {
  const user = resolveUser(req);
  if (!user) {
    return res.status(401).json({ error: 'يرجى تسجيل الدخول برقم الجوال', code: 'VIEWER_UNAUTHORIZED' });
  }

  req.user = user;
  if (user.role === 'admin') {
    req.admin = user.admin;
  }
  if (user.role === 'viewer') {
    req.viewer = user.viewer;
  }
  next();
}

/**
 * Hash a password using crypto (no bcrypt needed)
 */
function hashPassword(password) {
  const crypto = require('crypto');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a hash
 */
function verifyPassword(password, storedHash) {
  const crypto = require('crypto');
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

module.exports = {
  JWT_SECRET,
  generateAdminToken,
  verifyToken,
  resolveUser,
  requireAdmin,
  requireViewer,
  hashPassword,
  verifyPassword
};
