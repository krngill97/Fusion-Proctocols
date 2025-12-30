@echo off
echo ========================================
echo  CLEARING BROWSER CACHE AND STARTING
echo ========================================
echo.

REM Kill any running Chrome instances
taskkill /F /IM chrome.exe 2>nul
taskkill /F /IM msedge.exe 2>nul
timeout /t 2 /nobreak >nul

echo Starting Chrome with cache disabled...
start chrome --disable-cache --disable-application-cache --incognito http://localhost:5173/volume-bot

echo.
echo ========================================
echo  Browser opened in INCOGNITO mode
echo  with cache DISABLED
echo ========================================
echo.
echo The 400 error should be GONE!
pause
