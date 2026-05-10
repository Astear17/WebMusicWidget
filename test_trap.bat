@echo off
if "%~1"=="START_MAIN" goto start_main

echo Running in wrapper. Press Ctrl+C to test.
cmd /c "%~f0" START_MAIN
echo Cleanup runs!
goto :eof

:start_main
echo In main. Waiting...
ping localhost -n 10 >nul
echo Done waiting.
