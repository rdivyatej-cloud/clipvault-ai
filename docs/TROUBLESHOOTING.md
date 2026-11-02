# CLIPVAULT AI — Troubleshooting & Diagnostics Guide

This document provides solutions for common issues when running CLIPVAULT AI locally on Windows 11.

---

## 1. Port Conflicts

### Symptom: `Port 5000 is already in use` or `Port 8000 is already in use`
- **Cause**: A previous instance of the backend or AI engine is still running in the background.
- **Solution**:
  1. Run `stop.bat` to terminate all background processes.
  2. Alternatively, run in PowerShell:
     ```powershell
     Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force
     Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force
     ```

---

## 2. OpenMP Runtime Conflict (`libiomp5md.dll`)

### Symptom: `OMP: Error #15: Initializing libiomp5md.dll, but found libiomp5md.dll already initialized`
- **Cause**: Multiple libraries (such as Anaconda Intel MKL and CTranslate2) have linked OpenMP runtimes.
- **Solution**:
  CLIPVAULT AI automatically sets `os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"` in `ai-engine/transcription.py` and `ai-engine/main.py`.
  If running manual tests, ensure this variable is exported before importing NumPy or Torch.

---

## 3. FFmpeg Not Recognized

### Symptom: `FileNotFoundError: The system cannot find the file specified: 'ffmpeg'`
- **Cause**: Windows PATH environment variable has not refreshed in an active terminal session.
- **Solution**:
  1. CLIPVAULT AI includes an auto-detector in `backend/src/services/ffmpeg.ts` and `ai-engine/video_renderer.py` that automatically looks inside:
     `%USERPROFILE%\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg*\bin\ffmpeg.exe`
  2. You can also explicitly set the environment variable:
     ```powershell
     $env:FFMPEG_PATH = "C:\Users\Dell\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.2-full_build\bin\ffmpeg.exe"
     ```

---

## 4. Ollama LLM Connection Issues

### Symptom: `Failed to connect to Ollama at http://localhost:11434`
- **Behavior**: CLIPVAULT AI detects this condition and automatically activates its built-in heuristic streamer NLP engine. You will never experience a pipeline crash.
- **To enable Qwen 2.5 3B**:
  1. Ensure Ollama is running:
     ```powershell
     ollama serve
     ```
  2. Verify the model is downloaded:
     ```powershell
     ollama list
     ```
  3. If missing, pull the model:
     ```powershell
     ollama pull qwen2.5:3b
     ```

---

## 5. Performance Optimization on 16 GB Laptop

- **Rule 1**: Only process one video at a time (enforced by the sequential queue).
- **Rule 2**: Stick to the `base` Whisper model for real-time transcription on 4 cores.
- **Rule 3**: Use `blur_pillarbox` framing to avoid losing gameplay HUD or streamer facecams.
- **Rule 4**: Close heavy background applications (e.g. video rendering or gaming) during moment analysis for maximum throughput.

---

## 6. Subtitle Styling & Font Customization

- Subtitles are generated in ASS format with high-contrast styling.
- Default font is `Montserrat` / `Arial`. If Montserrat is not installed on Windows, FFmpeg automatically falls back to Arial without throwing errors.
- Important keywords are emphasized in vivid crimson red (`&H002020EF` in ASS BGR format) with thick dark outlines.

