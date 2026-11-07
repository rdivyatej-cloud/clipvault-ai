# CLIPVAULT AI 🎬

> **Autonomous Local AI Streamer & Gaming Clipping Studio**  
> *Transform multi-hour livestream VODs into viral vertical 9:16 clips with synchronized subtitles — running 100% locally on your computer with zero cloud API fees.*

[![Repository](https://img.shields.io/badge/GitHub-rdivyatej--cloud%2Fclipvault--ai-red?style=flat&logo=github)](https://github.com/rdivyatej-cloud/clipvault-ai.git)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2011%20%7C%20CPU--First-emerald)]()
[![AI Models](https://img.shields.io/badge/AI-faster--whisper%20%7C%20Qwen%202.5%203B-purple)]()

---

## 🌟 Executive Overview

**CLIPVAULT AI** is an all-in-one personal video clipping studio created by **Divyatej**. It empowers video editors, streamer management teams, and content creators to automatically discover, score, rank, crop, subtitle, and export viral moments from gaming livestreams and podcast recordings.

### 🚫 Zero Cloud Dependencies
- **No subscriptions**: Never pay for third-party clipping platforms.
- **No cloud APIs**: Completely immune to API rate limits, tokens, and surprise monthly bills.
- **100% Private**: Your raw footage never leaves your local machine.

---

## ⚡ Hardware Constraints & Optimization Profile

Engineered specifically for everyday modern creator hardware:
- **Processor**: Intel Core i5-11320H (11th Gen, 4 Cores / 8 Threads)
- **RAM**: 16 GB DDR4
- **Graphics**: Intel Iris Xe Integrated Graphics (No discrete NVIDIA GPU or CUDA required)
- **OS**: Windows 11
- **Disk**: 477 GB SSD

### Performance Engineering:
1. **CPU-First Execution**: Quantized INT8 neural models (`faster-whisper-base` + `qwen2.5:1.5b`).
2. **Sequential Queue**: Strictly processes one video at a time to prevent thermal throttling and memory exhaustion.
3. **Downsampled Computer Vision**: Frame differences sampled at 240p for instant scene activity tracking.
4. **Streaming Pipes**: Temporary 16kHz audio extraction with automatic cleanup upon completion.

---

## 🧠 Multi-Modal AI Moment Detection Engine

CLIPVAULT AI does not rely on simple audio thresholds or keyword matching. It combines **four distinct layers of intelligence**:

```
                       ┌───────────────────────────────┐
                       │   Raw Stream Video Footage    │
                       └──────────────┬────────────────┘
                                      │
               ┌──────────────────────┼──────────────────────┐
               ▼                      ▼                      ▼
      ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
      │ Speech Whisper  │    │ Audio Energy    │    │ Visual Activity │
      │ Transcription   │    │ Librosa + NumPy │    │ OpenCV Frame Diff│
      └────────┬────────┘    └────────┬────────┘    └────────┬────────┘
               │                      │                      │
               ▼                      │                      │
      ┌─────────────────┐             │                      │
      │ Ollama Qwen LLM │             │                      │
      │ Semantic Hook   │             │                      │
      └────────┬────────┘             │                      │
               │                      │                      │
               └──────────────────────┼──────────────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │ Multi-Modal Composite Ranker  │
                      │  - Audio Excitement (35%)     │
                      │  - Visual Activity  (20%)     │
                      │  - Semantic Hook    (45%)     │
                      └──────────────┬────────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │  Speech Boundary Snapping     │
                      │  + Overlap Deduplication      │
                      └──────────────┬────────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │   Vertical 9:16 Video Render  │
                      │    with Animated Subtitles    │
                      └───────────────────────────────┘
```

1. **Audio Excitement Detection (35% weight)**: RMS energy bursts and spectral centroid curves isolate screaming, rage outbursts, table slams, and laughter peaks.
2. **Visual Activity & Scene Cuts (20% weight)**: OpenCV frame difference curves identify high-motion gameplay, jump scares, and camera transitions.
3. **Semantic Context & Hook Analysis (45% weight)**: Local Qwen 2.5 1.5B (with an intelligent heuristic streamer NLP fallback) scores punchlines, conversational hooks, and emotional twists.
4. **Natural Boundary Snapping**: Clips automatically snap to sentence pauses so speech is never cut off mid-word.

---

## 🎨 Studio UI & Pages

Built with a high-end **Luxury Dark Media Studio Aesthetic**:
- **Dashboard**: KPI statistics, quick project import dropzone, active job indicator, recent clips carousel.
- **New Project**: Drag-and-drop file uploader, local path importer, platform copyright guide, clip duration range sliders, subtitle styling preview.
- **Video Analysis**: Interactive video player with timeline seeker, full speech transcript with search filter, ranked candidate moments with category badges (Funny, Rage, Hype, Emotional, etc.), and 1-click 9:16 vertical render.
- **Processing Queue**: Live sequential job queue, multi-stage progress bars (Audio -> Whisper -> Qwen -> FFmpeg), elapsed times, retry and cancel controls.
- **Generated Clips**: Filterable 9:16 vertical video gallery, modal video player, title editor, category tags, approval/rejection toggle, download button, and "Open in Explorer".
- **Video Library**: Source footage manager, duration, resolution, file size, re-analyze action, delete action.
- **Settings**: Speech model size, Ollama endpoint & model name, framing mode (`blur_pillarbox` vs `center_crop`), auto-generation counts, live system hardware diagnostics.

---

## 🚀 Quick Start (Windows 11)

### 1. Prerequisites
- **Node.js 20+**
- **Python 3.11+**
- **FFmpeg** (installed automatically via `winget install Gyan.FFmpeg`)
- **Ollama** ([Download](https://ollama.com/download/windows))

### 2. First-Time Setup
```bash
# Clone the repository
git clone https://github.com/rdivyatej-cloud/clipvault-ai.git
cd clipvault-ai

# Configure environment variables (optional: add your YouTube Data API v3 key)
cp .env.example .env

# Pull the lightweight Qwen 2.5 1.5B model
ollama pull qwen2.5:1.5b

# Install Python requirements
pip install -r requirements.txt

# Install backend dependencies & build
cd backend
npm install
npm run build
cd ..

# Install frontend dependencies & build
cd frontend
npm install
npm run build
cd ..
```

---

## 📺 YouTube URL Assisted Video Import

CLIPVAULT AI includes an assisted YouTube import workflow designed for content creators, stream editors, and game clips:

1. **Verify YouTube URL**: Paste any YouTube video URL, shortlink (`youtu.be`), Shorts link, or Livestream VOD link.
2. **Metadata Preview**: The backend retrieves title, channel name, duration, and thumbnail preview.
   - *With `YOUTUBE_API_KEY` configured*: Uses the official Google YouTube Data API v3 for high-res thumbnails and livestream data.
   - *Without API key*: Automatically falls back to YouTube's public oEmbed service with zero credentials required.
3. **Authorized Local Video Association**:
   - In accordance with copyright and platform terms, CLIPVAULT AI operates on your authorized local file:
     - **YouTube Studio Export**: Download your 1080p source video directly from `YouTube Studio > Content > Options > Download`.
     - **Google Takeout**: Export your channel archives via `takeout.google.com`.
     - **OBS / Twitch VOD**: Select your original local streamer recording.
4. **Duplicate Prevention**: Detects if a project for the video already exists to prevent duplicate processing.
5. **Full Local AI Pipeline**: Once associated, the video enters the sequential CPU queue for Whisper speech transcription, Librosa audio energy analysis, OpenCV visual tracking, Qwen 2.5 1.5B viral moment ranking, and 9:16 vertical video rendering with synchronized Crimson Red subtitles.

### 3. Start the Application
Simply double-click `start.bat`!
The script will start Ollama, the Python AI Engine, the Node.js backend, and launch your default browser to `http://localhost:5000`.

To stop all services cleanly, double-click `stop.bat`.

---

## 📁 Project Architecture

```
clipvault-ai/
├── frontend/               # React 18, Vite, TypeScript, Tailwind CSS
│   ├── src/
│   │   ├── components/     # Sidebar, Header, ClipPlayerModal
│   │   ├── pages/          # 7 Core Studio Pages
│   │   ├── services/       # API client & streaming helpers
│   │   └── types/          # TypeScript interface definitions
│   └── dist/               # Production bundle
├── backend/                # Node.js 22+, Express, TypeScript, node:sqlite
│   ├── src/
│   │   ├── db/             # SQLite schema and initialization
│   │   ├── routes/         # Projects, Jobs, Clips, Settings, Media, System
│   │   ├── services/       # Sequential Queue, FFmpeg wrapper, AI Client
│   │   └── types/          # Database & runtime types
│   └── dist/               # Compiled backend JavaScript
├── ai-engine/              # FastAPI Python AI Service (Port 8000)
│   ├── main.py             # FastAPI REST endpoints
│   ├── transcription.py    # faster-whisper INT8 CPU worker
│   ├── audio_analyzer.py   # Librosa RMS energy & centroid analyzer
│   ├── scene_analyzer.py   # OpenCV 240p visual motion & cut detector
│   ├── llm_analyzer.py     # Ollama Qwen 2.5 3B & heuristic streamer NLP
│   ├── moment_ranker.py    # Multi-modal composite scoring & boundary snapping
│   └── video_renderer.py   # FFmpeg 9:16 vertical render & ASS subtitles
├── database/               # Local SQLite database (clipvault.db)
├── storage/                # Imported raw video files
├── output/                 # Generated 9:16 vertical clips & thumbnails
├── temp/                   # Intermediate audio WAVs and ASS subtitles
├── scripts/                # Automated test video generator & pipeline verifier
├── docs/                   # ARCHITECTURE.md, INSTALLATION.md, TROUBLESHOOTING.md
├── start.bat               # Windows one-click startup automation
├── stop.bat                # Windows clean shutdown script
├── requirements.txt        # Python dependencies
└── README.md
```

---

## 🧪 Testing & Verification

Run the automated backend unit & integration tests:
```bash
cd backend
npm test
```

Run the complete end-to-end AI pipeline test (including audio extraction, transcription, moment ranking, and 9:16 video rendering):
```bash
python scripts/test_pipeline.py
```

---

## ⚖️ Content Permissions & DRM Compliance

CLIPVAULT AI is designed exclusively for processing user-owned, authorized stream footage, and legally recorded gameplay content. It does not bypass DRM, access controls, or platform download restrictions. When using stream URLs, the application inspects metadata and guides creators to use their authorized local recordings.

---

## 👤 Owner & Repository

- **Owner**: Divyatej
- **Official Repository**: [https://github.com/rdivyatej-cloud/clipvault-ai.git](https://github.com/rdivyatej-cloud/clipvault-ai.git)
- **Branch**: `main`

