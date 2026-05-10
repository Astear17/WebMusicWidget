@echo off
:: Hook script for TikTok LIVE Studio
:: When TikTok is launched, this script runs first, starts the overlay, then starts TikTok.

:: 1. Start the overlay minimized
start /min "" "D:\Windows Tool\now-playing\start.bat"

:: 2. Start the actual TikTok LIVE Studio
:: We use the full path to avoid recursive loops
start "" "C:\Program Files\TikTok LIVE Studio\TikTok LIVE Studio Launcher.exe" %*

exit
