# FUSION Pro - PowerShell Startup Script
# Run with: .\startfusion.ps1

Write-Host ""
Write-Host "  ===============================================" -ForegroundColor Cyan
Write-Host "    FUSION Pro - Testnet Trading Simulator" -ForegroundColor Cyan
Write-Host "  ===============================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node -v
    Write-Host "[INFO] Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed!" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

$rootPath = $PSScriptRoot

# Install dependencies if needed
if (-not (Test-Path "$rootPath\frontend\node_modules")) {
    Write-Host "[INFO] Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location "$rootPath\frontend"
    npm install
    Set-Location $rootPath
}

if (-not (Test-Path "$rootPath\backend\node_modules")) {
    Write-Host "[INFO] Installing backend dependencies..." -ForegroundColor Yellow
    Set-Location "$rootPath\backend"
    npm install
    Set-Location $rootPath
}

Write-Host ""
Write-Host "[INFO] Starting FUSION Pro..." -ForegroundColor Green
Write-Host ""
Write-Host "  Backend API:  http://localhost:5000" -ForegroundColor White
Write-Host "  Frontend UI:  http://localhost:5173" -ForegroundColor White
Write-Host ""

# Start backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootPath\backend'; Write-Host 'Starting Backend...' -ForegroundColor Cyan; npm run dev" -WindowStyle Normal

# Wait for backend
Start-Sleep -Seconds 3

# Start frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootPath\frontend'; Write-Host 'Starting Frontend...' -ForegroundColor Cyan; npm run dev" -WindowStyle Normal

Write-Host "[SUCCESS] FUSION Pro is starting!" -ForegroundColor Green
Write-Host ""
Write-Host "  Opening browser in 5 seconds..." -ForegroundColor Gray
Start-Sleep -Seconds 5
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "  Press any key to exit this window (servers will keep running)" -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
