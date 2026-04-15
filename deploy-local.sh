#!/bin/bash
set -eo pipefail # Exit on error, pipefail for better error catching

# Deployment Script (Local to Remote - Ultra Lean Edition)
# Optimized for robustness, logging, and performance.

# --- CONFIGURATION ---
SERVER_IP="20.24.58.49"
SERVER_DIR="/var/www/html/InsightEd-Mobile-PWA"
USER="Administrator1"
TAR_FILE="local-deploy.tmp.tar.gz"
PM2_NAME="insighted-backend"
# SSH command alias for convenience
SSH_CMD="ssh -o StrictHostKeyChecking=no -o BatchMode=yes $USER@$SERVER_IP"
SCP_CMD="scp -o StrictHostKeyChecking=no -o BatchMode=yes"

# --- LOGGING FUNCTIONS ---
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $*${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $*${NC}"; }
fail() { echo -e "${RED}❌ $*${NC}"; exit 1; }
info() { echo -e "${CYAN}ℹ️  $*${NC}"; }

# --- PRE-FLIGHT CHECKS ---
info "------------------------------------------------"
info "🚀 Local-to-Remote Deployment: $PM2_NAME"
info "------------------------------------------------"
info "Host: $SERVER_IP | User: $USER"
info "Target: $SERVER_DIR"
info "------------------------------------------------"

# Verify local environment
if [ ! -f "package.json" ]; then
  fail "Error: package.json not found in current directory. Are you in the project root?"
fi

# Check SSH connection early
info "Verifying SSH connection..."
$SSH_CMD "echo 'SSH Connection OK'" > /dev/null || fail "SSH connection failed. Run ./setup-ssh-key-simple.cjs first."

# --- BUILD ---
info "🏗️  1. Building locally..."
MSYS_NO_PATHCONV=1 NODE_OPTIONS="--max-old-space-size=4096" npm run build || fail "Build failed. Aborting deployment."
ok "Build successful."

# --- PREPARE REMOTE ---
info "Cleaning remote destination to free up space..."
$SSH_CMD "rm -rf $SERVER_DIR/dist $SERVER_DIR/api" || warn "Remote cleanup failed or directory didn't exist."

# --- PACK & SYNC ---
info "📦 2. Packing artifacts into $TAR_FILE..."
tar -czf "$TAR_FILE" dist api public package.json package-lock.json compress_pdf.py forensic_heal.sh ecosystem.config.cjs || fail "Failed to create archive."
ok "Archive created."

info "📤 3. Syncing to VM via SCP..."
$SCP_CMD "$TAR_FILE" "$USER@$SERVER_IP:$SERVER_DIR/" || fail "SCP failed."
ok "Transfer complete."

# --- REMOTE EXECUTION ---
info "🚀 4. Remote Production Setup & Restart..."
$SSH_CMD "
  set -eo pipefail
  mkdir -p $SERVER_DIR
  cd $SERVER_DIR
  
  info() { echo -e '\033[0;36mℹ️  '\"\$*\"'\033[0m'; }
  ok()   { echo -e '\033[0;32m✅ '\"\$*\"'\033[0m'; }

  info 'Extracting archive...'
  tar -xzf $TAR_FILE && rm -f $TAR_FILE
  
  # Ensure forensic_heal.sh is executable and clean
  sed -i 's/\r$//' forensic_heal.sh
  chmod +x forensic_heal.sh

  info 'Installing production dependencies...'
  npm cache clean --force 2>/dev/null
  npm install --omit=dev --legacy-peer-deps
  npm prune --omit=dev --legacy-peer-deps
  
  info 'Triggering Forensic Healer (Handles Nginx, Python, PM2)...'
  STAGING_DIR=$SERVER_DIR PM2_NAME=$PM2_NAME ./forensic_heal.sh
" || fail "Remote execution failed."

# --- CLEANUP ---
info "🧹 5. Cleaning up local archive..."
rm -f "$TAR_FILE"

ok "Local Deployment Complete!"
info "------------------------------------------------"
