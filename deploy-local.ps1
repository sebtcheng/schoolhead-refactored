# Deployment Script (Local to Remote) - PowerShell Version
# This script pushes code directly from your Windows machine to the Azure VM.

$SERVER_IP = "20.24.58.49"
$SERVER_DIR = "/var/www/html/InsightEd-Mobile-PWA"
$USER = "Administrator1"
$TAR_FILE = "local-deploy.tmp.tar.gz"

Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "🚀 Local-to-Remote Deployment (PowerShell)" -ForegroundColor Cyan
Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "Host: $SERVER_IP"
Write-Host "User: $USER"
Write-Host "Target Dir: $SERVER_DIR"
Write-Host "------------------------------------------------"

Write-Host "🏗️  1. Building locally..." -ForegroundColor Yellow
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm run build

Write-Host "🧹 1.5 Cleaning remote destination..." -ForegroundColor Gray
ssh -o StrictHostKeyChecking=no "$($USER)@$($SERVER_IP)" "rm -rf $($SERVER_DIR)/dist $($SERVER_DIR)/api"

Write-Host "📦 2. Packing artifacts into archive..." -ForegroundColor Yellow
tar -czf $TAR_FILE dist api public package.json package-lock.json

Write-Host "📤 3. Syncing to VM via SCP..." -ForegroundColor Yellow
scp -o StrictHostKeyChecking=no $TAR_FILE "$($USER)@$($SERVER_IP):$($SERVER_DIR)/"

Write-Host "🚀 4. Remote Production Setup & Restart..." -ForegroundColor Yellow
$remoteCmd = "mkdir -p $($SERVER_DIR) && cd $($SERVER_DIR) && tar -xzf $TAR_FILE && rm $TAR_FILE && pm2 flush && npm install --omit=dev --legacy-peer-deps && (pm2 restart insighted-backend || PORT=3000 pm2 start api/index.js --name insighted-backend)"
ssh -o StrictHostKeyChecking=no "$($USER)@$($SERVER_IP)" $remoteCmd

Write-Host "🧹 5. Cleaning up local archive..." -ForegroundColor Gray
if (Test-Path $TAR_FILE) { Remove-Item $TAR_FILE }

Write-Host "✅ Local Deployment Complete!" -ForegroundColor Green
Write-Host "------------------------------------------------"
