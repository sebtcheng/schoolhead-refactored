#!/usr/bin/env node
const { Client } = require('ssh2');

const CONFIG = {
    host: '20.24.58.49',
    port: 22,
    username: 'Administrator1',
    password: '<REDACTED_SSH_PASS>', // Synced with staging credentials
    readyTimeout: 30000
};

const conn = new Client();

console.log(`\n\x1b[36m--- 🛰️  JARVIS: REMOTE VM DIAGNOSTIC (STRIDE-PROD-VM-01) ---\x1b[0m`);
console.log(`\x1b[33mConnecting to ${CONFIG.host}...\x1b[0m`);

conn.on('ready', () => {
    console.log('\x1b[32m✅ SSH Connection Established.\x1b[0m');
    
    // 1. Check OS and Uptime
    conn.exec('uptime && uname -a', (err, stream) => {
        if (err) throw err;
        stream.on('close', () => {
            
            // 2. Main Storage Check
            console.log('\n\x1b[1mSTORAGE Vitals (df -h):\x1b[0m');
            conn.exec('df -h', (err, stream) => {
                let dfOutput = '';
                if (err) throw err;
                stream.on('data', (data) => {
                    dfOutput += data;
                    process.stdout.write(data);
                });
                
                stream.on('close', () => {
                    
                    // 3. Health Analysis (Heuristics)
                    console.log('\n\x1b[36m--- 🤖 JARVIS ANALYSIS ---\x1b[0m');
                    const lines = dfOutput.split('\n');
                    let healthIssues = 0;
                    
                    lines.forEach(line => {
                        const match = line.match(/(\d+)%/);
                        if (match) {
                            const percent = parseInt(match[1]);
                            if (percent > 90) {
                                const mount = line.split(/\s+/).pop();
                                console.log(`\x1b[31m[CRITICAL] Partition ${mount} is at ${percent}% capacity!\x1b[0m`);
                                healthIssues++;
                            }
                        }
                    });
                    
                    if (healthIssues === 0) {
                        console.log('\x1b[32m[OK] All storage partitions within nominal limits.\x1b[0m');
                    } else {
                        console.log(`\x1b[33m[TIP] Focus on moving historical logs or documents to the /mnt volume (280GB free).\x1b[0m`);
                    }

                    // 4. Check for Large Files (>100MB)
                    console.log('\n\x1b[1mTOP 5 LARGE FILES (Root Partition):\x1b[0m');
                    conn.exec('find / -type f -size +50M -not -path "/proc/*" -not -path "/sys/*" -not -path "/mnt/*" 2>/dev/null | xargs du -h 2>/dev/null | sort -hr | head -n 5', (err, stream) => {
                        if (err) throw err;
                        stream.on('close', () => {
                            console.log(`\n\x1b[32m--- Diagnostic Complete ---\x1b[0m`);
                            conn.end();
                        }).on('data', (data) => process.stdout.write(data));
                    });
                });
            });
        }).on('data', (data) => process.stdout.write(data));
    });
}).connect(CONFIG);

conn.on('error', (err) => {
    console.error('\n\x1b[31m❌ SSH Error:\x1b[0m', err.message);
    process.exit(1);
});

conn.on('end', () => {
    console.log('🔌 Connection closed.');
});
