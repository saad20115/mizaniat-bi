const { NodeSSH } = require('node-ssh');
const path = require('path');

const ssh = new NodeSSH();

async function run() {
  try {
    console.log('Connecting to Hostinger for DB Upload...');
    await ssh.connect({
      host: '187.124.42.244',
      username: 'root',
      password: 'SCe@11223344'
    });
    console.log('Connected!');

    const localDbPath = path.join(__dirname, '..', 'data', 'mizaniat.db');
    const remoteDbPath = '/opt/mizaniat/data/mizaniat.db';

    console.log('Stopping PM2 to safely overwrite database...');
    await ssh.execCommand('pm2 stop all');
    console.log(`Uploading ${localDbPath} -> ${remoteDbPath}...`);
    // Upload the fully checkpointed DB
    await ssh.putFile(localDbPath, remoteDbPath);
    console.log('Upload complete!');

    console.log('Fixing SQLite WAL File mismatch...');
    await ssh.execCommand('rm -f /opt/mizaniat/data/mizaniat.db-wal /opt/mizaniat/data/mizaniat.db-shm');
    console.log('Deleted WAL files.');

    console.log('Restarting PM2...');
    const pm2Res = await ssh.execCommand('pm2 restart all');
    console.log(pm2Res.stdout);
    if(pm2Res.stderr) console.error(pm2Res.stderr);
    
    console.log('Checking pm2 status...');
    const stat = await ssh.execCommand('pm2 list');
    console.log(stat.stdout);
    
    // Also check pm2 logs if it crashed
    const logs = await ssh.execCommand('pm2 logs mizaniat --lines 10 --nostream');
    console.log('LOGS: ', logs.stdout);
    if(logs.stderr) console.error('ERR LOGS:', logs.stderr);
    console.log('Done!');
  } catch (err) {
    console.error('Error during upload:', err);
  } finally {
    ssh.dispose();
  }
}
run();
