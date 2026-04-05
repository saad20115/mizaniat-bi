const cron = require('node-cron');
const SalesSyncEngine = require('../services/sales-sync-engine');
const { getDb } = require('../db/connection');

let scheduledJob = null;
let currentSchedule = null;

// Convert interval hours to cron expression
function intervalToCron(hours) {
  if (hours <= 0) return null;
  if (hours >= 24) return '0 2 * * *'; // Daily at 2 AM
  return `0 */${hours} * * *`;         // Every N hours at :00
}

// Get saved settings from DB
function getSettings() {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM sales_app_settings WHERE key IN ('sync_enabled','sync_interval_hours')").all();
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    return {
      enabled: settings.sync_enabled === 'true',
      intervalHours: parseInt(settings.sync_interval_hours) || 2
    };
  } catch (e) {
    return { enabled: false, intervalHours: 2 };
  }
}

// Write a notification to the DB
function writeNotification(type, message, details = null) {
  try {
    const db = getDb();
    db.prepare('INSERT INTO sales_sync_notifications (type, message, details) VALUES (?, ?, ?)').run(
      type, message, details ? JSON.stringify(details) : null
    );
    // Keep only the latest 50 notifications
    db.prepare('DELETE FROM sales_sync_notifications WHERE id NOT IN (SELECT id FROM sales_sync_notifications ORDER BY id DESC LIMIT 50)').run();
  } catch (e) {
    console.error('[Sales Cron] Failed to write notification:', e.message);
  }
}

// Run sync and write notification
async function runScheduledSync() {
  const startTime = new Date();
  console.log(`[Sales Cron] Starting scheduled sync at ${startTime.toISOString()}`);
  
  try {
    const engine = new SalesSyncEngine();
    const results = await engine.syncAll();
    
    const duration = Math.round((Date.now() - startTime.getTime()) / 1000);
    const totalRecords = results.reduce((s, r) => s + (r.records_synced || 0), 0);
    const failedCompanies = results.filter(r => r.status === 'failed');
    
    if (failedCompanies.length === 0) {
      writeNotification('success',
        `مزامنة ناجحة للمبيعات — ${totalRecords} فاتورة في ${duration} ثانية`,
        { results, duration }
      );
      console.log(`[Sales Cron] Sync completed: ${totalRecords} records in ${duration}s`);
    } else {
      writeNotification('warning',
        `مزامنة جزئية للمبيعات — ${failedCompanies.length} شركة فشلت من أصل ${results.length}`,
        { results, duration, failedCompanies: failedCompanies.map(f => f.company_id) }
      );
      console.log(`[Sales Cron] Sync partial: ${failedCompanies.length} failed`);
    }
  } catch (err) {
    writeNotification('error',
      `فشل المزامنة للمبيعات: ${err.message}`,
      { error: err.message }
    );
    console.error('[Sales Cron] Scheduled sync failed:', err.message);
  }
}

// Start scheduler with given cron schedule
function startScheduler(schedule) {
  const settings = getSettings();
  
  if (!schedule) {
    if (!settings.enabled) {
      console.log('[Sales Cron] Sync scheduler disabled by settings');
      return;
    }
    schedule = intervalToCron(settings.intervalHours);
  }
  
  if (!schedule) return;
  
  if (scheduledJob) {
    scheduledJob.stop();
  }

  scheduledJob = cron.schedule(schedule, runScheduledSync, {
    scheduled: true,
    timezone: 'Asia/Riyadh'
  });

  currentSchedule = schedule;
  console.log(`[Sales Cron] Scheduler started with schedule: ${schedule}`);
}

// Reschedule with new interval
function reschedule(intervalHours, enabled) {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    currentSchedule = null;
  }
  
  if (!enabled) {
    console.log('[Sales Cron] Scheduler stopped by user');
    return;
  }
  
  const schedule = intervalToCron(intervalHours);
  if (!schedule) return;
  
  startScheduler(schedule);
  
  // Trigger an immediate sync run asynchronously so the user sees it working immediately
  setTimeout(() => {
    console.log('[Sales Cron] Triggering immediate sync upon user activation...');
    runScheduledSync();
  }, 2000);
}

function stopScheduler() {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    currentSchedule = null;
    console.log('[Sales Cron] Scheduler stopped');
  }
}

function getSchedulerStatus() {
  return {
    running: !!scheduledJob,
    schedule: currentSchedule
  };
}

module.exports = { startScheduler, stopScheduler, reschedule, getSchedulerStatus, runScheduledSync };
