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
    echo  [ERROR] cloudflared.exe not found.
    pause
    goto cleanup
)

:: Run cloudflared and auto-copy the URL to clipboard using PowerShell
powershell -Command ".\cloudflared.exe tunnel --url http://localhost:8080 2>&1 | ForEach-Object { Write-Host $_; if ($_ -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') { $url = $matches[0]; $url | Set-Clipboard; Write-Host \"`n[SUCCESS] URL COPIED TO CLIPBOARD: $url`n\" -ForegroundColor Cyan } }"

if %ERRORLEVEL% NEQ 0 (
    set /a RETRY_COUNT+=1
    echo.
    echo  [WARNING] Tunnel disconnected (Attempt %RETRY_COUNT%).
    echo  [HINT] Type 'report' to open a bug issue with logs, or press any key to retry.
    timeout /t 5
    goto tunnel_start
)
goto cleanup

:report_bug
echo  Collecting logs...
set "ISSUE_URL=https://github.com/Astear17/WebMusicWidget/issues/new"
powershell -Command "$log = '=== System Log ===`n'; if(Test-Path server.log){ $log += Get-Content server.log -Tail 50 | Out-String }; $log | Set-Clipboard; Start-Process '%ISSUE_URL%'"
echo  [INFO] Logs copied to clipboard. Opening GitHub...
pause
goto tunnel_start

:cleanup
echo.
echo  Stopping services...
taskkill /F /IM MediaReader.exe >nul 2>nul
taskkill /F /IM cloudflared.exe >nul 2>nul
powershell -Command "Get-NetTCPConnection -LocalPort 8080, 8974 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo  Done.
pause
