const { Client } = require('ssh2');

const SERVER_IP = "20.24.58.49";
const USER = "Administrator1";
const PASS = "<REDACTED_SSH_PASS>";

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ SSH Connection Established.');
    conn.exec('pm2 stop insighted-staging && pm2 save', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log(`✅ pm2 stop executed (exit code: ${code})`);
            conn.end();
        }).on('data', (data) => {
            process.stdout.write(data);
        }).stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).connect({
    host: SERVER_IP,
    port: 22,
    username: USER,
    password: PASS,
    readyTimeout: 20000
});

conn.on('error', (err) => {
    console.error('❌ SSH Connection Error:', err);
    process.exit(1);
});
