const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to VPS');
  const commands = [
    'echo "=== PM2 ERROR LOGS (last 50) ==="',
    'tail -50 /root/.pm2/logs/whatzupp-error.log 2>/dev/null || echo "no error log"',
    'echo "=== PM2 OUT LOGS (last 80) ==="',
    'tail -80 /root/.pm2/logs/whatzupp-out.log 2>/dev/null || echo "no out log"',
  ].join(' ; ');
  
  conn.exec(commands, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let output = '';
    stream.on('data', (data) => { output += data.toString(); });
    stream.stderr.on('data', (data) => { output += data.toString(); });
    stream.on('close', () => {
      console.log(output);
      conn.end();
    });
  });
});
conn.on('error', (err) => console.error('Connection error:', err));
conn.connect({
  host: '31.97.207.239',
  port: 22,
  username: 'root',
  password: 'Pentacloud@123',
});
