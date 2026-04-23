# --- CONFIGURATION ---
$VM_USER = "Administrator1"
$VM_IP = "20.24.58.49"
$REMOTE_PATH = "/mnt/esf7_archive/"
$LOCAL_BACKUP_PATH = "E:\InsightEd-Mobile-PWA\backups\esf7_vault\"

# Ensure local directory exists
if (!(Test-Path $LOCAL_BACKUP_PATH)) {
    New-Item -ItemType Directory -Force -Path $LOCAL_BACKUP_PATH
}

Write-Host "[Vault] Starting Extraction from Staging..." -ForegroundColor Cyan

# 1. Sync files from VM to Local using SCP
Write-Host "[Vault] Downloading batch files..." -ForegroundColor Yellow
scp -r "${VM_USER}@${VM_IP}:${REMOTE_PATH}*" "$LOCAL_BACKUP_PATH"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[Vault] Download Successful!" -ForegroundColor Green
    
    # 2. Verify: Check if the folder is still empty or has files
    $fileCount = (Get-ChildItem -Path $LOCAL_BACKUP_PATH -Recurse | Measure-Object).Count
    if ($fileCount -gt 0) {
        Write-Host "[Vault] Verified: $fileCount files safely stored in $LOCAL_BACKUP_PATH" -ForegroundColor Gray
        
        # 3. PURGE: Delete the source files from the VM now that they are safe locally
        Write-Host "[Vault] Purging VM Archive (Verified Purge)..." -ForegroundColor Magenta
        ssh "${VM_USER}@${VM_IP}" "sudo rm -rf ${REMOTE_PATH}*"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[Vault] Vault Cleared on VM. Backups are now Local-Only." -ForegroundColor Green
        } else {
            Write-Warning "[Vault] Files downloaded, but failed to delete from VM. Please check permissions."
        }
    } else {
        Write-Host "[Vault] No new files found in the Vault. Nothing to purge." -ForegroundColor Cyan
    }
} else {
    Write-Error "[Vault] Download Failed! The VM Archive was NOT deleted."
}

Write-Host "[Vault] Process Complete." -ForegroundColor Cyan
