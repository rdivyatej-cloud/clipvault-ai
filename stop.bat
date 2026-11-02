@echo off
title Shutting down CLIPVAULT AI...
echo ==============================================================
echo     STOPPING CLIPVAULT AI SERVICES...
echo ==============================================================
echo.

:: Kill processes on port 5000 (Backend)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do (
    echo [*] Terminating backend process PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

:: Kill processes on port 8000 (AI Engine)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo [*] Terminating AI engine process PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo [SUCCESS] CLIPVAULT AI has been shut down cleanly.
timeout /t 2 /nobreak >nul

