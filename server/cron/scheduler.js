const cron = require('node-cron');
const SyncEngine = require('../services/sync-engine');
const CacheService = require('../services/cache');
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
    const rows = db.prepare("SELECT key, value FROM app_settings WHERE key IN ('sync_enabled','sync_interval_hours')").all();
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
    db.prepare('INSERT INTO sync_notifications (type, message, details) VALUES (?, ?, ?)').run(
      type, message, details ? JSON.stringify(details) : null
    );
    // Keep only the latest 50 notifications
    db.prepare('DELETE FROM sync_notifications WHERE id NOT IN (SELECT id FROM sync_notifications ORDER BY id DESC LIMIT 50)').run();
  } catch (e) {
    console.error('[Cron] Failed to write notification:', e.message);
  }
}

// Run sync and write notification
async function runScheduledSync() {
  const startTime = new Date();
  console.log(`[Cron] Starting scheduled unified sync at ${startTime.toISOString()}`);
  
  try {
    const engine = new SyncEngine();
    const results = await engine.syncAllUnified();
    
    const duration = results.duration || Math.round((Date.now() - startTime.getTime()) / 1000);
    const jRecords = results.stages?.journal_items?.records || 0;
    const sRecords = results.stages?.sales_invoices?.records || 0;
    const pRecords = results.stages?.payment_allocations?.totalAllocations || 0;
    const totalRecords = jRecords + sRecords + pRecords;

    writeNotification('success',
      `مزامنة موحدة ناجحة — ${totalRecords} سجل (قيود: ${jRecords}، فواتير: ${sRecords}، تسويات: ${pRecords}) في ${duration} ثانية`,
      { results, duration }
    );
    console.log(`[Cron] Unified sync completed: ${totalRecords} records in ${duration}s`);
  } catch (err) {
    writeNotification('error',
      `فشل المزامنة الموحدة: ${err.message}`,
      { error: err.message }
    );
    console.error('[Cron] Scheduled unified sync failed:', err.message);
  }
}

// Start scheduler with given cron schedule
function startScheduler(schedule) {
  const settings = getSettings();
  
  // If no schedule provided, derive from settings
  if (!schedule) {
    if (!settings.enabled) {
      console.log('[Cron] Sync scheduler disabled by settings');
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
  console.log(`[Cron] Scheduler started with schedule: ${schedule}`);
}

// Reschedule with new interval (called from API)
function reschedule(intervalHours, enabled) {
  // Stop existing
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    currentSchedule = null;
  }
  
  if (!enabled) {
    console.log('[Cron] Scheduler stopped by user');
    return;
  }
  
  const schedule = intervalToCron(intervalHours);
  if (!schedule) return;
  
  startScheduler(schedule);
}

function stopScheduler() {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    currentSchedule = null;
    console.log('[Cron] Scheduler stopped');
  }
}

function getSchedulerStatus() {
  return {
    running: !!scheduledJob,
    schedule: currentSchedule
  };
}

module.exports = { startScheduler, stopScheduler, reschedule, getSchedulerStatus, runScheduledSync };
