const { NodeSSH } = require('node-ssh');

const ssh = new NodeSSH();

async function run() {
  try {
    console.log('Connecting...');
    await ssh.connect({
      host: '187.124.42.244',
      username: 'root',
      password: 'SCe@11223344'
    });
    console.log('Connected!');
    
    // Find the mizaniat app
    const pathFound = '/opt/mizaniat';
    
    if (pathFound) {
      console.log('Found app at:', pathFound);
      
      console.log('Pulling latest from git...');
      const pullRes = await ssh.execCommand('git stash && git pull origin main', { cwd: pathFound });
      console.log(pullRes.stdout);
      if (pullRes.stderr) console.error(pullRes.stderr);

      // Check how the app is running
      console.log('Checking pm2 list...');
      const pm2Res = await ssh.execCommand('pm2 list');
      console.log(pm2Res.stdout);
      if (pm2Res.stdout && pm2Res.stdout.includes('mizaniat')) {
        console.log('Restarting PM2 process...');
        const restartRes = await ssh.execCommand('pm2 restart all');
        console.log(restartRes.stdout);
      } else {
        // Try other restarts
        console.log('Restarting service or PM2...');
        const restartRes = await ssh.execCommand('pm2 start ecosystem.config.js || pm2 start npm --name "mizaniat" -- run server', { cwd: pathFound });
        console.log(restartRes.stdout);
      }
    } else {
      console.log('Could not find mizaniat directory! Running global find:');
      const allFound = await ssh.execCommand('find / -name "mizaniat*" -type d 2>/dev/null | grep -v "/var/lib/docker" | head -n 5');
      console.log(allFound.stdout);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    ssh.dispose();
  }
}
run();
