const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SERVER_IP = "20.24.58.49";
const USER = "Administrator1";
const PASS = "<REDACTED_SSH_PASS>";

const conn = new Client();
const pubKey = fs.readFileSync(path.join(os.homedir(), '.ssh', 'id_rsa.pub'), 'utf8').trim();

console.log('🔌 Connecting...');

conn.on('ready', () => {
    console.log('✅ Ready. Executing command...');
    conn.exec(`echo "${pubKey}" >> ~/.ssh/authorized_keys`, (err, stream) => {
        if (err) { console.error(err); process.exit(1); }
        stream.on('close', (code) => {
            console.log(`✅ Done. Exit code: ${code}`);
            conn.end();
            process.exit(0);
        }).on('data', (data) => {
            console.log('STDOUT: ' + data);
        }).stderr.on('data', (data) => {
            console.log('STDERR: ' + data);
        });
    });
}).on('error', (err) => {
    console.error('❌ Connection error:', err);
    process.exit(1);
}).connect({
    host: SERVER_IP,
    port: 22,
    username: USER,
    password: PASS
});
