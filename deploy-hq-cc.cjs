const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const SERVER_IP = "20.24.58.49";
const USER = "Administrator1";
const PASS = "<REDACTED_SSH_PASS>";
const TAR_FILE = "deployment.tar.gz";
const REMOTE_DIR = "/home/Administrator1/deployment";

async function deploy() {
    const conn = new Client();

    conn.on('ready', () => {
        console.log('✅ SSH Connection Established.');
        
        conn.sftp((err, sftp) => {
            if (err) throw err;
            console.log(`📤 Uploading ${TAR_FILE}...`);
            const readStream = fs.createReadStream(TAR_FILE);
            const writeStream = sftp.createWriteStream(`${REMOTE_DIR}/${TAR_FILE}`);

            writeStream.on('close', () => {
                console.log("✅ Upload Complete.");

                const remoteCmd = `
                    mkdir -p /var/www/html/command-center
                    mkdir -p /var/www/html/insighted-hq
                    cd ${REMOTE_DIR}
                    tar -xzf ${TAR_FILE} -C .
                    
                    echo "🚀 [1/4] Setting up InsightEd HQ (Dashboard)..."
                    cd insighted-hq/api
                    npm install --omit=dev
                    pm2 delete hq-backend 2>/dev/null || true
                    pm2 start server.js --name "hq-backend"
                    
                    sudo mkdir -p /var/www/html/insighted-hq/dist
                    sudo cp -r ../dist/* /var/www/html/insighted-hq/dist/
                    sudo chown -R www-data:www-data /var/www/html/insighted-hq
                    
                    echo "🚀 [2/4] Setting up Command Center (Scripts)..."
                    cd ../../command-center/api
                    npm install --omit=dev
                    pm2 delete command-center 2>/dev/null || true
                    pm2 start server.js --name "command-center"
                    
                    sudo mkdir -p /var/www/html/command-center-tools
                    sudo cp -r ../dist/* /var/www/html/command-center-tools/
                    sudo chown -R www-data:www-data /var/www/html/command-center-tools
                    
                    echo "⚙️ [3/4] Integrating Nginx Configs..."
                    sudo cp ../../nginx/command_center.conf /etc/nginx/sites-available/insighted-hq.conf
                    sudo cp ../../nginx/command_center_scripts.conf /etc/nginx/sites-available/command-center.conf
                    
                    sudo ln -sf /etc/nginx/sites-available/insighted-hq.conf /etc/nginx/sites-enabled/
                    sudo ln -sf /etc/nginx/sites-available/command-center.conf /etc/nginx/sites-enabled/
                    
                    echo "🔄 [4/4] Reloading Nginx..."
                    sudo nginx -t && sudo systemctl reload nginx
                    pm2 save
                    echo "✨ DEPLOYMENT COMPLETE!"
                `;

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
    }).connect({
        host: SERVER_IP,
        port: 22,
        username: USER,
        password: PASS
    });
}

deploy().catch(console.error);
