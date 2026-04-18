#!/bin/bash

# 🚀 Command Center Script Orchestrator Activation
# Follows nginx-pro.md and senior-dev.md standards.

echo "🏗️ [1/3] Setting up CC Script Backend..."
cd command-center/api
npm install
pm2 delete command-center 2>/dev/null || true
pm2 start server.js --name "command-center"
pm2 save

echo "📂 [2/3] Preparing Web Root..."
sudo mkdir -p /var/www/html/command-center-tools
sudo cp -r ../dist/* /var/www/html/command-center-tools/
sudo chown -R www-data:www-data /var/www/html/command-center-tools
sudo chmod -R 755 /var/www/html/command-center-tools

echo "⚙️ [3/3] Configuring Nginx Integration..."
echo "⚠️ [Note] Ensure you add the blocks from nginx/command_center_scripts.conf to your /etc/nginx/sites-available/stride.conf"
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Command Center Script Orchestrator is ready at https://stride.deped.gov.ph/command-center/"
