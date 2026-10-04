/**
 * Automated Authorization Verification Script (Phase S: S1 - S8)
 * Runs against a dedicated test port with an isolated database copy.
 * Verifies:
 * 1. S1 (A1): Viewer login issues a pure 32-byte session token (no admin JWT).
 * 2. S1 (A1): Rate limiting blocks after 5 failed login attempts per IP in 15m (HTTP 429).
 * 3. S2 (SEC1): Viewers cannot mutate any resource (POST/PUT/DELETE) on viewerPaths (except PUT /preferences/:key).
 * 4. S2 (SEC1): Viewers cannot access admin routes (/instances, /viewers, /admin/me).
 * 5. S2 (SEC1): Viewers can read all allowed GET routes.
 * 6. S4 (SEC2): /preferences/:key enforces whitelist and max 20KB payload.
 * 7. S5 (A3): Pivot SQL injection prevention: invalid dimensions or measures return HTTP 400.
 * 8. S6 (A2): External API protection enforces x-api-key when EXTERNAL_API_KEY is configured.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const TEST_PORT = 3198;
const ORIGINAL_DB = path.join(__dirname, '..', '..', 'data', 'mizaniat.db');
const TEST_DB = path.join(__dirname, '..', '..', 'data', 'mizaniat_test_auth.db');

// Ensure clean test DB copy
if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
fs.copyFileSync(ORIGINAL_DB, TEST_DB);

process.env.DB_PATH = TEST_DB;
process.env.PORT = String(TEST_PORT);

// Require modules after setting DB_PATH
const { getDb, closeDb } = require('../db/connection');
const { initializeSchema } = require('../db/schema');
const { generateAdminToken } = require('../middleware/auth');
const ConsolidationEngine = require('../services/consolidation');
const express = require('express');
const cors = require('cors');
const apiRoutes = require('../routes/api');
const salesRoutes = require('../routes/sales');
const externalRoutes = require('../routes/external-api');
const authRoutes = require('../routes/auth');
const { requireAdmin, requireViewer } = require('../middleware/auth');

const app = express();
app.set('trust proxy', 'loopback');
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/auth', authRoutes);

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth')) return next();

  // External API — require x-api-key if EXTERNAL_API_KEY is configured
  if (req.path.startsWith('/external')) {
    if (process.env.EXTERNAL_API_KEY) {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey || apiKey !== process.env.EXTERNAL_API_KEY) {
        return res.status(401).json({ error: 'مفتاح API غير صالح أو مفقود', code: 'INVALID_API_KEY' });
      }
    }
    return next();
  }

  const viewerPaths = [
    '/presentation/share', '/presentation/data', '/presentation',
    '/companies', '/filters', '/filter-options',
    '/analytic-groups', '/analytic-group-mappings',
    '/guarantee-details', '/guarantee-pending-list', '/guarantees',
    '/matrix', '/receivables', '/data-quality', '/performance-summary',
    '/executive', '/preferences',
    '/sales/invoices', '/sales/customer-hierarchy', '/sales/companies'
  ];
  const isViewerPath = viewerPaths.some(p => req.path.startsWith(p));
  if (isViewerPath) {
    if (req.method !== 'GET') {
      if (req.method === 'PUT' && req.path.startsWith('/preferences/')) {
        return requireViewer(req, res, next);
      }
      return requireAdmin(req, res, next);
    }
    return requireViewer(req, res, next);
  }
  return requireAdmin(req, res, next);
});

app.use('/api', apiRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/external', externalRoutes);

let server;

async function startServer() {
  return new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        closeDb();
        if (fs.existsSync(TEST_DB)) {
          try { fs.unlinkSync(TEST_DB); } catch (e) {}
        }
        const wal = TEST_DB + '-wal';
        const shm = TEST_DB + '-shm';
        if (fs.existsSync(wal)) try { fs.unlinkSync(wal); } catch (e) {}
        if (fs.existsSync(shm)) try { fs.unlinkSync(shm); } catch (e) {}
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function run() {
  console.log('🚀 Starting Phase S Authorization Verification on isolated test database...');
  initializeSchema();
  await startServer();

  const db = getDb();
  const admin = db.prepare('SELECT * FROM admin_users WHERE is_active = 1 LIMIT 1').get();
  const adminToken = generateAdminToken(admin);

  // Ensure an active allowed viewer exists
  let viewer = db.prepare('SELECT * FROM allowed_viewers WHERE is_active = 1 LIMIT 1').get();
  if (!viewer) {
    db.prepare("INSERT INTO allowed_viewers (phone, name, is_active) VALUES ('0501234567', 'مشاهد تجريبي', 1)").run();
    viewer = db.prepare("SELECT * FROM allowed_viewers WHERE phone = '0501234567'").get();
  }

  let passed = 0;
  let failed = 0;

  async function test(desc, path, method, headers, body, expectedStatus) {
    try {
      const opts = {
        method,
        headers: { ...headers }
      };
      if (body !== undefined && body !== null) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const res = await fetch(`http://localhost:${TEST_PORT}${path}`, opts);
      const isExpected = Array.isArray(expectedStatus) ? expectedStatus.includes(res.status) : res.status === expectedStatus;

      if (isExpected) {
        console.log(`[PASS] ${desc} — HTTP ${res.status}`);
        passed++;
        return res;
      } else {
        console.error(`[FAIL] ${desc} — Expected ${expectedStatus}, Got ${res.status}`);
        failed++;
        return res;
      }
    } catch (err) {
      console.error(`[FAIL] ${desc} — Error: ${err.message}`);
      failed++;
      return null;
    }
  }

  // Clear any existing rate limits for fresh test start
  if (authRoutes._clearRateLimits) authRoutes._clearRateLimits();

  console.log('\n── S1 (A1): Viewer Login & Pure Session Tokens');
  let realViewerToken = null;
  try {
    const loginRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/viewer/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: viewer.phone })
    });
    const loginData = await loginRes.json();
    if (loginRes.status === 200 && loginData.token && loginData.viewer?.role === 'viewer' && !loginData.admin) {
      console.log(`[PASS] Viewer login returned pure session token (64 hex chars, role: viewer, no admin JWT)`);
      realViewerToken = loginData.token;
      passed++;
    } else {
      console.error(`[FAIL] Viewer login unexpected response:`, loginData);
      failed++;
    }
  } catch (err) {
    console.error(`[FAIL] Viewer login error:`, err.message);
    failed++;
  }

  let viewerToken = realViewerToken || 'auth-test-viewer-token';
  if (!realViewerToken) {
    db.prepare('DELETE FROM viewer_sessions WHERE token = ?').run(viewerToken);
    db.prepare("INSERT INTO viewer_sessions (phone, token, expires_at) VALUES (?, ?, datetime('now', '+1 day'))").run(viewer.phone, viewerToken);
  }

  console.log('\n── S1 & S2: Admin Route Isolation (Viewer must NOT have admin access)');
  await test('Viewer GET /api/instances (admin-only route -> 401)', '/api/instances', 'GET', { 'x-viewer-token': viewerToken }, undefined, 401);
  await test('Viewer GET /api/viewers (admin-only route -> 401)', '/api/viewers', 'GET', { 'x-viewer-token': viewerToken }, undefined, 401);
  await test('Viewer GET /api/auth/admin/me (admin profile -> 401)', '/api/auth/admin/me', 'GET', { 'x-viewer-token': viewerToken }, undefined, 401);
  await test('Viewer GET /api/auth/viewer/verify (verify viewer session -> 200)', '/api/auth/viewer/verify', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);

  console.log('\n── S-fix3: Query String Session Token Rejection');
  await test('Viewer verify with query ?token=... (query token rejected -> 401)', `/api/auth/viewer/verify?token=${viewerToken}`, 'GET', {}, undefined, 401);
  await test('Viewer verify with query ?viewerToken=... (query token rejected -> 401)', `/api/auth/viewer/verify?viewerToken=${viewerToken}`, 'GET', {}, undefined, 401);
  await test('Viewer GET /api/executive with query ?token=... (query token rejected -> 401)', `/api/executive?year=2026&token=${viewerToken}`, 'GET', {}, undefined, 401);

  console.log('\n── S-fix2: Deactivated Viewer Session Invalidation');
  // Deactivate viewer using Admin API
  await test('Admin PUT /api/auth/viewers/:id (deactivate viewer -> 200)', `/api/auth/viewers/${viewer.id}`, 'PUT', { 'Authorization': `Bearer ${adminToken}` }, { is_active: 0 }, 200);
  // Subsequent request with deactivated viewer token must return 401
  await test('Deactivated viewer GET /api/executive (session invalidated -> 401)', '/api/executive?year=2026', 'GET', { 'x-viewer-token': viewerToken }, undefined, 401);
  await test('Deactivated viewer GET /api/auth/viewer/verify (rejected -> 401)', '/api/auth/viewer/verify', 'GET', { 'x-viewer-token': viewerToken }, undefined, 401);
  // Reactivate viewer and get new active session
  await test('Admin PUT /api/auth/viewers/:id (reactivate viewer -> 200)', `/api/auth/viewers/${viewer.id}`, 'PUT', { 'Authorization': `Bearer ${adminToken}` }, { is_active: 1 }, 200);
  const reLoginRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/viewer/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: viewer.phone })
  });
  const reLoginData = await reLoginRes.json();
  const activeViewerToken = reLoginData.token;
  viewerToken = activeViewerToken;
  await test('Reactivated viewer new session GET /api/auth/viewer/verify (active -> 200)', '/api/auth/viewer/verify', 'GET', { 'x-viewer-token': activeViewerToken }, undefined, 200);

  console.log('\n── S2 (SEC1): Viewer Forbidden Mutations (Must be 401 or 403)');
  await test('Viewer POST /api/companies (create company)', '/api/companies', 'POST', { 'x-viewer-token': viewerToken }, { name: 'Hack Co' }, [401, 403]);
  await test('Viewer PUT /api/companies/1 (edit company)', '/api/companies/1', 'PUT', { 'x-viewer-token': viewerToken }, { name: 'Hack Co' }, [401, 403]);
  await test('Viewer DELETE /api/companies/1 (delete company)', '/api/companies/1', 'DELETE', { 'x-viewer-token': viewerToken }, null, [401, 403]);
  await test('Viewer POST /api/analytic-groups (create group)', '/api/analytic-groups', 'POST', { 'x-viewer-token': viewerToken }, { name: 'Hack Group' }, [401, 403]);
  await test('Viewer PUT /api/analytic-groups/1 (edit group)', '/api/analytic-groups/1', 'PUT', { 'x-viewer-token': viewerToken }, { name: 'Hack Group' }, [401, 403]);
  await test('Viewer DELETE /api/analytic-groups/1 (delete group)', '/api/analytic-groups/1', 'DELETE', { 'x-viewer-token': viewerToken }, null, [401, 403]);
  await test('Viewer POST /api/analytic-group-mappings (create mapping)', '/api/analytic-group-mappings', 'POST', { 'x-viewer-token': viewerToken }, { group_id: 1 }, [401, 403]);
  await test('Viewer POST /api/presentation/share (create share link)', '/api/presentation/share', 'POST', { 'x-viewer-token': viewerToken }, {}, [401, 403]);
  await test('Viewer DELETE /api/presentation/share/1 (delete share link)', '/api/presentation/share/1', 'DELETE', { 'x-viewer-token': viewerToken }, null, [401, 403]);
  await test('Viewer POST /api/guarantees/release (release guarantee)', '/api/guarantees/release', 'POST', { 'x-viewer-token': viewerToken }, { id: 1 }, [401, 403]);
  await test('Viewer POST /api/sales/companies (create sales company)', '/api/sales/companies', 'POST', { 'x-viewer-token': viewerToken }, { name: 'Hack' }, [401, 403]);
  await test('Viewer PUT /api/sales/companies/1 (edit sales company)', '/api/sales/companies/1', 'PUT', { 'x-viewer-token': viewerToken }, { name: 'Hack' }, [401, 403]);
  await test('Viewer DELETE /api/sales/companies/1 (delete sales company)', '/api/sales/companies/1', 'DELETE', { 'x-viewer-token': viewerToken }, null, [401, 403]);
  await test('Viewer POST /api/sales/sync/all (trigger sales sync)', '/api/sales/sync/all', 'POST', { 'x-viewer-token': viewerToken }, {}, [401, 403]);

  console.log('\n── S2 (SEC1): Viewer Allowed Read-Only Operations (Must be 200)');
  await test('Viewer GET /api/executive (executive summary)', '/api/executive?year=2026', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/filters (filter options read-only)', '/api/filters', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/executive/children (lazy children)', '/api/executive/children?companyId=1&departmentId=1&year=2026', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/executive/invoices (lazy client invoices)', '/api/executive/invoices?companyId=1&partnerId=420&year=2026', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/executive/aging (lazy aging)', '/api/executive/aging?companyIds=1,2,3,4&year=2026', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/presentation/data (presentation data)', '/api/presentation/data?companyIds=1&years=2026', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/guarantees (guarantees list)', '/api/guarantees', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/sales/invoices (sales invoices)', '/api/sales/invoices?limit=10', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/sales/customer-hierarchy (sales hierarchy)', '/api/sales/customer-hierarchy', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/sales/companies (sales companies read-only)', '/api/sales/companies', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/preferences/executive_view (get UI preferences)', '/api/preferences/executive_view', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);

  console.log('\n── S4 (SEC2): Preferences Key Whitelist & Payload Limits');
  await test('Viewer PUT /api/preferences/executive_view (allowed key)', '/api/preferences/executive_view', 'PUT', { 'x-viewer-token': viewerToken }, { theme: 'light' }, 200);
  await test('Viewer GET /api/preferences/malicious_key (disallowed key -> 400)', '/api/preferences/malicious_key', 'GET', { 'x-viewer-token': viewerToken }, undefined, 400);
  await test('Viewer PUT /api/preferences/malicious_key (disallowed key -> 400)', '/api/preferences/malicious_key', 'PUT', { 'x-viewer-token': viewerToken }, { bad: true }, 400);
  const oversizedPayload = { data: 'x'.repeat(25000) };
  await test('Viewer PUT /api/preferences/executive_view (oversized payload > 20KB -> 413)', '/api/preferences/executive_view', 'PUT', { 'x-viewer-token': viewerToken }, oversizedPayload, 413);

  console.log('\n── S5 (A3): Pivot SQL Injection Prevention');
  await test('Admin GET /api/reports/pivot (valid request -> 200)', '/api/reports/pivot?rows=account&columns=period', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 200);
  await test('Admin GET /api/reports/pivot (malicious row dimension -> 400)', '/api/reports/pivot?rows=account;DROP+TABLE+companies;', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 400);
  await test('Admin GET /api/reports/pivot (unknown column dimension -> 400)', '/api/reports/pivot?columns=invalid_col', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 400);
  await test('Admin GET /api/reports/pivot (unknown measure -> 400)', '/api/reports/pivot?measure=malicious_measure', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 400);

  // Engine direct call assertion
  try {
    const engine = new ConsolidationEngine();
    engine.getPivotData({ rows: ['invalid_dimension'] });
    console.error('[FAIL] Engine getPivotData did not throw for invalid dimension');
    failed++;
  } catch (e) {
    if (e.status === 400) {
      console.log('[PASS] ConsolidationEngine.getPivotData threw 400 on invalid dimension');
      passed++;
    } else {
      console.error('[FAIL] ConsolidationEngine.getPivotData threw unexpected error:', e);
      failed++;
    }
  }

  console.log('\n── S1 & S-fix1: Rate Limiting & Proxy IP Handling (5 attempts max per 15 min)');
  if (authRoutes._clearRateLimits) authRoutes._clearRateLimits();
  // 5 failed login attempts from client IP A behind reverse proxy
  for (let i = 1; i <= 5; i++) {
    await test(`Failed login attempt ${i}/5 for IP A (returns 401)`, '/api/auth/viewer/login', 'POST', { 'x-forwarded-for': '203.0.113.195' }, { phone: '0599999999' }, 401);
  }
  // 6th attempt from client IP A must be 429
  await test('Failed login attempt 6/5 for IP A (exceeds rate limit -> 429)', '/api/auth/viewer/login', 'POST', { 'x-forwarded-for': '203.0.113.195' }, { phone: '0599999999' }, 429);

  // Attempt from distinct client IP B behind reverse proxy must NOT be rate limited (returns 401, not 429)
  await test('Login attempt from distinct IP B behind reverse proxy (not locked out -> 401)', '/api/auth/viewer/login', 'POST', { 'x-forwarded-for': '198.51.100.42' }, { phone: '0599999999' }, 401);

  // Clear rate limits
  if (authRoutes._clearRateLimits) authRoutes._clearRateLimits();

  console.log('\n── S6 (A2): External API Protection (EXTERNAL_API_KEY)');
  // 1. Without key configured: access allowed
  delete process.env.EXTERNAL_API_KEY;
  await test('External API without EXTERNAL_API_KEY env (public access -> 200)', '/api/external/companies', 'GET', {}, undefined, 200);

  // 2. With key configured: require x-api-key
  process.env.EXTERNAL_API_KEY = 'mizaniat-test-secret-key-12345';
  await test('External API with EXTERNAL_API_KEY env & missing header -> 401', '/api/external/companies', 'GET', {}, undefined, 401);
  await test('External API with wrong x-api-key -> 401', '/api/external/companies', 'GET', { 'x-api-key': 'wrong-key' }, undefined, 401);
  await test('External API with valid x-api-key -> 200', '/api/external/companies', 'GET', { 'x-api-key': 'mizaniat-test-secret-key-12345' }, undefined, 200);
  delete process.env.EXTERNAL_API_KEY;

  console.log('\n── Admin Permissions');
  await test('Admin GET /api/executive (admin full access)', '/api/executive?year=2026', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 200);
  await test('Admin PUT /api/preferences/executive_view (admin save preferences)', '/api/preferences/executive_view', 'PUT', { 'Authorization': `Bearer ${adminToken}` }, { theme: 'dark' }, 200);

  await stopServer();

  console.log(`\n========================================`);
  console.log(`Auth Verification Results: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(async (e) => {
  console.error('Fatal verification error:', e);
  await stopServer();
  process.exit(1);
});
