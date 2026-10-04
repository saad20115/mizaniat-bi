/**
 * Authentication routes for Mizaniat BI
 * Handles admin login, viewer login, and viewer management
 */
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { getDb } = require('../db/connection');
const {
  generateAdminToken,
  requireAdmin,
  hashPassword,
  verifyPassword
} = require('../middleware/auth');

// ===== RATE LIMITING (5 failed attempts per IP / 15 minutes) =====
const FAILED_LOGIN_LIMIT = 5;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const failedAttempts = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = failedAttempts.get(ip) || [];
  const recent = timestamps.filter(t => (now - t) < FAILED_LOGIN_WINDOW_MS);
  failedAttempts.set(ip, recent);
  return recent.length >= FAILED_LOGIN_LIMIT;
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const timestamps = failedAttempts.get(ip) || [];
  timestamps.push(now);
  failedAttempts.set(ip, timestamps);
}

function clearFailedAttempts(ip) {
  failedAttempts.delete(ip);
}

// ===== ADMIN AUTH =====

// Admin login
router.post('/admin/login', (req, res) => {
  try {
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    if (isRateLimited(clientIp)) {
      return res.status(429).json({
        error: 'تم تجاوز عدد محاولات الدخول المسموح بها، يرجى المحاولة بعد 15 دقيقة',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
    }

    const db = getDb();
    const admin = db.prepare('SELECT * FROM admin_users WHERE email = ? AND is_active = 1').get(email.toLowerCase().trim());

    if (!admin || !verifyPassword(password, admin.password_hash)) {
      recordFailedAttempt(clientIp);
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    clearFailedAttempts(clientIp);

    // Update last login
    db.prepare("UPDATE admin_users SET last_login = datetime('now') WHERE id = ?").run(admin.id);

    const token = generateAdminToken(admin);
    res.json({
      success: true,
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name, role: 'admin' }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get current admin info
router.get('/admin/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

// Change admin password
router.put('/admin/password', requireAdmin, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'كلمة المرور الحالية والجديدة مطلوبتان' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل' });
    }

    const db = getDb();
    const admin = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(req.admin.id);

    if (!verifyPassword(currentPassword, admin.password_hash)) {
      return res.status(401).json({ error: 'كلمة المرور الحالية غير صحيحة' });
    }

    db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?')
      .run(hashPassword(newPassword), req.admin.id);

    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== VIEWER AUTH =====

// Viewer login (phone number) — creates a 32-byte session token in viewer_sessions (12h expiration)
router.post('/viewer/login', (req, res) => {
  try {
    const clientIp = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    if (isRateLimited(clientIp)) {
      return res.status(429).json({
        error: 'تم تجاوز عدد محاولات الدخول المسموح بها، يرجى المحاولة بعد 15 دقيقة',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }

    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'رقم الجوال مطلوب' });
    }

    // Normalize phone: remove spaces, dashes, parentheses
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '').trim();

    const db = getDb();
    const viewer = db.prepare('SELECT * FROM allowed_viewers WHERE phone = ? AND is_active = 1').get(normalizedPhone);

    if (!viewer) {
      recordFailedAttempt(clientIp);
      return res.status(401).json({ error: 'رقم الجوال غير مسجل — تواصل مع المسؤول' });
    }

    clearFailedAttempts(clientIp);

    // Generate secure 32-byte crypto hex token
    const token = crypto.randomBytes(32).toString('hex');

    // Create session row (12h expiration)
    db.prepare(`
      INSERT INTO viewer_sessions (phone, token, expires_at)
      VALUES (?, ?, datetime('now', '+12 hours'))
    `).run(normalizedPhone, token);

    res.json({
      success: true,
      token,
      viewer: {
        id: viewer.id,
        phone: viewer.phone,
        name: viewer.name || 'مشاهد',
        role: 'viewer'
      }
    });
  } catch (err) {
    console.error('Viewer login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Verify viewer token
router.get('/viewer/verify', (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = (authHeader && authHeader.startsWith('Bearer ')) ? authHeader.substring(7) : null;
    const viewerToken = req.headers['x-viewer-token'] || bearerToken;
    if (!viewerToken) {
      return res.status(401).json({ valid: false });
    }

    const db = getDb();
    const session = db.prepare(`
      SELECT vs.*, av.id as viewer_id, av.name as viewer_name, av.is_active
      FROM viewer_sessions vs
      INNER JOIN allowed_viewers av ON av.phone = vs.phone
      WHERE vs.token = ? AND vs.expires_at > datetime('now') AND av.is_active = 1
    `).get(viewerToken);

    if (!session) {
      return res.status(401).json({ valid: false });
    }

    res.json({
      valid: true,
      phone: session.phone,
      name: session.viewer_name || session.phone,
      role: 'viewer',
      viewer: {
        id: session.viewer_id,
        phone: session.phone,
        name: session.viewer_name || session.phone,
        role: 'viewer'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== VIEWER MANAGEMENT (Admin only) =====

// List all allowed viewers
router.get('/viewers', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const viewers = db.prepare(`
      SELECT av.*, au.email as created_by_email
      FROM allowed_viewers av
      LEFT JOIN admin_users au ON au.id = av.created_by
      ORDER BY av.created_at DESC
    `).all();
    res.json(viewers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add viewer
router.post('/viewers', requireAdmin, (req, res) => {
  try {
    const { phone, name } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'رقم الجوال مطلوب' });
    }

    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '').trim();
    const db = getDb();

    // Check duplicate
    const existing = db.prepare('SELECT id FROM allowed_viewers WHERE phone = ?').get(normalizedPhone);
    if (existing) {
      return res.status(409).json({ error: 'رقم الجوال مسجل مسبقاً' });
    }

    const result = db.prepare('INSERT INTO allowed_viewers (phone, name, created_by) VALUES (?, ?, ?)')
      .run(normalizedPhone, name || '', req.admin.id);

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update viewer
router.put('/viewers/:id', requireAdmin, (req, res) => {
  try {
    const { phone, name, is_active } = req.body;
    const db = getDb();

    const normalizedPhone = phone ? phone.replace(/[\s\-\(\)]/g, '').trim() : null;

    db.prepare(`
      UPDATE allowed_viewers SET
        phone = COALESCE(?, phone),
        name = COALESCE(?, name),
        is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(normalizedPhone, name, is_active, req.params.id);

    // S-fix2: Invalidate active sessions immediately if viewer is deactivated
    if (is_active !== undefined && (is_active === 0 || is_active === false || is_active === '0')) {
      const viewer = db.prepare('SELECT phone FROM allowed_viewers WHERE id = ?').get(req.params.id);
      if (viewer) {
        db.prepare('DELETE FROM viewer_sessions WHERE phone = ?').run(viewer.phone);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete viewer
router.delete('/viewers/:id', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    // Also clean up sessions
    const viewer = db.prepare('SELECT phone FROM allowed_viewers WHERE id = ?').get(req.params.id);
    if (viewer) {
      db.prepare('DELETE FROM viewer_sessions WHERE phone = ?').run(viewer.phone);
    }
    db.prepare('DELETE FROM allowed_viewers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Periodic cleanup of expired sessions and stale rate limit timestamps
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const cleanupTimer = setInterval(() => {
  try {
    const db = getDb();
    db.prepare("DELETE FROM viewer_sessions WHERE expires_at <= datetime('now')").run();
  } catch (e) {}

  const now = Date.now();
  for (const [ip, timestamps] of failedAttempts.entries()) {
    const recent = timestamps.filter(t => (now - t) < FAILED_LOGIN_WINDOW_MS);
    if (recent.length === 0) failedAttempts.delete(ip);
    else failedAttempts.set(ip, recent);
  }
}, CLEANUP_INTERVAL_MS);
if (cleanupTimer.unref) cleanupTimer.unref();

router._clearRateLimits = clearFailedAttempts;

module.exports = router;
