# CLIPVAULT AI — Installation & Setup Guide

This guide walks you through setting up CLIPVAULT AI on Windows 11 with an Intel Core i5 processor and 16 GB of RAM.

---

## Prerequisites

1. **Operating System**: Windows 11 (or Windows 10 64-bit)
2. **Node.js**: Version 20 or 22+ (Includes native `node:sqlite`)
3. **Python**: Python 3.11, 3.12, 3.13, or 3.14 (Anaconda or standard Python)
4. **FFmpeg**: Automatically resolved from Winget or system PATH
5. **Ollama**: For local lightweight LLM moment analysis (`qwen2.5:3b`)

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/rdivyatej-cloud/clipvault-ai.git
cd clipvault-ai
```

---

## Step 2: Install FFmpeg (One-time)

If you do not have FFmpeg installed, run in Windows PowerShell:

```powershell
winget install Gyan.FFmpeg --accept-package-agreements --accept-source-agreements
```

CLIPVAULT AI automatically searches both system PATH and Winget directories for `ffmpeg.exe` and `ffprobe.exe`.

---

## Step 3: Install Ollama & Pull Qwen 2.5 3B

1. Download and install Ollama from [https://ollama.com/download/windows](https://ollama.com/download/windows)
2. Open PowerShell or Command Prompt and download the lightweight 3B model:
   ```bash
   ollama pull qwen2.5:3b
   ```
*(Note: CLIPVAULT AI includes an intelligent heuristic fallback that continues working even if Ollama is not running).*

---

## Step 4: Install Python AI Dependencies

In PowerShell or Command Prompt:

```bash
pip install -r requirements.txt
```

Packages installed:
- `faster-whisper`: CPU INT8 quantized speech recognition
- `librosa`, `soundfile`, `numpy`, `scipy`: Audio excitement and energy envelope extraction
- `opencv-python`, `scenedetect`: Visual activity downsampling and cut detection
- `fastapi`, `uvicorn`, `requests`: High-performance local AI IPC service

---

## Step 5: Install Node.js Backend & Frontend Dependencies

```bash
# Backend dependencies
cd backend
npm install
npm run build
cd ..

# Frontend dependencies & production build
cd frontend
npm install
npm run build
cd ..
```

---

## Step 6: Start CLIPVAULT AI

Simply double-click `start.bat` in the project root:

```bash
start.bat
```

What `start.bat` does automatically:
1. Verifies system dependencies (Python, Node.js, FFmpeg).
2. Starts Ollama if not running.
3. Launches the Python AI Processing Engine on port `8000`.
4. Launches the Node.js Studio Server & Backend on port `5000`.
5. Opens your default web browser to `http://localhost:5000`.
6. Prevents duplicate instances if already running.

To shut down all services cleanly, double-click `stop.bat`.
