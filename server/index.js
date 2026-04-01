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
const { requireAdmin, requireViewer } = require('./middleware/auth');
const { startScheduler } = require('./cron/scheduler');
const { startScheduler: startSalesScheduler } = require('./cron/sales_scheduler');

const app = express();
const PORT = process.env.PORT || 3090;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Auth routes (public - no middleware needed)
app.use('/api/auth', authRoutes);

// Smart API protection middleware
app.use('/api', (req, res, next) => {
  // Skip auth routes (already handled above, but just in case)
  if (req.path.startsWith('/auth')) return next();

  // External API — no auth required (for budget program integration)
  if (req.path.startsWith('/external')) return next();

  // Viewer-accessible routes: require viewer OR admin token
  const viewerPaths = [
    '/presentation/share', '/presentation/data', '/presentation',
    '/companies', '/filter-options',
    '/analytic-groups', '/analytic-group-mappings',
    '/guarantee-details', '/guarantee-pending-list',
  ];
  const isViewerPath = viewerPaths.some(p => req.path.startsWith(p));
  if (isViewerPath) {
    return requireViewer(req, res, next);
  }

  // All other API routes require admin auth
  return requireAdmin(req, res, next);
});

// API routes
app.use('/api', apiRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/external', externalRoutes);

// Serve static files from client build
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// SPA fallback — serve correct HTML for each route
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return;
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
    
    // Start cron scheduler
    startScheduler();
    startSalesScheduler();

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
        }).catch(err => {
          console.error('[Startup] Initial sync failed:', err.message);
        });
      } else {
        console.log(`[Startup] Database has ${count.c} journal entries — skipping auto-sync`);
      }
    } catch (syncErr) {
      console.error('[Startup] Auto-sync check failed:', syncErr.message);
    }
    
    app.listen(PORT, () => {
      console.log(`\n🚀 Mizaniat BI Server running at http://localhost:${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
      console.log(`⏰ Sync scheduler active\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
