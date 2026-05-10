@echo off
title Now Playing Overlay Server
cd /d "%~dp0"

echo.
echo  ============================================
echo   Now Playing Overlay for TikTok LIVE Studio
echo  ============================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed.
    echo  Download it from https://nodejs.org
    pause
    exit /b 1
)

echo  [1/3] Cleaning up old processes...
taskkill /F /IM MediaReader.exe >nul 2>nul
powershell -Command "Get-NetTCPConnection -LocalPort 8080, 8974 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo  [2/3] Compiling native Windows Media adapter...
call .\compile.bat >nul 2>nul

echo  [3/3] Starting Backend Server (Hidden)...
:: Start the server in the background of this window
start /B node server.js > server.log 2>&1

:: Wait for server to bind
timeout /t 3 >nul

echo.
echo  ================================================
echo   Now Playing Overlay - HTTPS Tunnel
echo  ================================================
echo.

set RETRY_COUNT=0

:tunnel_start
echo  Attempting to create Cloudflare tunnel...
if not exist "cloudflared.exe" (
    echo  [ERROR] cloudflared.exe not found in the current directory.
    echo  Please download it from https://github.com/cloudflare/cloudflared/releases
    pause
    goto cleanup
)

.\cloudflared.exe tunnel --url http://localhost:8080
if %ERRORLEVEL% NEQ 0 (
    set /a RETRY_COUNT+=1
    echo.
    echo  [WARNING] Cloudflare failed (Attempt %RETRY_COUNT%)...
    timeout /t 5 >nul
    goto tunnel_start
)
goto cleanup

:cleanup
echo.
echo  Stopping servers...
taskkill /F /IM MediaReader.exe >nul 2>nul
powershell -Command "Get-NetTCPConnection -LocalPort 8080, 8974 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo  Done.
pause
