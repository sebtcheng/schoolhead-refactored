const { Client } = require('ssh2');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const SERVER_IP = "20.24.58.49";
const SERVER_DIR = "/var/www/html/InsightEd-Mobile-PWA"; // Production Dir
const USER = "Administrator1";
const PASS = "7v52E69TYgTE"; 
const TAR_FILE = "production-deploy.tmp.tar.gz";
const INCLUDE = ['api', 'dist', 'public', 'package.json', 'package-lock.json', 'compress_pdf.py', 'forensic_heal.sh', 'ecosystem.config.cjs'];

console.log("================================================");
console.log("🚀 UNIFIED PRODUCTION DEPLOY & HEAL");
console.log(`Target: ${SERVER_IP} (${SERVER_DIR})`);
console.log("================================================");

function runLocal(command, env = process.env) {
    try {
        console.log(`> ${command}`);
        execSync(command, { stdio: 'inherit', env });
    } catch (error) {
        console.error(`❌ Local command failed: ${command}`);
        process.exit(1);
    }
}

async function deployAndHeal() {
    const conn = new Client();

    // 1. Build locally (No base prefix for production)
    console.log("\n🏗️  1. Building locally...");
    runLocal('npm run build', { ...process.env, MSYS_NO_PATHCONV: '1', NODE_OPTIONS: '--max-old-space-size=4096' });

    // 2. Prepare tarball
    console.log(`\n📦 2. Creating local archive (${TAR_FILE})...`);
    const missing = INCLUDE.filter(f => !fs.existsSync(f));
    if (missing.length > 0) {
        console.error(`❌ Missing critical files: ${missing.join(', ')}`);
        process.exit(1);
    }
    const tarFiles = INCLUDE.join(' ');
    runLocal(`tar -czf ${TAR_FILE} ${tarFiles}`);

    // 3. Connect and execute
    console.log(`\n🔌 3. Connecting to ${SERVER_IP}...`);
    
    conn.on('ready', () => {
        console.log('✅ SSH Connection Established.');

        // 3.1 Remote Cleanup & Setup
        console.log("🧹 3.1 Preparing remote directory...");
        conn.exec(`mkdir -p ${SERVER_DIR} && rm -rf ${SERVER_DIR}/dist ${SERVER_DIR}/api`, (err, stream) => {
            if (err) throw err;
            stream.on('data', (data) => {
                process.stdout.write(data);
            }).stderr.on('data', (data) => {
                process.stderr.write(data);
            });
            
            stream.on('close', () => {
                // 3.2 Upload via SFTP
                console.log("📤 3.2 Uploading archive via SFTP...");
                conn.sftp((err, sftp) => {
                    if (err) throw err;
                    const readStream = fs.createReadStream(TAR_FILE);
                    const writeStream = sftp.createWriteStream(`${SERVER_DIR}/${TAR_FILE}`);

                    writeStream.on('close', () => {
                        console.log("✅ Upload Complete.");

                        // 3.3 Final Remote Setup & Healing
                        console.log("\n🩺 4. Remote Extraction & Forensic Healing...");
                        // OVERRIDE: Point healer to production targets
                        const remoteCmd = `
                            cd ${SERVER_DIR} && 
                            (
                                tar -xzf ${TAR_FILE} || true
                            ) && 
                            rm -f ${TAR_FILE} && 
                            chmod +x forensic_heal.sh &&
                            npm cache clean --force 2>/dev/null && 
                            npm install --omit=dev --legacy-peer-deps && 
                            npm prune --omit=dev --legacy-peer-deps && 
                            npm cache clean --force 2>/dev/null &&
                            STAGING_DIR=${SERVER_DIR} PM2_NAME=insighted-backend ./forensic_heal.sh
                        `.replace(/\n/g, '').trim();

                        const stream_logger = (data) => process.stdout.write(data);

                        conn.exec(remoteCmd, (err, stream) => {
                            if (err) throw err;
                            stream.on('data', stream_logger).stderr.on('data', stream_logger);
                            stream.on('close', (code) => {
                                console.log(`\n✅ Remote healing finished (exit code: ${code})`);
                                conn.end();
                            });
                        });
                    });

                    readStream.pipe(writeStream);
                });
            });
        });

    }).connect({
        host: SERVER_IP,
        port: 22,
        username: USER,
        password: PASS,
        readyTimeout: 20000
    });

    conn.on('end', () => {
        console.log("\n🧹 5. Cleaning up local archive...");
        try { fs.unlinkSync(TAR_FILE); } catch (e) {}
        console.log("================================================");
        console.log("🎉 Production Recovery Complete!");
        console.log("================================================");
    });

    conn.on('error', (err) => {
        console.error('❌ SSH Connection Error:', err);
        process.exit(1);
    });
}

deployAndHeal().catch(err => {
    console.error('❌ Script error:', err);
    process.exit(1);
});
