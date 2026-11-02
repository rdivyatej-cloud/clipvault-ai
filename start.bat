@echo off
setlocal enabledelayedexpansion

title CLIPVAULT AI - Streamer Clipping Studio
color 0C

echo ==============================================================
echo     CLIPVAULT AI - AUTONOMOUS STREAMER CLIPPING STUDIO
echo ==============================================================
echo.

:: 1. Check for running instance on port 5000
netstat -ano | findstr ":5000" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [!] An existing CLIPVAULT AI instance is already running on port 5000.
    echo Opening dashboard in your default browser...
    start http://localhost:5000
    exit /b 0
)

:: 2. Find Python Executable
set "PYTHON_EXE="
if exist "%USERPROFILE%\anaconda3\python.exe" (
    set "PYTHON_EXE=%USERPROFILE%\anaconda3\python.exe"
) else if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set "PYTHON_EXE=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
) else (
    where python.exe >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        set "PYTHON_EXE=python.exe"
    )
)

if "%PYTHON_EXE%"=="" (
    echo [ERROR] Python not found. Please install Python or Anaconda.
    pause
    exit /b 1
)

:: 3. Find Node.js
where node.exe >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found on your system. Please install Node.js 20+.
    pause
    exit /b 1
)

:: 4. Start Ollama if not already running
curl -s http://127.0.0.1:11434/api/tags >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [*] Starting local Ollama service...
    set "OLLAMA_EXE="
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
        set "OLLAMA_EXE=%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
    ) else (
        where ollama.exe >nul 2>&1
        if %ERRORLEVEL% EQU 0 set "OLLAMA_EXE=ollama.exe"
    )
    if not "%OLLAMA_EXE%"=="" (
        start "Ollama Service" /min "%OLLAMA_EXE%" serve
        timeout /t 3 /nobreak >nul
    )
)

:: 5. Start Python AI Processing Engine (Port 8000)
echo [*] Starting Python AI Processing Engine on port 8000...
start "CLIPVAULT AI - Engine" /min cmd /c "cd /d %~dp0ai-engine && "%PYTHON_EXE%" main.py"
timeout /t 3 /nobreak >nul

:: 6. Start Node.js Backend & UI Server (Port 5000)
echo [*] Starting Backend & Studio Server on port 5000...
start "CLIPVAULT AI - Backend" /min cmd /c "cd /d %~dp0backend && node dist\index.js"
timeout /t 3 /nobreak >nul

:: 7. Launch browser
echo.
echo ==============================================================
echo [SUCCESS] CLIPVAULT AI is running at: http://localhost:5000
echo ==============================================================
echo Opening dashboard in your default browser...
start http://localhost:5000

echo.
echo Leave this window or close it. To stop CLIPVAULT AI cleanly,
echo simply run stop.bat.
pause

