const { Client } = require('ssh2');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const SERVER_IP = "20.24.58.49";
const SERVER_DIR = "/var/www/html/InsightEd-Staging";
const USER = "Administrator1";
const PASS = "7v52E69TYgTE"; // Hardcoded as requested
const TAR_FILE = "staging-deploy.tmp.tar.gz";
const INCLUDE = ['api', 'dist', 'public', 'package.json', 'package-lock.json', 'compress_pdf.py', 'forensic_heal.sh', 'ecosystem.config.cjs'];

console.log("------------------------------------------------");
console.log("🚀 Automated Local-to-Staging Deployment");
console.log(`Host: ${SERVER_IP}`);
console.log(`User: ${USER}`);
console.log(`Password: ${PASS}`);
console.log("------------------------------------------------");

function runLocal(command, env = process.env) {
    try {
        console.log(`> ${command}`);
        execSync(command, { stdio: 'inherit', env });
    } catch (error) {
        console.error(`❌ Local command failed: ${command}`);
        process.exit(1);
    }
}

async function deploy() {
    const conn = new Client();

    // 1. Build locally
    console.log("🏗️  1. Building locally...");
    runLocal('npm run build -- --base=/insighted-staging/', { ...process.env, MSYS_NO_PATHCONV: '1', NODE_OPTIONS: '--max-old-space-size=4096' });

    // 2. Prepare tarball
    console.log(`📦 2. Creating local archive (${TAR_FILE})...`);
    const tarFiles = INCLUDE.join(' ');
    runLocal(`tar -czf ${TAR_FILE} ${tarFiles}`);

    // 3. Connect and execute
    console.log(`🔌 3. Connecting to ${SERVER_IP}...`);
    
    conn.on('ready', () => {
        console.log('✅ SSH Connection Established.');

        // 3.1 Remote Cleanup
        console.log("🧹 3.1 Cleaning remote destination to free up space...");
        conn.exec(`rm -rf ${SERVER_DIR}/dist ${SERVER_DIR}/api`, (err, stream) => {
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

                        // 3.3 Final Remote Setup
                        console.log("🚀 3.3 Extracting and Starting Production...");
                        const remoteCmd = `
                            mkdir -p ${SERVER_DIR} && 
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
                            ./forensic_heal.sh
                        `.replace(/\n/g, '').trim();

                        conn.exec(remoteCmd, (err, stream) => {
                            if (err) throw err;
                            stream.on('close', (code) => {
                                console.log(`✅ Remote execution finished (exit code: ${code})`);
                                conn.end();
                            }).on('data', (data) => {
                                process.stdout.write(data);
                            }).stderr.on('data', (data) => {
                                process.stderr.write(data);
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
        console.log("🧹 4. Cleaning up local archive...");
        try { fs.unlinkSync(TAR_FILE); } catch (e) {}
        console.log("✅ Staging Deployment Complete!");
        console.log("------------------------------------------------");
    });

    conn.on('error', (err) => {
        console.error('❌ SSH Connection Error:', err);
        process.exit(1);
    });
}

deploy().catch(err => {
    console.error('❌ Deployment script error:', err);
    process.exit(1);
});
