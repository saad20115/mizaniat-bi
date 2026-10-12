const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { initializeSchema } = require('./db/schema');
const { seedDemoData } = require('./db/seed-demo');
const apiRoutes = require('./routes/api');
const externalRoutes = require('./routes/external-api');
const authRoutes = require('./routes/auth');
const salesRoutes = require('./routes/sales');
const { requireAdmin, requireViewer, resolveUser } = require('./middleware/auth');
const { validateFilterQuery } = require('./middleware/validator');
const { enforceScope } = require('./middleware/scope');
const { startScheduler } = require('./cron/scheduler');
const { startScheduler: startSalesScheduler } = require('./cron/sales_scheduler');
const CacheService = require('./services/cache');

const app = express();
app.set('trust proxy', 'loopback');
const PORT = process.env.PORT || 3090;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
const compression = require('compression');
app.use(compression({ threshold: 1024 }));
app.use(express.json({ limit: '50mb' }));

// Auth routes (public - no middleware needed)
app.use('/api/auth', authRoutes);

// Smart API protection middleware
app.use('/api', (req, res, next) => {
  res.setHeader('X-Data-Version', String(CacheService.getDataVersion()));
  // Skip auth routes
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

  // Viewer-accessible routes: require viewer OR admin token
  const viewerPaths = [
    '/presentation/share', '/presentation/data', '/presentation',
    '/companies', '/filters', '/filter-options',
    '/analytic-groups', '/analytic-group-mappings',
    '/guarantee-details', '/guarantee-pending-list', '/guarantees',
    '/matrix', '/receivables', '/data-quality', '/performance-summary',
    '/executive', '/customers-collection', '/departments-profitability', '/preferences',
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
    // SEC1: Strict read-only for viewers. Any non-GET requires admin, EXCEPT PUT /preferences/:key
    if (req.method !== 'GET') {
      if (req.method === 'PUT' && req.path.startsWith('/preferences/')) {
        return requireViewer(req, res, next);
      }
      return requireAdmin(req, res, next);
    }
    return requireViewer(req, res, next);
  }

  // All other API routes require admin auth
  return requireAdmin(req, res, next);
});

// Input validation for query filter parameters
app.use('/api', validateFilterQuery);

// API routes
app.use('/api', apiRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/external', externalRoutes);

// 404 handler for API routes
app.all(['/api', '/api/*'], (req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl });
});

// Serve static files from client build
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist, {
  setHeaders: (res, filePath) => {
    if (filePath.includes(path.sep + 'assets' + path.sep) || filePath.includes('/assets/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// SPA fallback — serve correct HTML for each route
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  const p = req.path;
  if (p.startsWith('/login')) return res.sendFile(path.join(clientDist, 'login.html'));
  if (p.startsWith('/viewer')) return res.sendFile(path.join(clientDist, 'viewer.html'));
  if (p.startsWith('/view')) return res.sendFile(path.join(clientDist, 'view.html'));
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message });
});

// Initialize
async function start() {
  try {
    // Initialize database schema
    initializeSchema();
    
    // Seed demo data
    seedDemoData();
    
    // Start cron scheduler (S1: Single unified scheduler runs all stages)
    startScheduler();
    // startSalesScheduler() is superseded by unified startScheduler()

    // Check external API key configuration
    if (!process.env.EXTERNAL_API_KEY) {
      console.warn('[SECURITY WARNING] EXTERNAL_API_KEY is not set. External API endpoints (/api/external/*) are currently accessible without API key.');
    }

    // Auto-sync on startup if database is empty (fresh deploy)
    try {
      const { getDb } = require('./db/connection');
      const db = getDb();
      const count = db.prepare('SELECT COUNT(*) as c FROM journal_items').get();
      if (!count || count.c === 0) {
        console.log('[Startup] Empty database detected — triggering initial sync from Odoo...');
        const SyncEngine = require('./services/sync-engine');
        const engine = new SyncEngine();
        engine.syncAll().then(results => {
          const total = results.reduce((s, r) => s + (r.records_synced || 0), 0);
          console.log(`[Startup] Initial sync completed: ${total} records`);
          const CacheService = require('./services/cache');
          CacheService.flush();
        }).catch(err => {
          console.error('[Startup] Initial sync failed:', err.message);
        });
      } else {
        console.log(`[Startup] Database has ${count.c} journal entries — skipping auto-sync`);
      }
    } catch (syncErr) {
      console.error('[Startup] Auto-sync check failed:', syncErr.message);
    }
    
    const CacheService = require('./services/cache');
    app.listen(PORT, () => {
      console.log(`\n🚀 Mizaniat BI Server running at http://localhost:${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
      console.log(`⏰ Sync scheduler active\n`);
      // Pre-warm cache for default presentation view
      if (!process.env.NO_CACHE_WARMUP && process.env.NODE_ENV !== 'test') {
        CacheService.warmupCache();
      }
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
