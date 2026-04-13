#!/bin/bash
set -e # Exit on error

# Deployment Script (Local to Staging - Ultra Lean Edition)
# This script pushes a locally built production bundle and optimized assets
# to minimize server footprint and avoid ENOSPC errors.

SERVER_IP="20.24.58.49"
SERVER_DIR="/var/www/html/InsightEd-Staging"
USER="Administrator1"
TAR_FILE="staging-deploy.tmp.tar.gz"
PASS="7v52E69TYgTE"


echo "------------------------------------------------"
echo "🚀 Local-to-Staging Deployment (Incremental/Tarball)"
echo "------------------------------------------------"
echo "Host: $SERVER_IP"
echo "User: $USER"
echo "Password: $PASS"
echo "Target Dir: $SERVER_DIR"
echo "------------------------------------------------"


echo "🏗️  2. Building locally (Fixing path conversion)..."
MSYS_NO_PATHCONV=1 npm run build -- --base=/insighted-staging/

echo "🧹 2.5 Cleaning remote destination to free up space..."
ssh -o StrictHostKeyChecking=no -o BatchMode=yes $USER@$SERVER_IP "rm -rf $SERVER_DIR/dist $SERVER_DIR/api" || { echo "❌ [SSH Error] Password-less login failed. Please run: 'bash ./setup-ssh-key.sh' to automate your deployment."; exit 1; }

echo "📦 3. Packing artifacts into archive ($TAR_FILE)..."
tar -czf $TAR_FILE dist api public package.json package-lock.json compress_pdf.py forensic_heal.sh ecosystem.config.cjs

echo "📤 4. Syncing to VM Staging via SCP..."
scp -o StrictHostKeyChecking=no -o BatchMode=yes $TAR_FILE $USER@$SERVER_IP:$SERVER_DIR/

echo "🚀 5. Remote Production Setup, Maintenance & Restart..."
ssh -o StrictHostKeyChecking=no -o BatchMode=yes $USER@$SERVER_IP "
  set -e
  mkdir -p $SERVER_DIR
  cd $SERVER_DIR
  (tar -xzf $TAR_FILE || true) && rm -f $TAR_FILE

  # --- Temp dir for PDF compression pipeline (replaces /mnt/uploads) ---
  # All PDFs/images are stored in Postgres binary. This dir is scratch-only.
  mkdir -p /tmp/insighted-pdf-tmp
  chmod 775 /tmp/insighted-pdf-tmp

  npm cache clean --force 2>/dev/null
  npm install --omit=dev --legacy-peer-deps
  npm prune --omit=dev --legacy-peer-deps
  npm cache clean --force 2>/dev/null
  pm2 set pm2-logrotate:max_size 50M
  pm2 set pm2-logrotate:retain 5
  pm2 flush

  # Run Forensic Healer (Handles Nginx, Python deps, and PM2)
  sed -i 's/\r$//' forensic_heal.sh
  chmod +x forensic_heal.sh
  ./forensic_heal.sh
"


echo "🧹 Cleaning up local archive..."
rm -f $TAR_FILE

echo "✅ Staging Deployment Complete!"
echo "------------------------------------------------"

