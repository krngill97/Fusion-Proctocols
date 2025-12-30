@echo off
title FUSION Pro - Starting...
color 0A

echo.
echo  ===============================================
echo    FUSION Pro - Testnet Trading Simulator
echo  ===============================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Display Node version
echo [INFO] Node.js version:
node -v
echo.

:: Get the directory where this script is located
set "ROOT_DIR=%~dp0"

:: Check if dependencies are installed
if not exist "%ROOT_DIR%frontend\node_modules" (
    echo [INFO] Installing frontend dependencies...
    cd /d "%ROOT_DIR%frontend"
    call npm install
    echo.
)

if not exist "%ROOT_DIR%backend\node_modules" (
    echo [INFO] Installing backend dependencies...
    cd /d "%ROOT_DIR%backend"
    call npm install
    echo.
)

echo [INFO] Killing any existing servers on ports 5000 and 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do taskkill //F //PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do taskkill //F //PID %%a 2>nul
timeout /t 2 /nobreak >nul

echo [INFO] Starting FUSION Pro...
echo.
echo  Backend API:  http://localhost:5000
echo  Frontend UI:  http://localhost:5173
echo.

:: Start backend in a new window
start "FUSION Backend - Port 5000" cmd /k "cd /d %ROOT_DIR%backend && echo Starting Backend Server... && npm run dev"

:: Wait for backend to initialize
echo [INFO] Waiting for backend to start...
timeout /t 5 /nobreak >nul

:: Start frontend in a new window
start "FUSION Frontend - Port 5173" cmd /k "cd /d %ROOT_DIR%frontend && echo Starting Frontend Server... && npm run dev"

:: Wait a moment then open browser
timeout /t 3 /nobreak >nul

echo.
echo  ===============================================
echo    FUSION Pro is running!
echo  ===============================================
echo.
echo  Backend:  http://localhost:5000
echo  Frontend: http://localhost:5173
echo  Testnet:  http://localhost:5173/testnet
echo.
echo  Opening browser...
start http://localhost:5173

echo.
echo  Press any key to close this window.
echo  (Servers will keep running in their own windows)
echo.
pause >nul
