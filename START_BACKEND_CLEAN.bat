@echo off
echo ========================================
echo FUSION Backend - Clean Start
echo ========================================
echo.

cd /d "%~dp0backend"

echo [1/3] Checking for node_modules...
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo.
echo [2/3] Cleaning old processes...
taskkill /F /IM node.exe 2>nul

echo.
echo [3/3] Starting backend...
echo.
echo Backend will start in 3 seconds...
timeout /t 3 /nobreak >nul

node src/index.js

pause
