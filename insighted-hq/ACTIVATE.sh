#!/bin/bash

# 🚀 InsightEd HQ Activation Script
# Follows nginx-pro.md and senior-dev.md standards.

echo "🏗️ [1/3] Setting up HQ Backend..."
cd command-center/api
npm install
pm2 delete hq-backend 2>/dev/null || true
pm2 start server.js --name "hq-backend"
pm2 save

echo "📂 [2/3] Preparing Web Root..."
sudo mkdir -p /var/www/html/command-center
sudo cp -r ../dist/* /var/www/html/command-center/
sudo chown -R www-data:www-data /var/www/html/command-center
sudo chmod -R 755 /var/www/html/command-center

echo "⚙️ [3/3] Configuring Nginx Integration..."
echo "⚠️ [Note] Ensure you add the blocks from nginx/command_center.conf to your /etc/nginx/sites-available/stride.conf"
sudo nginx -t && sudo systemctl reload nginx

echo "✅ InsightEd HQ is ready for integration at https://stride.deped.gov.ph/insighted-hq/"
