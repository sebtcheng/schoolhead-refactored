import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connection ready');
  conn.exec('sudo ufw status || echo "No ufw"; netstat -tuln; ps aux | grep pgbouncer', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '20.24.58.49',
  port: 22,
  username: 'mcp_agent',
  password: 'mcp_agent_secret_2026'
});
