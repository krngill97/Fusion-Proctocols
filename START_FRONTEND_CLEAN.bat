@echo off
echo ========================================
echo FUSION Frontend - Clean Start
echo ========================================
echo.

cd /d "%~dp0frontend"

echo [1/3] Checking for node_modules...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo.
echo [2/3] Starting frontend...
echo.
echo Frontend will start in 2 seconds...
timeout /t 2 /nobreak >nul

npm run dev

pause
