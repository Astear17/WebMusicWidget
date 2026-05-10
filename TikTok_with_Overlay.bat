@echo off
title TikTok LIVE Studio + Overlay
cd /d "%~dp0"

echo  Starting Now Playing Overlay...
start /min cmd /c "start.bat"

echo  Starting TikTok LIVE Studio...
start "" "C:\Program Files\TikTok LIVE Studio\TikTok LIVE Studio Launcher.exe"

echo.
echo  Launch sequence complete! 
echo  The overlay is running in the background.
echo.
timeout /t 5
exit
