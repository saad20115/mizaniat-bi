/**
 * Authentication middleware for Mizaniat BI
 * Two layers: Admin (JWT) and Viewer (session token)
 */
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/connection');

// Secret key for JWT — in production, use env variable
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
 * Middleware: require admin authentication
 */
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'غير مصرح — يرجى تسجيل الدخول', code: 'UNAUTHORIZED' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded || decoded.role !== 'admin') {
    return res.status(401).json({ error: 'جلسة غير صالحة — يرجى إعادة تسجيل الدخول', code: 'INVALID_TOKEN' });
  }

  // Verify admin still exists and is active
  const db = getDb();
  const admin = db.prepare('SELECT id, email, name, is_active FROM admin_users WHERE id = ?').get(decoded.id);
  if (!admin || !admin.is_active) {
    return res.status(401).json({ error: 'الحساب غير نشط', code: 'ACCOUNT_DISABLED' });
  }

  req.admin = admin;
  next();
}

/**
 * Middleware: require viewer authentication
 * Checks for viewer token in Authorization header or query param
 */
function requireViewer(req, res, next) {
  // Admin tokens also work for viewer routes
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (decoded && decoded.role === 'admin') {
      req.admin = decoded;
      return next();
    }
  }

  // Check viewer token
  const viewerToken = req.headers['x-viewer-token'] || req.query.viewerToken;
  if (!viewerToken) {
    return res.status(401).json({ error: 'يرجى تسجيل الدخول برقم الجوال', code: 'VIEWER_UNAUTHORIZED' });
  }

  const db = getDb();
  const session = db.prepare(
    "SELECT * FROM viewer_sessions WHERE token = ? AND expires_at > datetime('now')"
  ).get(viewerToken);

  if (!session) {
    return res.status(401).json({ error: 'انتهت صلاحية الجلسة — يرجى إعادة الدخول', code: 'VIEWER_SESSION_EXPIRED' });
  }

  req.viewer = { phone: session.phone };
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
  requireAdmin,
  requireViewer,
  hashPassword,
  verifyPassword
};
