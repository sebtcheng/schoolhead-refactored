# Native PowerShell Deployment Script for Staging
# Mirroring logic from deploy-staging.sh (Local Build -> Upload Dist)

$SERVER_IP = "20.24.58.49"
$SERVER_DIR = "/var/www/html/InsightEd-Staging"
$USER = "Administrator1"
$TAR_FILE = "staging-deploy.tmp.tar.gz"

Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "🚀 Native PowerShell Staging Deployment" -ForegroundColor Cyan
Write-Host "Host: $SERVER_IP"
Write-Host "User: $USER"
Write-Host "Target: $SERVER_DIR"
Write-Host "------------------------------------------------"

# 1. Build locally
Write-Host "🏗️  1. Building locally..." -ForegroundColor Yellow
$env:MSYS_NO_PATHCONV=1
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run build -- --base=/insighted-staging/
if ($LASTEXITCODE -ne 0) { Write-Error "Build failed"; exit }

# 2. Remote Cleanup
Write-Host "🧹 2. Cleaning remote destination..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=no -o BatchMode=yes "$USER@$SERVER_IP" "rm -rf $SERVER_DIR/dist $SERVER_DIR/api"
if ($LASTEXITCODE -ne 0) { Write-Error "SSH Cleanup failed. Ensure your SSH key is setup."; exit }

# 3. Packing
Write-Host "📦 3. Packing artifacts..." -ForegroundColor Yellow
tar -czf $TAR_FILE dist api public package.json package-lock.json compress_pdf.py forensic_heal.sh ecosystem.config.cjs
if ($LASTEXITCODE -ne 0) { Write-Error "Packing failed"; exit }

# 4. Uploading
Write-Host "📤 4. Uploading to VM..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no -o BatchMode=yes $TAR_FILE "$USER@$SERVER_IP`:$SERVER_DIR/"
if ($LASTEXITCODE -ne 0) { Write-Error "SCP Upload failed"; exit }

# 5. Remote Setup
Write-Host "🚀 5. Remote Extraction & Maintenance..." -ForegroundColor Yellow
$remoteCmd = @"
  set -e
  mkdir -p $SERVER_DIR
  cd $SERVER_DIR
  (tar -xzf $TAR_FILE || true) && rm -f $TAR_FILE
  
  mkdir -p /tmp/insighted-pdf-tmp
  chmod 775 /tmp/insighted-pdf-tmp
  
  npm cache clean --force 2>/dev/null
  npm install --omit=dev --legacy-peer-deps
  npm prune --omit=dev --legacy-peer-deps
  
  pm2 set pm2-logrotate:max_size 50M
  pm2 set pm2-logrotate:retain 5
  pm2 flush
  
  chmod +x forensic_heal.sh
  ./forensic_heal.sh
"@

ssh -o StrictHostKeyChecking=no -o BatchMode=yes "$USER@$SERVER_IP" $remoteCmd
if ($LASTEXITCODE -ne 0) { Write-Error "Remote deployment failed"; exit }

# 6. Cleanup
Write-Host "🧹 6. Local Cleanup..." -ForegroundColor Yellow
if (Test-Path $TAR_FILE) { Remove-Item $TAR_FILE }

Write-Host "------------------------------------------------"
Write-Host "✅ Staging Deployment Complete!" -ForegroundColor Green
Write-Host "------------------------------------------------"
