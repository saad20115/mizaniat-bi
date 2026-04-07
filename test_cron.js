const fs = require('fs');
const path = require('path');
const { reschedule, getSchedulerStatus } = require('./server/cron/sales_scheduler');
const { getDb } = require('./server/db/connection');

// Mock POST /settings/schedule
const db = getDb();
db.prepare("INSERT OR REPLACE INTO sales_app_settings (key, value) VALUES ('sync_enabled', ?)").run('true');
db.prepare("INSERT OR REPLACE INTO sales_app_settings (key, value) VALUES ('sync_interval_hours', ?)").run('2');

console.log('Before Reschedule', getSchedulerStatus());
reschedule(2, true);
console.log('After Reschedule', getSchedulerStatus());
