#!/usr/bin/env node
const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
    console.log('--- VM DIAGNOSTIC START ---');
    console.log('✅ SSH Connection Established.');
    
    // Check OS
    conn.exec('uname -a || ver', (err, stream) => {
        if (err) throw err;
        stream.on('close', (code) => {
            console.log('\n--- STORAGE (DF -H) ---');
            conn.exec('df -h', (err, stream) => {
                if (err) throw err;
                stream.on('close', () => {
                    console.log('\n--- STORAGE (POWERSHELL) ---');
                    conn.exec('powershell -Command "Get-PSDrive -PSProvider FileSystem | Select-Object Name, Used, Free, Root | Format-Table -AutoSize"', (err, stream) => {
                        if (err) throw err;
                        stream.on('close', () => {
                            console.log('--- VM DIAGNOSTIC END ---');
                            conn.end();
                        }).on('data', (data) => process.stdout.write(data));
                    }).on('data', (data) => process.stdout.write(data));
                }).on('data', (data) => process.stdout.write(data));
            }).on('data', (data) => process.stdout.write(data));
        }).on('data', (data) => process.stdout.write(data));
    });
}).connect({
    host: '20.24.58.49',
    port: 22,
    username: 'Administrator1',
    password: '<REDACTED_SSH_PASS>',
    readyTimeout: 30000
});

conn.on('error', (err) => {
    console.error('❌ SSH Error:', err);
});

conn.on('end', () => {
    console.log('🔌 Connection closed.');
});
