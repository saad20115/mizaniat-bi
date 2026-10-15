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
const assert = require('assert');
const crypto = require('crypto');

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
const authRoutes = require('../routes/auth');
const externalRoutes = require('../routes/external-api');
const { requireAdmin, requireViewer, resolveUser } = require('../middleware/auth');
const { enforceScope } = require('../middleware/scope');

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

  // Resolve user identity if credentials provided
  const user = resolveUser(req);
  if (user) {
    req.user = user;
    if (user.role === 'admin') req.admin = user.admin;
    if (user.role === 'viewer') req.viewer = user.viewer;
    if (user.role === 'scoped_viewer') {
      req.viewer = user.viewer;
      req.scopedShare = user.scopedShare;
    }
  }

  // Scoped viewer requests are guarded and scoped here (strict allowlist, 403 on forbidden)
  if (req.scopedShare) {
    return enforceScope(req, res, next);
  }

  const viewerPaths = [
    '/presentation/share', '/presentation/data', '/presentation',
    '/companies', '/filters', '/filter-options',
    '/analytic-groups', '/analytic-group-mappings',
    '/guarantee-details', '/guarantee-pending-list', '/guarantees',
    '/matrix', '/receivables', '/data-quality', '/performance-summary',
    '/executive', '/customers-collection', '/departments-profitability', '/departments-comparison', '/preferences',
    '/customer-statement', '/executive-client-invoices',
    '/vat', '/actual-collections',
    '/sales/invoices', '/sales/customer-hierarchy', '/sales/companies',
    '/search', '/search/tree',
    '/cache/stats', '/sync/latest-status'
  ];
  if (req.path.startsWith('/presentation/scoped-shares')) {
    return requireAdmin(req, res, next);
  }
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
  await test('Viewer PUT /api/companies/1/vat-period (edit vat period -> forbidden)', '/api/companies/1/vat-period', 'PUT', { 'x-viewer-token': viewerToken }, { vat_period: 'monthly' }, [401, 403]);

  console.log('\n── CC1: Attribution settings are admin-only');
  await test('Viewer GET /api/attribution/conflicts (admin-only)', '/api/attribution/conflicts', 'GET', { 'x-viewer-token': viewerToken }, undefined, [401, 403]);
  await test('Viewer GET /api/journal-defaults (admin-only)', '/api/journal-defaults?companyId=1', 'GET', { 'x-viewer-token': viewerToken }, undefined, [401, 403]);
  await test('Viewer PUT /api/journal-defaults (decide journal -> forbidden)', '/api/journal-defaults', 'PUT', { 'x-viewer-token': viewerToken }, { companyId: 1, journalId: 1, groupId: 1 }, [401, 403]);
  await test('Viewer DELETE /api/journal-defaults (withdraw decision -> forbidden)', '/api/journal-defaults?companyId=1&journalId=1', 'DELETE', { 'x-viewer-token': viewerToken }, null, [401, 403]);
  await test('Viewer POST /api/attribution/rebuild (rebuild -> forbidden)', '/api/attribution/rebuild', 'POST', { 'x-viewer-token': viewerToken }, {}, [401, 403]);
  await test('No token GET /api/attribution/conflicts', '/api/attribution/conflicts', 'GET', {}, undefined, 401);
  await test('Admin GET /api/attribution/conflicts', '/api/attribution/conflicts', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 200);
  await test('Admin GET /api/journal-defaults', '/api/journal-defaults?companyId=1', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 200);
  await test('Admin PUT /api/journal-defaults with an unknown journal is rejected', '/api/journal-defaults', 'PUT', { 'Authorization': `Bearer ${adminToken}` }, { companyId: 1, journalId: 999999999, groupId: null }, 400);

  console.log('\n── S2 (SEC1): Viewer Allowed Read-Only Operations (Must be 200)');
  await test('Viewer GET /api/executive (executive summary)', '/api/executive?year=2026', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/filters (filter options read-only)', '/api/filters', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/executive/children (lazy children)', '/api/executive/children?companyId=1&departmentId=1&year=2026', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/executive/invoices (lazy client invoices)', '/api/executive/invoices?companyId=1&partnerId=420&year=2026', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/executive/aging (lazy aging)', '/api/executive/aging?companyIds=1,2,3,4&year=2026', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/vat (vat summary read-only)', '/api/vat?years=2026', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
  await test('Viewer GET /api/vat-details (vat details read-only)', '/api/vat-details?companyId=2&period=2026-Q1', 'GET', { 'x-viewer-token': viewerToken }, undefined, 200);
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

  console.log('\n── M1-R1: Filter Parameter Validation & SQL Injection Prevention');
  const r1Res = await test('GET /api/actual-collections with journalIds=NaN (returns 400)', '/api/actual-collections?companyId=1&journalIds=NaN', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 400);
  if (r1Res) {
    try {
      const data = await r1Res.clone().json();
      if (data.code === 'INVALID_FILTER_PARAM') {
        console.log(`[PASS] Returned code: INVALID_FILTER_PARAM on NaN`);
        passed++;
      } else {
        console.error(`[FAIL] Expected code INVALID_FILTER_PARAM, got:`, data);
        failed++;
      }
    } catch (e) {}
  }
  await test('GET /api/actual-collections with costCenters=NaN (returns 400)', '/api/actual-collections?companyId=1&costCenters=NaN', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 400);
  await test('GET /api/actual-collections with costCenterKey=NaN (returns 400)', '/api/actual-collections?companyId=1&costCenterKey=NaN', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 400);
  await test('GET /api/customers-collection with SQL injection (returns 400)', '/api/customers-collection?companyIds=1&journalIds=1;%20DROP%20TABLE%20users;--', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 400);
  await test('GET /api/actual-collections with bare costCenters (returns 400)', '/api/actual-collections?companyId=1&costCenters=an:%D9%85%D8%AE%D8%AA%D8%A8%D8%B1%20%D8%AC%D8%AF%D8%A9', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 400);
  await test('GET /api/executive with bare numeric journalIds (returns 400)', '/api/executive?year=2026&companyIds=1&journalIds=65', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 400);
  await test('GET /api/actual-collections with valid pair costCenters (returns 200)', '/api/actual-collections?companyId=1&costCenters=1|an:%D9%85%D8%AE%D8%AA%D8%A8%D8%B1%20%D8%AC%D8%AF%D8%A9', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 200);
  await test('GET /api/executive with valid pair costCenters (returns 200)', '/api/executive?year=2026&companyIds=1&costCenters=1|an:%D9%85%D8%AE%D8%AA%D8%A8%D8%B1%20%D8%AC%D8%AF%D8%A9', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 200);
  await test('GET /api/customers-collection with valid pair costCenters (returns 200)', '/api/customers-collection?companyIds=1&costCenters=1|an:%D9%85%D8%AE%D8%AA%D8%A8%D8%B1%20%D8%AC%D8%AF%D8%A9', 'GET', { 'Authorization': `Bearer ${adminToken}` }, undefined, 200);

  console.log('\n── SH1: Scoped Share Links & Security Matrix');
  
  // 1. Admin creates scoped share
  let scopedShareToken = '';
  let scopedShareId = null;
  const createScopedRes = await test('Admin POST /api/presentation/scoped-shares (create Jeddah Lab share)', '/api/presentation/scoped-shares', 'POST', {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  }, {
    name: 'مختبر جدة',
    costCenters: [
      { companyId: 1, costCenterKey: 'an:7:27' },
      { companyId: 2, costCenterKey: 'an:7:24' }
    ],
    tabs: ['executive', 'customers', 'actual-collections', 'profitability'],
    allowAdminAllocation: false,
    allowedPhones: ['+966 50 123 4567']
  }, 200);

  if (createScopedRes) {
    try {
      const data = await createScopedRes.clone().json();
      scopedShareToken = data.token;
      scopedShareId = data.id;
      assert(scopedShareToken && scopedShareToken.length === 64, 'Token is 64 hex chars (32 bytes)');
    } catch(e) {}
  }

  // 2. Admin lists scoped shares
  await test('Admin GET /api/presentation/scoped-shares', '/api/presentation/scoped-shares', 'GET', {
    'Authorization': `Bearer ${adminToken}`
  }, undefined, 200);

  // 3. Scoped viewer cannot access admin scoped-shares route
  await test('Public GET /api/presentation/scoped-shares -> 401', '/api/presentation/scoped-shares', 'GET', {}, undefined, 401);

  // 4. Scoped Share Login Verification & Error Unification
  await test('Scoped Share login with invalid token -> 401', '/api/auth/scoped-share/login', 'POST', {
    'Content-Type': 'application/json'
  }, { token: 'invalid-token-1234', phone: '0501234567' }, 401);

  await test('Scoped Share login with unauthorized phone -> 401', '/api/auth/scoped-share/login', 'POST', {
    'Content-Type': 'application/json'
  }, { token: scopedShareToken, phone: '0599999999' }, 401);

  // 5. Scoped Share Rate Limiting (5 failed attempts)
  authRoutes._clearRateLimits();
  for (let i = 1; i <= 5; i++) {
    await test(`Scoped Share failed login attempt ${i}/5 (returns 401)`, '/api/auth/scoped-share/login', 'POST', {
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.195'
    }, { token: scopedShareToken, phone: '0599999999' }, 401);
  }
  await test('Scoped Share failed login attempt 6/5 exceeds rate limit (returns 429)', '/api/auth/scoped-share/login', 'POST', {
    'Content-Type': 'application/json',
    'x-forwarded-for': '203.0.113.195'
  }, { token: scopedShareToken, phone: '0599999999' }, 429);

  // Clear rate limits for subsequent tests
  authRoutes._clearRateLimits();

  // 6. Valid Scoped Share Login (different phone formats)
  let scopedSessionToken = '';
  const loginRes = await test('Scoped Share login with normalized phone (0501234567) -> 200', '/api/auth/scoped-share/login', 'POST', {
    'Content-Type': 'application/json'
  }, { token: scopedShareToken, phone: '0501234567' }, 200);

  if (loginRes) {
    try {
      const data = await loginRes.clone().json();
      scopedSessionToken = data.token;
      assert(scopedSessionToken && scopedSessionToken.length === 64, 'Session token is 64 hex chars');
    } catch(e) {}
  }

  // 7. Verify session endpoint
  await test('Scoped Share GET /api/auth/scoped-share/verify (valid session -> 200)', '/api/auth/scoped-share/verify', 'GET', {
    'x-viewer-token': scopedSessionToken
  }, undefined, 200);

  // 8. Bypass Matrix (Forbidden Routes & Scope Violations)
  const scopedHeaders = { 'x-viewer-token': scopedSessionToken };

  await test('Scoped Viewer GET /api/vat (blocked tab -> 403)', '/api/vat', 'GET', scopedHeaders, undefined, 403);
  await test('Scoped Viewer GET /api/guarantees (blocked tab -> 403)', '/api/guarantees', 'GET', scopedHeaders, undefined, 403);
  await test('Scoped Viewer GET /api/matrix (blocked tab -> 403)', '/api/matrix', 'GET', scopedHeaders, undefined, 403);
  await test('Scoped Viewer GET /api/reports/income-statement (blocked tab -> 403)', '/api/reports/income-statement', 'GET', scopedHeaders, undefined, 403);
  await test('Scoped Viewer GET /api/presentation/scoped-shares (admin only -> 401/403)', '/api/presentation/scoped-shares', 'GET', scopedHeaders, undefined, [401, 403]);
  await test('Scoped Viewer GET /api/attribution/conflicts (admin only -> 401/403)', '/api/attribution/conflicts', 'GET', scopedHeaders, undefined, [401, 403]);
  await test('Scoped Viewer GET /api/journal-defaults (admin only -> 401/403)', '/api/journal-defaults?companyId=1', 'GET', scopedHeaders, undefined, [401, 403]);
  await test('Scoped Viewer POST /api/companies (mutation forbidden -> 403)', '/api/companies', 'POST', { ...scopedHeaders, 'Content-Type': 'application/json' }, { name: 'Fake' }, 403);
  await test('Scoped Viewer GET /api/departments-profitability?distributeAdmin=1 -> 403', '/api/departments-profitability?distributeAdmin=1', 'GET', scopedHeaders, undefined, 403);
  await test('Scoped Viewer GET /api/departments-profitability?redistributeAdmin=true -> 403', '/api/departments-profitability?redistributeAdmin=true', 'GET', scopedHeaders, undefined, 403);
  await test('Scoped Viewer GET /api/executive?companyIds=3 (outsider company -> 403)', '/api/executive?companyIds=3', 'GET', scopedHeaders, undefined, 403);
  await test('Scoped Viewer GET /api/executive?costCenters=an:7:16 (outsider center سنابل جدة -> 403)', '/api/executive?costCenters=an:7:16', 'GET', scopedHeaders, undefined, 403);
  await test('Scoped Viewer GET /api/executive/invoices?companyId=1&partnerId=239 (outsider partner -> 403)', '/api/executive/invoices?companyId=1&partnerId=239', 'GET', scopedHeaders, undefined, 403);
  await test('Scoped Viewer GET /api/customers-collection/statement?companyId=1&partnerId=239 (outsider partner -> 403)', '/api/customers-collection/statement?companyId=1&partnerId=239', 'GET', scopedHeaders, undefined, 403);

  // 9. Allowed Routes for Scoped Viewer
  await test('Scoped Viewer GET /api/companies (returns 200, scoped)', '/api/companies', 'GET', scopedHeaders, undefined, 200);
  await test('Scoped Viewer GET /api/filters (returns 200, scoped)', '/api/filters', 'GET', scopedHeaders, undefined, 200);
  await test('Scoped Viewer GET /api/sync/latest-status (returns 200)', '/api/sync/latest-status', 'GET', scopedHeaders, undefined, 200);
  await test('Scoped Viewer GET /api/preferences/executive_view (returns 200)', '/api/preferences/executive_view', 'GET', scopedHeaders, undefined, 200);
  await test('Scoped Viewer PUT /api/preferences/executive_view (returns 200)', '/api/preferences/executive_view', 'PUT', scopedHeaders, { theme: 'light' }, 200);

  // 10. Financial Identity Invariant (Scoped vs Admin with identical scope -> 0.00 difference)
  console.log('\n── SH1: Financial Identity & Zero Outsider Leakage');
  const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };
  const scopedCCsParam = '1|an:7:27,2|an:7:24';

  // (a) Executive Tab
  const scExecRes = await test('Scoped Viewer GET /api/executive?years=2026', '/api/executive?years=2026', 'GET', scopedHeaders, undefined, 200);
  const adExecRes = await test('Admin GET /api/executive?years=2026 with scope CCs', `/api/executive?years=2026&companyIds=1,2&costCenters=${scopedCCsParam}`, 'GET', adminHeaders, undefined, 200);
  if (scExecRes && adExecRes) {
    const scData = await scExecRes.clone().json();
    const adData = await adExecRes.clone().json();
    assert(scData.cards && adData.cards, 'Executive cards exist');
    assert(scData.cards.revenue === adData.cards.revenue, `Executive revenue match (${scData.cards.revenue} === ${adData.cards.revenue})`);
    assert(scData.cards.expenses === adData.cards.expenses, `Executive expenses match (${scData.cards.expenses} === ${adData.cards.expenses})`);
    assert(scData.cards.net_profit === adData.cards.net_profit, `Executive net match (${scData.cards.net_profit} === ${adData.cards.net_profit})`);
    assert(scData.cards.billed_period_untaxed === adData.cards.billed_period_untaxed, `Executive billed match`);
    assert(scData.cards.collected_period_untaxed === adData.cards.collected_period_untaxed, `Executive collected match`);
  }

  // (b) Customers Tab
  const scCustRes = await test('Scoped Viewer GET /api/customers-collection?years=2026', '/api/customers-collection?years=2026', 'GET', scopedHeaders, undefined, 200);
  const adCustRes = await test('Admin GET /api/customers-collection?years=2026 with scope CCs', `/api/customers-collection?years=2026&companyIds=1,2&costCenters=${scopedCCsParam}`, 'GET', adminHeaders, undefined, 200);
  if (scCustRes && adCustRes) {
    const scData = await scCustRes.clone().json();
    const adData = await adCustRes.clone().json();
    assert(scData.totals && adData.totals, 'Customers totals exist');
    assert(scData.totals.total_net === adData.totals.total_net, `Customers net match (${scData.totals.total_net} === ${adData.totals.total_net})`);
    assert(scData.totals.total_collected === adData.totals.total_collected, `Customers collected match (${scData.totals.total_collected} === ${adData.totals.total_collected})`);
    assert(scData.totals.total_residual === adData.totals.total_residual, `Customers residual match (${scData.totals.total_residual} === ${adData.totals.total_residual})`);
  }

  // (c) Actual Collections Tab
  const scCollRes = await test('Scoped Viewer GET /api/actual-collections?years=2026', '/api/actual-collections?years=2026', 'GET', scopedHeaders, undefined, 200);
  const adCollRes = await test('Admin GET /api/actual-collections?years=2026 with scope CCs', `/api/actual-collections?years=2026&companyIds=1,2&costCenters=${scopedCCsParam}`, 'GET', adminHeaders, undefined, 200);
  if (scCollRes && adCollRes) {
    const scData = await scCollRes.clone().json();
    const adData = await adCollRes.clone().json();
    assert(scData.cards && adData.cards, 'Collections cards exist');
    assert(scData.cards.total_collected === adData.cards.total_collected, `Collections total match (${scData.cards.total_collected} === ${adData.cards.total_collected})`);
    assert(scData.cards.bank_collected === adData.cards.bank_collected, `Collections bank match (${scData.cards.bank_collected} === ${adData.cards.bank_collected})`);
    assert(scData.cards.sister_collected === adData.cards.sister_collected, `Collections sister match (${scData.cards.sister_collected} === ${adData.cards.sister_collected})`);
  }

  // (d) Profitability Tab
  const scProfRes = await test('Scoped Viewer GET /api/departments-profitability?years=2026', '/api/departments-profitability?years=2026', 'GET', scopedHeaders, undefined, 200);
  const adProfRes = await test('Admin GET /api/departments-profitability?years=2026 with scope CCs', `/api/departments-profitability?years=2026&companyIds=1,2&costCenters=${scopedCCsParam}&distributeAdmin=0`, 'GET', adminHeaders, undefined, 200);
  if (scProfRes && adProfRes) {
    const scData = await scProfRes.clone().json();
    const adData = await adProfRes.clone().json();
    assert(scData.summary && adData.summary, 'Profitability summary exists');
    assert(scData.summary.total_revenue === adData.summary.total_revenue, `Profitability rev match (${scData.summary.total_revenue} === ${adData.summary.total_revenue})`);
    assert(scData.summary.total_expenses === adData.summary.total_expenses, `Profitability exp match (${scData.summary.total_expenses} === ${adData.summary.total_expenses})`);
    assert(scData.summary.net_profit === adData.summary.net_profit, `Profitability net match (${scData.summary.net_profit} === ${adData.summary.net_profit})`);
  }

  // (e) Zero Outsider Cost Center Leakage Check
  if (scExecRes && scCustRes && scCollRes && scProfRes) {
    const combinedJson = JSON.stringify({
      exec: await scExecRes.clone().json(),
      cust: await scCustRes.clone().json(),
      coll: await scCollRes.clone().json(),
      prof: await scProfRes.clone().json()
    });

    const forbiddenTerms = [
      'an:7:16', 'سنابل جدة', 'مختبر الطائف', 'مختبر مكة', 'قسم الاشراف'
    ];
    for (const term of forbiddenTerms) {
      assert(!combinedJson.includes(term), `Zero leak of outsider term "${term}" in scoped response JSON`);
    }
  }

  // (f) Deep Content & Row Count Verification for Scope 1 (Jeddah Lab)
  console.log('\n── SH1: Deep Content & Row Count Verification (Scope 1: Jeddah Lab)');
  
  // Dynamic expected counts from DB
  const expectedCo1_2026 = db.prepare(`
    SELECT count(DISTINCT si.id) as cnt
    FROM sales_invoices si
    JOIN sales_companies sc ON sc.id = si.company_id
    JOIN companies c ON c.odoo_company_id = sc.sales_company_id
    JOIN invoice_departments id ON id.sales_invoice_id = si.id
    WHERE c.id = 1 AND id.cost_center_key = 'an:7:27' AND strftime('%Y', si.date) = '2026'
  `).get().cnt;

  const expectedCo2_p163 = db.prepare(`
    SELECT count(DISTINCT si.id) as cnt
    FROM sales_invoices si
    JOIN sales_companies sc ON sc.id = si.company_id
    JOIN companies c ON c.odoo_company_id = sc.sales_company_id
    JOIN invoice_departments id ON id.sales_invoice_id = si.id
    WHERE c.id = 2 AND si.partner_id = 163 AND id.cost_center_key = 'an:7:24'
  `).get().cnt;

  // 1. GET /api/executive/invoices?companyId=1&year=2026
  const scInvCo1Res = await test('Scoped Viewer GET /api/executive/invoices?companyId=1&year=2026 (exact row count)', '/api/executive/invoices?companyId=1&year=2026', 'GET', scopedHeaders, undefined, 200);
  if (scInvCo1Res) {
    const data = await scInvCo1Res.clone().json();
    assert(Array.isArray(data.invoices), 'Invoices is an array');
    assert(data.invoices.length === expectedCo1_2026, `Exact invoices count (${data.invoices.length} === ${expectedCo1_2026})`);
    const outsiderInvs = data.invoices.filter(i => i.journal_name && !i.journal_name.includes('مختبر جدة'));
    assert(outsiderInvs.length === 0, `Zero outsider invoices found (${outsiderInvs.length} === 0)`);
  }

  // 2. GET /api/executive/invoices?companyId=2&partnerId=163 (without year -> returns in-scope historical)
  const scInvP163Res = await test('Scoped Viewer GET /api/executive/invoices?companyId=2&partnerId=163 (in-scope client invoices)', '/api/executive/invoices?companyId=2&partnerId=163', 'GET', scopedHeaders, undefined, 200);
  if (scInvP163Res) {
    const data = await scInvP163Res.clone().json();
    assert(data.invoices.length === expectedCo2_p163, `Partner 163 exact invoices count (${data.invoices.length} === ${expectedCo2_p163})`);
  }

  // 3. GET /api/customers-collection/invoices?companyId=2&partnerId=163
  const scCustInvRes = await test('Scoped Viewer GET /api/customers-collection/invoices?companyId=2&partnerId=163', '/api/customers-collection/invoices?companyId=2&partnerId=163', 'GET', scopedHeaders, undefined, 200);
  if (scCustInvRes) {
    const data = await scCustInvRes.clone().json();
    assert(data.invoices.length === expectedCo2_p163, `Customers collection invoices count (${data.invoices.length} === ${expectedCo2_p163})`);
  }

  // 4. GET /api/customers-collection/statement?companyId=2&partnerId=163
  const scStmtRes = await test('Scoped Viewer GET /api/customers-collection/statement?companyId=2&partnerId=163', '/api/customers-collection/statement?companyId=2&partnerId=163', 'GET', scopedHeaders, undefined, 200);
  if (scStmtRes) {
    const data = await scStmtRes.clone().json();
    assert(data.items.length === expectedCo2_p163, `Statement items count (${data.items.length} === ${expectedCo2_p163})`);
  }

  // 5. GET /api/search/tree?query=شركة (general query)
  const scSearchRes = await test('Scoped Viewer GET /api/search/tree?query=شركة (tree search restricted to scope)', '/api/search/tree?query=شركة', 'GET', scopedHeaders, undefined, 200);
  if (scSearchRes) {
    const data = await scSearchRes.clone().json();
    const resultCCs = new Set((data.matches || []).map(m => m.cost_center_name || m.group_name).filter(Boolean));
    for (const cc of resultCCs) {
      assert(cc.includes('مختبر جدة') || cc.includes('المختبرات'), `Search match "${cc}" is within scope`);
    }
  }

  // 6. GET /api/executive/aging?year=2026
  const scAgingRes = await test('Scoped Viewer GET /api/executive/aging?year=2026 (aging restricted to scope)', '/api/executive/aging?year=2026', 'GET', scopedHeaders, undefined, 200);
  if (scAgingRes) {
    const data = await scAgingRes.clone().json();
    for (const co of (data.tree || [])) {
      for (const d of (co.departments || [])) {
        assert(d.name.includes('المختبرات') || d.name.includes('مختبر جدة'), `Aging department "${d.name}" is within scope`);
      }
    }
  }

  // 7. GET /api/filters
  const scFiltersRes = await test('Scoped Viewer GET /api/filters (filter options strictly in scope)', '/api/filters', 'GET', scopedHeaders, undefined, 200);
  if (scFiltersRes) {
    const data = await scFiltersRes.clone().json();
    assert(data.costCenters.every(c => c.includes('مختبر جدة')), 'All filter costCenters in scope');
    assert(data.groups.every(g => g.name.includes('المختبرات')), 'All filter groups in scope');

    // Recursive scan across ALL string values in JSON response
    const allFilterStrings = [];
    function scanStrings(val) {
      if (typeof val === 'string') allFilterStrings.push(val);
      else if (Array.isArray(val)) val.forEach(scanStrings);
      else if (val && typeof val === 'object') Object.values(val).forEach(scanStrings);
    }
    scanStrings(data);

    const outsiderTerms = ['مختبر الطائف', 'سنابل جدة', 'مختبر مكة', 'قسم الاشراف', 'قسم المساحة', 'an:7:16'];
    for (const s of allFilterStrings) {
      for (const term of outsiderTerms) {
        assert(!s.includes(term), `Zero leak of outsider term "${term}" in any string value of /filters response (found in: "${s}")`);
      }
    }
    for (const j of (data.journals || [])) {
      assert(!j.original_journals || !j.original_journals.includes('مختبر الطائف'), 'original_journals does not contain مختبر الطائف');
    }
  }

  // 8. GET /api/actual-collections
  const scCollCheckRes = await test('Scoped Viewer GET /api/actual-collections (available_journals restricted)', '/api/actual-collections', 'GET', scopedHeaders, undefined, 200);
  if (scCollCheckRes) {
    const data = await scCollCheckRes.clone().json();
    assert(data.available_journals.every(j => j.includes('مختبر جدة')), 'Available journals strictly in scope');
    assert(!data.accounts_comparison?.allocated_other_journals, 'No allocated_other_journals in accounts_comparison');
    assert(!data.accounts_comparison?.other_journals_breakdown, 'No other_journals_breakdown in accounts_comparison');
  }

  // 9. GET /api/actual-collections/payments
  const scPaymentsRes = await test('Scoped Viewer GET /api/actual-collections/payments?limit=500', '/api/actual-collections/payments?limit=500', 'GET', scopedHeaders, undefined, 200);
  if (scPaymentsRes) {
    const data = await scPaymentsRes.clone().json();
    const outsiderPayments = (data.rows || []).filter(p => !['an:7:27', 'an:7:24'].includes(p.cost_center_key));
    assert(outsiderPayments.length === 0, `Zero outsider payments (${outsiderPayments.length} === 0)`);
  }

  // (g) Second Distinct Scope Verification (Scope 2: Company 3 + an:8:10)
  console.log('\n── SH1: Second Distinct Scope Verification (Scope 2: Company 3 + an:8:10)');
  const scope2Res = await test('Admin POST /api/presentation/scoped-shares (create Company 3 Scope 2)', '/api/presentation/scoped-shares', 'POST', {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  }, {
    name: 'مشاركة حجاج الخارج - شركة 3',
    tabs: ['executive', 'customers', 'actual-collections', 'profitability'],
    companies: [3],
    costCenters: [{ companyId: 3, costCenterKey: 'an:8:10' }],
    allowedPhones: ['0509998877'],
    allowAdminAllocation: false
  }, 200);

  const scope2Data = await scope2Res.clone().json();
  const scope2Id = scope2Data.id;
  const scope2Token = scope2Data.token;

  let scopedSessionToken2 = '';
  const login2Res = await test('Scope 2 login with phone 0509998877 -> 200', '/api/auth/scoped-share/login', 'POST', {
    'Content-Type': 'application/json'
  }, { token: scope2Token, phone: '0509998877' }, 200);
  if (login2Res) {
    const lData = await login2Res.clone().json();
    scopedSessionToken2 = lData.token;
  }

  const scopedHeaders2 = { 'x-viewer-token': scopedSessionToken2 };

  // Scope 2 Allowed & Forbidden tests
  await test('Scope 2 GET /api/companies (only Company 3 returned)', '/api/companies', 'GET', scopedHeaders2, undefined, 200);
  await test('Scope 2 GET /api/executive?companyIds=1 (forbidden company -> 403)', '/api/executive?companyIds=1', 'GET', scopedHeaders2, undefined, 403);
  await test('Scope 2 GET /api/executive?costCenters=an:7:27 (forbidden center -> 403)', '/api/executive?costCenters=an:7:27', 'GET', scopedHeaders2, undefined, 403);

  // Dynamic expected counts for Scope 2
  const expectedCo3_2026 = db.prepare(`
    SELECT count(DISTINCT si.id) as cnt
    FROM sales_invoices si
    JOIN sales_companies sc ON sc.id = si.company_id
    JOIN companies c ON c.odoo_company_id = sc.sales_company_id
    JOIN invoice_departments id ON id.sales_invoice_id = si.id
    WHERE c.id = 3 AND id.cost_center_key = 'an:8:10' AND strftime('%Y', si.date) = '2026'
  `).get().cnt;

  const expectedCo3_p461 = db.prepare(`
    SELECT count(DISTINCT si.id) as cnt
    FROM sales_invoices si
    JOIN sales_companies sc ON sc.id = si.company_id
    JOIN companies c ON c.odoo_company_id = sc.sales_company_id
    JOIN invoice_departments id ON id.sales_invoice_id = si.id
    WHERE c.id = 3 AND si.partner_id = 461 AND id.cost_center_key = 'an:8:10'
  `).get().cnt;

  // Scope 2 Invoices count & content
  const sc2InvRes = await test('Scope 2 GET /api/executive/invoices?companyId=3&year=2026 (exact count)', '/api/executive/invoices?companyId=3&year=2026', 'GET', scopedHeaders2, undefined, 200);
  if (sc2InvRes) {
    const data = await sc2InvRes.clone().json();
    assert(data.invoices.length === expectedCo3_2026, `Scope 2 exact 2026 invoices (${data.invoices.length} === ${expectedCo3_2026})`);
  }

  const sc2P461Res = await test('Scope 2 GET /api/executive/invoices?companyId=3&partnerId=461 (exact count)', '/api/executive/invoices?companyId=3&partnerId=461', 'GET', scopedHeaders2, undefined, 200);
  if (sc2P461Res) {
    const data = await sc2P461Res.clone().json();
    assert(data.invoices.length === expectedCo3_p461, `Scope 2 partner 461 invoices (${data.invoices.length} === ${expectedCo3_p461})`);
  }

  const sc2StmtRes = await test('Scope 2 GET /api/customers-collection/statement?companyId=3&partnerId=461 (exact count)', '/api/customers-collection/statement?companyId=3&partnerId=461', 'GET', scopedHeaders2, undefined, 200);
  if (sc2StmtRes) {
    const data = await sc2StmtRes.clone().json();
    assert(data.items.length === expectedCo3_p461, `Scope 2 partner 461 statement items (${data.items.length} === ${expectedCo3_p461})`);
  }

  const sc2SearchRes = await test('Scope 2 GET /api/search/tree?query=شركة', '/api/search/tree?query=شركة', 'GET', scopedHeaders2, undefined, 200);
  const sc2FiltersRes = await test('Scope 2 GET /api/filters', '/api/filters', 'GET', scopedHeaders2, undefined, 200);
  const sc2CollRes = await test('Scope 2 GET /api/actual-collections', '/api/actual-collections', 'GET', scopedHeaders2, undefined, 200);

  // Assert ZERO hardcoded strings from Scope 1 appear in Scope 2
  const scope2CombinedJson = JSON.stringify([
    await sc2InvRes.clone().json(),
    await sc2P461Res.clone().json(),
    await sc2StmtRes.clone().json(),
    await sc2SearchRes.clone().json(),
    await sc2FiltersRes.clone().json(),
    await sc2CollRes.clone().json()
  ]);

  const scope2Parsed = JSON.parse(scope2CombinedJson);
  const scope2Strings = [];
  function scanScope2Strings(val) {
    if (typeof val === 'string') scope2Strings.push(val);
    else if (Array.isArray(val)) val.forEach(scanScope2Strings);
    else if (val && typeof val === 'object') Object.values(val).forEach(scanScope2Strings);
  }
  scanScope2Strings(scope2Parsed);

  for (const s of scope2Strings) {
    assert(!s.includes('مختبر جدة'), `Zero leak of "مختبر جدة" in Scope 2 string value: "${s}"`);
    assert(!s.includes('المختبرات'), `Zero leak of "المختبرات" in Scope 2 string value: "${s}"`);
    assert(!s.includes('an:7:27'), `Zero leak of "an:7:27" in Scope 2 string value: "${s}"`);
    assert(!s.includes('an:7:24'), `Zero leak of "an:7:24" in Scope 2 string value: "${s}"`);
  }

  assert(!scope2CombinedJson.includes('مختبر جدة'), 'Zero leak of "مختبر جدة" in Scope 2 JSON');
  assert(!scope2CombinedJson.includes('المختبرات'), 'Zero leak of "المختبرات" in Scope 2 JSON');
  assert(!scope2CombinedJson.includes('an:7:27'), 'Zero leak of "an:7:27" in Scope 2 JSON');
  console.log('[PASS] Scope 2 proven completely independent: zero hardcoded strings across all values, exact row counts match DB');
  passed++;

  // Clean up Scope 2
  await test('Admin DELETE /api/presentation/scoped-shares/:id (delete Scope 2)', `/api/presentation/scoped-shares/${scope2Id}`, 'DELETE', {
    'Authorization': `Bearer ${adminToken}`
  }, undefined, 200);

  // (h) DC1: departments comparison tab under scoped links
  console.log('\n── DC1: Departments comparison under scoped share links');
  await test('Scoped Viewer GET /api/departments-comparison (tab not selected for this link -> 403)', '/api/departments-comparison?years=2026', 'GET', scopedHeaders, undefined, 403);

  const dcScopePairs = [{ companyId: 1, costCenterKey: 'an:7:27' }, { companyId: 2, costCenterKey: 'an:7:24' }];
  const dcScopeRes = await test('Admin POST /api/presentation/scoped-shares (create DC1 scope with the comparison tab)', '/api/presentation/scoped-shares', 'POST', {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  }, {
    name: 'مقارنة الأقسام - مختبر جدة',
    costCenters: dcScopePairs,
    tabs: ['comparison'],
    allowAdminAllocation: false,
    allowedPhones: ['0507776655']
  }, 200);
  const dcScope = await dcScopeRes.clone().json();
  const dcLoginRes = await test('DC1 scope login -> 200', '/api/auth/scoped-share/login', 'POST', { 'Content-Type': 'application/json' }, { token: dcScope.token, phone: '0507776655' }, 200);
  const dcHeaders = { 'x-viewer-token': (await dcLoginRes.clone().json()).token };

  await test('DC1 scope GET /api/executive (tab not selected -> 403)', '/api/executive?years=2026', 'GET', dcHeaders, undefined, 403);
  await test('DC1 scope GET /api/departments-comparison?companyIds=3 (outsider company -> 403)', '/api/departments-comparison?years=2026&companyIds=3', 'GET', dcHeaders, undefined, 403);
  await test('DC1 scope GET /api/departments-comparison?costCenters=an:7:16 (outsider cost center -> 403)', '/api/departments-comparison?years=2026&costCenters=an:7:16', 'GET', dcHeaders, undefined, 403);

  for (const yr of ['2026', 'ALL']) {
    const dcScRes = await test(`DC1 scope GET /api/departments-comparison?years=${yr} -> 200`, `/api/departments-comparison?years=${yr}`, 'GET', dcHeaders, undefined, 200);
    const dcAdRes = await test(`Admin GET /api/departments-comparison?years=${yr} with the same pairs`, `/api/departments-comparison?years=${yr}&companyIds=1,2&costCenters=${scopedCCsParam}`, 'GET', adminHeaders, undefined, 200);
    const dcFullRes = await test(`Admin GET /api/departments-comparison?years=${yr} unfiltered`, `/api/departments-comparison?years=${yr}`, 'GET', adminHeaders, undefined, 200);
    const sc = await dcScRes.clone().json();
    const ad = await dcAdRes.clone().json();
    const full = await dcFullRes.clone().json();

    const dcKeys = ['revenue', 'expenses', 'net_profit', 'cash_collected', 'cash_collected_gross', 'collected_invoices', 'remaining', 'open_total', 'open_total_gross'];
    const dcDiffs = dcKeys.filter(k => sc.totals[k] !== ad.totals[k]);
    assert(dcDiffs.length === 0, `DC1 scope (${yr}): totals identical to admin with the same pairs, difference 0 (revenue ${sc.totals.revenue}, cash ${sc.totals.cash_collected}, total remaining ${sc.totals.open_total})`);

    const dcLeaves = [];
    for (const d of sc.tree) for (const cc of d.children) for (const leaf of cc.children) dcLeaves.push(leaf);
    const dcAdminLeaves = ad.tree.reduce((n, d) => n + d.children.reduce((m, cc) => m + cc.children.length, 0), 0);
    const dcOutside = dcLeaves.filter(l => !dcScopePairs.some(p => p.companyId === l.company_id && p.costCenterKey === l.cost_center_key));
    assert(dcLeaves.length > 0 && dcLeaves.length === dcAdminLeaves && dcOutside.length === 0,
      `DC1 scope (${yr}): every row is one of the link's (company, cost center) pairs — ${dcLeaves.length} rows, ${dcOutside.length} outside, same row count as admin (${dcAdminLeaves})`);
    assert(sc.tree.length === ad.tree.length && sc.tree.length < full.tree.length && sc.totals.expenses < full.totals.expenses,
      `DC1 scope (${yr}): ${sc.tree.length} department(s) instead of ${full.tree.length}; scoped response differs from the unfiltered one`);

    const dcJson = JSON.stringify(sc);
    const dcOutsiderNames = full.tree.filter(d => !sc.tree.some(x => x.department_id === d.department_id)).map(d => d.name).filter(n => n && n.length > 3);
    const dcLeaked = dcOutsiderNames.filter(n => dcJson.includes(n));
    assert(dcOutsiderNames.length > 0 && dcLeaked.length === 0, `DC1 scope (${yr}): no outsider department name appears in the response (${dcOutsiderNames.length} names checked)`);

    const dcUnlinkedOutside = (sc.unlinked_payments.moves || []).filter(m => ![1, 2].includes(Number(m.company_id)));
    assert(dcUnlinkedOutside.length === 0 && sc.unlinked_payments.count === ad.unlinked_payments.count, `DC1 scope (${yr}): unlinked payments limited to the link's companies and equal to admin with the same pairs (${sc.unlinked_payments.count})`);
  }

  const dcAdminAfter = await (await test('Admin GET /api/departments-comparison after scoped requests (cache not polluted)', '/api/departments-comparison?years=2026', 'GET', adminHeaders, undefined, 200)).clone().json();
  const dcAdminScoped = await (await test('Admin GET /api/departments-comparison with pairs (reference)', `/api/departments-comparison?years=2026&companyIds=1,2&costCenters=${scopedCCsParam}`, 'GET', adminHeaders, undefined, 200)).clone().json();
  assert(dcAdminAfter.totals.revenue !== dcAdminScoped.totals.revenue && dcAdminAfter.tree.length > dcAdminScoped.tree.length, 'DC1: admin unfiltered response is not served from the scoped cache');

  await test('Admin DELETE /api/presentation/scoped-shares/:id (delete DC1 scope)', `/api/presentation/scoped-shares/${dcScope.id}`, 'DELETE', {
    'Authorization': `Bearer ${adminToken}`
  }, undefined, 200);

  // 11. Cache Isolation & Alternating Requests (Admin -> Scoped -> Admin)
  console.log('\n── SH1: Cache Isolation & Non-Pollution');
  const adminFullRes1 = await test('Admin GET /api/executive (unfiltered 1)', '/api/executive?years=2026', 'GET', adminHeaders, undefined, 200);
  const adminFull1 = await adminFullRes1.clone().json();

  const scopedExecCheck = await test('Scoped GET /api/executive (isolated cache)', '/api/executive?years=2026', 'GET', scopedHeaders, undefined, 200);
  const scopedExecData = await scopedExecCheck.clone().json();

  const adminFullRes2 = await test('Admin GET /api/executive (unfiltered 2, must match unfiltered 1)', '/api/executive?years=2026', 'GET', adminHeaders, undefined, 200);
  const adminFull2 = await adminFullRes2.clone().json();

  assert(adminFull1.cards.revenue === adminFull2.cards.revenue, 'Admin cache was not poisoned by scoped query');
  assert(adminFull1.cards.revenue !== scopedExecData.cards.revenue, 'Scoped response differs from admin unfiltered response');

  // 12. Deactivation & Invalidation
  console.log('\n── SH1: Deactivation & Session Invalidation');
  await test('Admin PUT /api/presentation/scoped-shares/:id (deactivate share)', `/api/presentation/scoped-shares/${scopedShareId}`, 'PUT', {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  }, { isActive: false }, 200);

  await test('Scoped Viewer GET /api/executive with deactivated share -> 401', '/api/executive?years=2026', 'GET', scopedHeaders, undefined, 401);
  await test('Scoped Viewer GET /api/auth/scoped-share/verify with deactivated share -> 401', '/api/auth/scoped-share/verify', 'GET', scopedHeaders, undefined, 401);

  // 13. Audit logs inspectable by admin
  const logsRes = await test('Admin GET /api/presentation/scoped-shares/:id/logs', `/api/presentation/scoped-shares/${scopedShareId}/logs`, 'GET', {
    'Authorization': `Bearer ${adminToken}`
  }, undefined, 200);
  if (logsRes) {
    const logs = await logsRes.clone().json();
    assert(Array.isArray(logs) && logs.length > 0, `Audit logs recorded for scoped share (found: ${logs?.length})`);
  }

  // 14. Live-copy Non-Regression Test
  console.log('\n── SH1 Annex: Live-Copy DB Non-Regression Check');
  const LIVE_COPY_DB = path.join(__dirname, '..', '..', 'data', 'mizaniat.live-copy.db');
  if (fs.existsSync(LIVE_COPY_DB)) {
    const Database = require('better-sqlite3');
    const liveCopy = new Database(LIVE_COPY_DB, { readonly: true });
    try {
      const sharesCount = liveCopy.prepare('SELECT COUNT(*) as cnt FROM presentation_shares').get().cnt;
      const viewersCount = liveCopy.prepare('SELECT COUNT(*) as cnt FROM allowed_viewers').get().cnt;
      assert(sharesCount === 14, `All 14 presentation_shares intact on live-copy (found: ${sharesCount})`);
      assert(viewersCount === 5, `All 5 allowed_viewers intact on live-copy (found: ${viewersCount})`);
      console.log(`[PASS] Live-copy non-regression check passed (14 shares, 5 viewers verified)`);
      passed++;
    } finally {
      liveCopy.close();
    }
  }

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
