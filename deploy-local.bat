@echo off
setlocal enabledelayedexpansion

:: Deployment Script (Local to Remote) - Batch Version
:: This script pushes code directly from your Windows CMD to the Azure VM.

set SERVER_IP=20.24.58.49
set SERVER_DIR=/var/www/html/InsightEd-Mobile-PWA
set SSH_USER=Administrator1
set SSH_PASS=<REDACTED_SSH_PASS>

echo ------------------------------------------------
echo 🚀 Local-to-Remote Deployment
echo ------------------------------------------------
echo Host: %SERVER_IP%
echo User: %SSH_USER%
echo Pass: %SSH_PASS%
echo (Please copy the password if prompted for SSH)
echo ------------------------------------------------

echo 1. Syncing local files to VM...
where rsync >nul 2>nul
if %errorlevel% neq 0 (
    set "RSYNC_PATH=C:\Program Files\Git\usr\bin\rsync.exe"
    if not exist "!RSYNC_PATH!" set "RSYNC_PATH=C:\Program Files (x86)\Git\usr\bin\rsync.exe"
    
    if not exist "!RSYNC_PATH!" (
        echo [INFO] 'rsync' not found. Falling back to 'scp' (built-in Windows tool)...
        scp -r ./api ./src ./public ./index.html ./package.json ./vite.config.js ./tailwind.config.js ./postcss.config.js %SSH_USER%@%SERVER_IP%:%SERVER_DIR%/
        if %errorlevel% neq 0 (
            echo [ERROR] Deployment failed.
            pause
            exit /b
        )
        goto :REMOTE_STEPS
    )
    set "RSYNC_CMD=!RSYNC_PATH!"
) else (
    set "RSYNC_CMD=rsync"
)

:: Using rsync
%RSYNC_CMD% -avz --delete ^
    --exclude "node_modules/" ^
    --exclude "dist/" ^
    --exclude ".git/" ^
    --exclude ".env" ^
    ./ %SSH_USER%@%SERVER_IP%:%SERVER_DIR%/

:REMOTE_STEPS
echo 2. Running remote build and restart...
# SSH into the server to perform installation and service restart
ssh %SSH_USER%@%SERVER_IP% "cd %SERVER_DIR% && npm install --legacy-peer-deps && npm run build && pm2 restart insighted-backend"

echo.
echo ✅ Deployment Complete!
echo ------------------------------------------------
pause
