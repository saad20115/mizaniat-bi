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

// ===== ADMIN AUTH =====

// Admin login
router.post('/admin/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
    }

    const db = getDb();
    const admin = db.prepare('SELECT * FROM admin_users WHERE email = ? AND is_active = 1').get(email.toLowerCase().trim());

    if (!admin) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    if (!verifyPassword(password, admin.password_hash)) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    // Update last login
    db.prepare("UPDATE admin_users SET last_login = datetime('now') WHERE id = ?").run(admin.id);

    const token = generateAdminToken(admin);
    res.json({
      success: true,
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name }
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

// Viewer login (phone number) — generates a real admin JWT for full access
router.post('/viewer/login', (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'رقم الجوال مطلوب' });
    }

    // Normalize phone: remove spaces, dashes
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '').trim();

    const db = getDb();
    const viewer = db.prepare('SELECT * FROM allowed_viewers WHERE phone = ? AND is_active = 1').get(normalizedPhone);

    if (!viewer) {
      return res.status(401).json({ error: 'رقم الجوال غير مسجل — تواصل مع المسؤول' });
    }

    // Get the first active admin to generate a JWT with admin privileges
    const admin = db.prepare('SELECT * FROM admin_users WHERE is_active = 1 LIMIT 1').get();
    if (!admin) {
      return res.status(500).json({ error: 'لا يوجد حساب مدير نشط في النظام' });
    }

    // Generate a real admin JWT — viewer gets full admin API access
    const token = generateAdminToken(admin);

    res.json({
      success: true,
      token,
      admin: { id: admin.id, email: admin.email, name: viewer.name || 'مشاهد' }
    });
  } catch (err) {
    console.error('Viewer login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Verify viewer token
router.get('/viewer/verify', (req, res) => {
  try {
    const viewerToken = req.headers['x-viewer-token'] || req.query.token;
    if (!viewerToken) {
      return res.status(401).json({ valid: false });
    }

    const db = getDb();
    const session = db.prepare(
      "SELECT vs.*, av.name FROM viewer_sessions vs LEFT JOIN allowed_viewers av ON av.phone = vs.phone WHERE vs.token = ? AND vs.expires_at > datetime('now')"
    ).get(viewerToken);

    if (!session) {
      return res.status(401).json({ valid: false });
    }

    res.json({ valid: true, phone: session.phone, name: session.name });
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

module.exports = router;
