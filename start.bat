@echo off
if "%~1"=="RUN_MAIN" goto run_main

:: Trap Ctrl+C to ensure cleanup runs if user terminates the batch job
cmd /c "%~f0" RUN_MAIN
goto cleanup

:run_main
setlocal EnableDelayedExpansion
title Now Playing Overlay Server
cd /d "%~dp0"

:menu
cls
echo.
echo  ==================================================
echo  [36m NOW PLAYING WIDGET THEME SELECTOR [0m
echo  ==================================================
echo.
echo  [1] Static
echo  [2] Vortex
echo  [3] YellowPower
echo  [4] NeonLight
echo  [5] CyberNeon
echo  [6] Christmas
echo  [7] NorthenLights
echo  [8] NeoPixel
echo  [9] Fantasy
echo  [10] Wanderer
echo.
set /p "CHOICE= Select Theme (1-10): "

if "%CHOICE%"=="1" set "THEME=Static" & goto :start_server
if "%CHOICE%"=="2" set "THEME=Vortex" & goto :start_server
if "%CHOICE%"=="3" set "THEME=YellowPower" & goto :start_server
if "%CHOICE%"=="4" set "THEME=NeonLight" & goto :start_server
if "%CHOICE%"=="5" set "THEME=CyberNeon" & goto :start_server
if "%CHOICE%"=="6" set "THEME=Christmas" & goto :start_server
if "%CHOICE%"=="7" set "THEME=NorthenLights" & goto :start_server
if "%CHOICE%"=="8" set "THEME=NeoPixel" & goto :start_server
if "%CHOICE%"=="9" set "THEME=Fantasy" & goto :start_server
if "%CHOICE%"=="10" set "THEME=Wanderer" & goto :start_server

echo.
echo  [31m[ERROR] Invalid selection. Please try again.[0m
timeout /t 2 >nul
goto :menu

:start_server
cls
echo.
echo  ==================================================
echo  [32m Starting Now Playing Overlay... [0m
echo  [33m Theme Selected: %THEME% [0m
echo  ==================================================
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
:: Pass THEME env variable to node
set THEME=%THEME%
start /B node server.js > server.log 2>&1

:: Wait for server to bind
timeout /t 3 >nul

echo.
echo  ==================================================
echo   Now Playing Overlay - HTTPS Tunnel
echo  ==================================================
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
:: We escape the redirection and pipe to ensure Batch doesn't misinterpret them
powershell -Command "& { .\cloudflared.exe tunnel --url http://localhost:8080 --protocol http2 2>&1 | ForEach-Object { Write-Host $_; if ($_ -match 'https://[a-zA-Z0-9-]+\.trycloudflare\.com') { $url = $matches[0]; $url | Set-Clipboard; Write-Host \"`n[SUCCESS] URL COPIED TO CLIPBOARD: $url`n\" -ForegroundColor Cyan } }; exit $global:LASTEXITCODE }"

if errorlevel 1 (
    set /a RETRY_COUNT+=1
    echo.
    echo  [WARNING] Tunnel disconnected or failed (Attempt !RETRY_COUNT!/10^).
    
    if !RETRY_COUNT! GEQ 10 (
        echo  [ERROR] Failed to establish tunnel after 10 attempts.
        choice /c rc /n /t 30 /d r /m "Press [R] to Report Bug, or [C] to Cancel (Auto-reporting in 30s): "
        if errorlevel 2 goto cleanup
        goto report_bug
    ) else (
        echo  [INFO] Automatically retrying in 3 seconds...
        timeout /t 3 /nobreak >nul
        goto tunnel_start
    )
)
goto cleanup

:report_bug
echo  Collecting logs...
set "ISSUE_URL=https://github.com/Astear17/WebMusicWidget/issues/new"
powershell -Command "$log = '=== System Log ===`n'; if(Test-Path server.log){ $log += Get-Content server.log -Tail 50 | Out-String }; $log | Set-Clipboard; Start-Process '%ISSUE_URL%'"
echo  [INFO] Logs copied to clipboard. Opening GitHub...
timeout /t 5 >nul
set RETRY_COUNT=0
goto tunnel_start

:cleanup
echo.
echo  Stopping services...
taskkill /F /IM MediaReader.exe >nul 2>nul
taskkill /F /IM cloudflared.exe >nul 2>nul
powershell -Command "Get-NetTCPConnection -LocalPort 8080, 8974 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo  Done.
exit
