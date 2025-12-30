@echo off
title FUSION Pro - Stop Script
color 0C

echo.
echo  ===============================================
echo    FUSION Pro - Stopping Servers
echo  ===============================================
echo.

:: Kill Node.js processes on ports 5000 and 5173
echo [INFO] Stopping backend server (port 5000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>nul
)

echo [INFO] Stopping frontend server (port 5173)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>nul
)

echo.
echo [SUCCESS] FUSION Pro servers stopped.
echo.
pause
