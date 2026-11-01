import os
import sys

# Prevent OpenMP runtime conflict on Windows
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import logging
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import requests

from transcription import transcribe_audio
from audio_analyzer import AudioAnalyzer
from scene_analyzer import SceneAnalyzer
from llm_analyzer import analyze_transcript_with_ollama
from moment_ranker import rank_and_deduplicate_moments
from video_renderer import render_vertical_clip

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s"
)
logger = logging.getLogger("clipvault.ai_engine")

app = FastAPI(title="CLIPVAULT AI Processing Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request / Response Schemas
class TranscribeRequest(BaseModel):
    audio_path: str
    model_size: str = "base"

class AnalyzeMomentsRequest(BaseModel):
    video_path: str
    audio_path: str
    transcript_segments: List[Dict[str, Any]]
    min_clip_duration: float = 25.0
    max_clip_duration: float = 60.0
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:3b"

class RenderClipRequest(BaseModel):
    video_path: str
    start_time: float
    end_time: float
    output_path: str
    thumbnail_path: str
    transcript_segments: List[Dict[str, Any]] = Field(default_factory=list)
    framing_mode: str = "blur_pillarbox"
    subtitle_style: str = "red_highlight"
    audio_norm: bool = True

@app.get("/health")
def health_check():
    """Diagnostics endpoint returning status of AI modules & Ollama"""
    ollama_ok = False
    ollama_models = []
    try:
        r = requests.get("http://localhost:11434/api/tags", timeout=2)
        if r.status_code == 200:
            ollama_ok = True
            ollama_models = [m.get("name") for m in r.json().get("models", [])]
    except Exception:
        ollama_ok = False

    return {
        "status": "online",
        "service": "clipvault-ai-engine",
        "python_version": sys.version,
        "ollama_connected": ollama_ok,
        "available_llm_models": ollama_models,
        "hardware_profile": "Windows 11 CPU-first (Intel Core i5-11320H, 16GB RAM)"
    }

@app.post("/transcribe")
def transcribe_endpoint(req: TranscribeRequest):
    """Transcribes audio using faster-whisper on CPU"""
    try:
        logger.info(f"Received transcription request for {req.audio_path} using model {req.model_size}")
        result = transcribe_audio(req.audio_path, model_size=req.model_size)
        return result
    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze-moments")
def analyze_moments_endpoint(req: AnalyzeMomentsRequest):
    """
    Multi-modal moment detection:
    1. Audio excitement curve (RMS + spectral centroid)
    2. Scene activity & cut detection (OpenCV)
    3. Transcript semantic analysis (Ollama Qwen 2.5 3B with heuristic fallback)
    4. Composite moment ranking & non-overlapping boundary snapping
    """
    try:
        logger.info(f"Starting moment analysis for video: {req.video_path}")
        
        # 1. Audio Analysis
        audio_analyzer = AudioAnalyzer(req.audio_path)
        audio_peaks = audio_analyzer.find_high_energy_peaks(
            min_duration=req.min_clip_duration,
            max_duration=req.max_clip_duration
        )

        # 2. Scene Analysis
        scene_analyzer = SceneAnalyzer(req.video_path)
        scene_data = scene_analyzer.analyze_visual_activity(sample_interval_sec=0.5)

        # 3. LLM Semantic Moment Analysis
        llm_candidates = analyze_transcript_with_ollama(
            transcript_segments=req.transcript_segments,
            ollama_url=req.ollama_url,
            model=req.ollama_model,
            min_clip_sec=req.min_clip_duration,
            max_clip_sec=req.max_clip_duration
        )

        # 4. Multi-Modal Composite Ranking & Non-overlapping Deduplication
        ranked_moments = rank_and_deduplicate_moments(
            llm_candidates=llm_candidates,
            audio_peaks=audio_peaks,
            audio_analyzer=audio_analyzer,
            scene_analyzer=scene_analyzer,
            visual_samples=scene_data.get("activity_samples", []),
            transcript_segments=req.transcript_segments,
            min_clip_sec=req.min_clip_duration,
            max_clip_sec=req.max_clip_duration
        )

        return {
            "moments": ranked_moments,
            "stats": {
                "audio_peaks_detected": len(audio_peaks),
                "scene_cuts_detected": len(scene_data.get("scene_cuts", [])),
                "llm_candidates_generated": len(llm_candidates),
                "final_ranked_count": len(ranked_moments)
            }
        }
    except Exception as e:
        logger.error(f"Moment analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/render-clip")
def render_clip_endpoint(req: RenderClipRequest):
    """Renders 9:16 vertical video with animated subtitles via FFmpeg"""
    try:
        logger.info(f"Rendering clip: {req.start_time}s -> {req.end_time}s into {req.output_path}")
        result = render_vertical_clip(
            video_path=req.video_path,
            start_sec=req.start_time,
            end_sec=req.end_time,
            output_path=req.output_path,
            thumbnail_path=req.thumbnail_path,
            segments=req.transcript_segments,
            framing_mode=req.framing_mode,
            subtitle_style=req.subtitle_style,
            audio_norm=req.audio_norm
        )
        return result
    except Exception as e:
        logger.error(f"Render error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("AI_ENGINE_PORT", 8000))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=False)
