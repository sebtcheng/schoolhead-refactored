# InsightEd Python Environment Repair Script
$ErrorActionPreference = "Stop"

Write-Host "🔍 Checking for Python 3.13..." -ForegroundColor Cyan

# 1. Try to find Python
$executable = ""
$args_list = @()

if (Get-Command "python" -ErrorAction SilentlyContinue) {
    $ver = python --version 2>$null
    if ($ver -match "3.13") {
        $executable = "python"
    }
}

if (-not $executable -and (Get-Command "py" -ErrorAction SilentlyContinue)) {
    try {
        & py -3.13 --version 2>$null
        $executable = "py"
        $args_list = @("-3.13")
        Write-Host "✅ Found Python 3.13 via launcher (py)"
    } catch {}
}

if (-not $executable) {
    Write-Host "❌ Python 3.13 not found." -ForegroundColor Red
    Write-Host "Please install Python 3.13 from python.org."
    exit 1
}

# 2. Create Virtual Environment
if (-not (Test-Path "venv")) {
    Write-Host "📦 Creating virtual environment (venv)..." -ForegroundColor Cyan
    & $executable $args_list -m venv venv
    Write-Host "✅ venv created." -ForegroundColor Green
}

# 3. Install Dependencies
Write-Host "🛠️ Installing dependencies..." -ForegroundColor Cyan
& .\venv\Scripts\python.exe -m pip install --upgrade pip
& .\venv\Scripts\pip.exe install psycopg2-binary python-dotenv

Write-Host "✅ Dependencies installed." -ForegroundColor Green

# 4. Run the Script
Write-Host "`n🚀 Running Regional School Migration Audit..." -ForegroundColor Magenta
Write-Host "--------------------------------------------------"
& .\venv\Scripts\python.exe fave_scripts\new_fave\insighted_registration.py
Write-Host "--------------------------------------------------"

Write-Host "`n✨ Done!" -ForegroundColor Green
