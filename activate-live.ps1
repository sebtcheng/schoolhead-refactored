# 🚀 InsightEd School Head Portal: Activation Script
# Run this script to sync and activate the schoolhead instance on stride.deped.gov.ph

$Server = "stride.deped.gov.ph"
$User = "azureuser" # Change this if your SSH username is different
$RemotePath = "/var/www/html/InsightEd-Mobile-PWA/schoolhead"
$LocalArchive = "schoolhead-deploy.tar.gz"

Write-Host "📡 Transferring package to $Server..." -ForegroundColor Cyan
scp $LocalArchive "${User}@${Server}:/tmp/"

Write-Host "🏗️ Setting up remote directory..." -ForegroundColor Cyan
ssh "${User}@${Server}" "sudo mkdir -p $RemotePath && sudo chown -R `$USER:`$USER $RemotePath"

Write-Host "📦 Extracting assets..." -ForegroundColor Cyan
ssh "${User}@${Server}" "tar -xzf /tmp/$LocalArchive -C $RemotePath"

Write-Host "🔑 Inheriting production environment..." -ForegroundColor Cyan
ssh "${User}@${Server}" "cp $RemotePath/../.env $RemotePath/.env"

Write-Host "⚙️ Installing production dependencies..." -ForegroundColor Cyan
ssh "${User}@${Server}" "cd $RemotePath && npm install --production"

Write-Host "🚀 Activating Backend (PM2)..." -ForegroundColor Cyan
ssh "${User}@${Server}" "cd $RemotePath && pm2 delete insighted-schoolhead-backend; pm2 start ecosystem.schoolhead.config.cjs"

Write-Host "🌐 Reloading Nginx..." -ForegroundColor Cyan
Write-Host "⚠️ Remember to add the location blocks from nginx/schoolhead_isolated.conf to your stride.conf first!" -ForegroundColor Yellow
ssh "${User}@${Server}" "sudo nginx -t && sudo systemctl reload nginx"

Write-Host "✅ Activation sequence complete!" -ForegroundColor Green
Write-Host "Visit: https://stride.deped.gov.ph/insighted-schoolhead/" -ForegroundColor Cyan
