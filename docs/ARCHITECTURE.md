# CLIPVAULT AI — System Architecture & Design Specification

CLIPVAULT AI is an autonomous, locally operated AI video clipping studio engineered specifically for livestreamer and gaming content. It enables content creators and video editors to import long-form VOD recordings and automatically generate ready-to-publish vertical 9:16 clips for TikTok, YouTube Shorts, and Instagram Reels with zero third-party cloud API costs.

---

## 1. High-Level Architecture Diagram

```
+---------------------------------------------------------------------------------+
|                                CLIPVAULT AI UI                                  |
|               (React 18, Vite, TypeScript, Tailwind CSS, Lucide)                |
+----------------------------------------+----------------------------------------+
                                         | REST API & Media Streaming (Port 5000)
                                         v
+---------------------------------------------------------------------------------+
|                            NODE.JS EXPRESS BACKEND                              |
|  - REST API Routes: /projects, /jobs, /clips, /settings, /media, /system        |
|  - SQLite Database (Projects, Transcripts, Candidate Moments, Clips, Jobs)      |
|  - Sequential Queue Engine (1 video at a time, protecting 16GB CPU RAM)         |
|  - Media Streamer (HTTP 206 Partial Content Range Streaming)                    |
+-------------------+------------------------------------+------------------------+
                    |                                    |
                    | Audio extraction / Probe           | HTTP IPC (Port 8000)
                    v                                    v
+-------------------------------------+   +---------------------------------------+
|          FFmpeg & FFprobe           |   |       FASTAPI PYTHON AI ENGINE        |
| - Probe stream metadata             |   | - faster-whisper (Base, INT8 CPU)     |
| - Extract 16kHz mono WAV            |   | - Librosa & NumPy Excitement Curve    |
| - Filter complex vertical 9:16      |   | - OpenCV 240p Visual Motion & Cuts    |
| - EBU R128 Loudness Normalization   |   | - Ollama Qwen 2.5 3B / NLP Fallback   |
| - Burn stylized ASS Subtitles       |   | - Multi-Modal Moment Ranking Engine   |
+-------------------------------------+   +-------------------+-------------------+
                                                              |
                                                              v
                                              +-------------------------------+
                                              |       LOCAL OLLAMA DAEMON     |
                                              |  Model: qwen2.5:3b (Port 11434)|
                                              +-------------------------------+
```

---

## 2. Component Breakdown

### 2.1 Frontend (`frontend/`)
- **Technology**: React 18, Vite, TypeScript, Tailwind CSS, Lucide React icons.
- **Theme**: Luxury Studio Dark Theme (Deep Black `#0A0B10`, Charcoal `#12151E`, Crimson Red `#EF4444`, Metallic Silver `#E2E8F0`).
- **Core Views**:
  1. `Dashboard`: KPI statistics, quick project import dropzone, active job indicator, recent clips carousel.
  2. `New Project`: Drag-and-drop file uploader, local path importer, legal platform guidelines, duration sliders, subtitle typography selection.
  3. `Video Analysis`: Timeline seeker, full speech transcript with search filter, ranked candidate moments list, multi-modal breakdown metrics, 1-click 9:16 vertical render.
  4. `Processing Queue`: Real-time sequential job monitor, multi-stage progress bars, current step indicator, retry/cancel buttons.
  5. `Generated Clips`: 9:16 vertical video card grid, video player modal, inline title editor, category tags, approval/rejection toggle, download button, "Open in Windows Explorer".
  6. `Video Library`: Source footage manager, duration, resolution, file size, re-analyze action, delete action.
  7. `Settings`: Whisper model selection (`base`, `small`, `tiny`), Ollama endpoint & model configuration, framing mode (`blur_pillarbox` vs `center_crop`), auto-generation counts, live system hardware diagnostics.

### 2.2 Backend (`backend/`)
- **Technology**: Node.js 22+, Express.js, TypeScript, native `node:sqlite`.
- **Database Schema**:
  - `projects`: Video source path, duration, resolution, fps, file size, status.
  - `transcripts`: Full speech transcript and timestamped word/segment arrays.
  - `candidate_moments`: Ranked viral moments with category, start/end timestamps, composite score, hook strength, audio intensity, visual activity, explanation.
  - `clips`: Rendered vertical 9:16 MP4 clips, thumbnail paths, status (approved/rejected), subtitle styles.
  - `jobs`: Sequential task queue with progress percentages and stage messages.
  - `settings`: Key-value configuration for models, durations, and framing.
- **Sequential Queue Worker**:
  - Designed for a 16 GB RAM laptop with an Intel Core i5-11320H CPU.
  - Strictly executes one video at a time, preventing thermal throttling or out-of-memory errors.

### 2.3 AI Processing Engine (`ai-engine/`)
- **Technology**: FastAPI, Uvicorn, Python 3.11–3.14.
- **Audio Extraction**: FFmpeg extracts 16kHz mono 16-bit PCM WAV for Whisper and Librosa.
- **Speech Transcription (`transcription.py`)**:
  - Uses `faster-whisper` with `base` INT8 quantized model on CPU with 4 threads.
  - Generates word-level timestamps and segment text.
  - Resolves OpenMP Intel MKL conflicts automatically.
- **Audio Excitement Detection (`audio_analyzer.py`)**:
  - Computes frame-level RMS energy and spectral centroid (screaming / pitch brightness).
  - Identifies sudden volume bursts, laughter spikes, and intense streamer reactions.
- **Visual Activity Detection (`scene_analyzer.py`)**:
  - Samples video frames downsampled to 240p to minimize CPU load.
  - Computes pixel-difference motion curves and detects hard scene transitions.
- **Semantic Moment Analysis (`llm_analyzer.py`)**:
  - Prompts local Ollama (`qwen2.5:3b`) with timestamped transcript context.
  - Detects funny, rage, hype, emotional, and unexpected moments.
  - Includes a fallback heuristic streamer NLP engine for offline execution.
- **Multi-Modal Moment Ranker (`moment_ranker.py`)**:
  - Fuses Semantic Hook (45%), Audio Excitement (35%), and Visual Motion (20%).
  - Snaps clip start and end timestamps to speech pauses so words are never cut mid-sentence.
  - Deduplicates overlapping windows.
- **Vertical Video Renderer (`video_renderer.py`)**:
  - Compiles Advanced SubStation Alpha (`.ass`) subtitles with high-contrast white text, vivid crimson red keyword emphasis, and dark drop outlines.
  - Scales 16:9 videos into 1080x1920 9:16 using high-end blurred pillarbox or direct center crop.
  - Applies EBU R128 loudness normalization for uniform audio delivery.

---

## 3. Hardware Optimization & Reliability Strategy

- **CPU-First Execution**:
  - No CUDA or discrete NVIDIA GPU dependencies.
  - All neural network inference is optimized for Intel Iris Xe / x86_64 AVX2 instructions with INT8 quantization.
- **Streaming & Temporary File Management**:
  - Video streams are processed via FFmpeg pipes and downsampled frames without holding full videos in RAM.
  - Temporary audio extraction files are automatically deleted after moment analysis completes.
- **Graceful Fault Tolerance**:
  - If Ollama is offline or model generation times out, the system automatically switches to the heuristic streamer NLP engine.
  - If a system reboot interrupts a job, the queue recovers on startup and marks the job as failed with 1-click retry.
