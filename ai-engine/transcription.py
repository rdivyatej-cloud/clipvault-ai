import os
import sys

# Prevent OpenMP runtime conflict on Windows between Intel MKL and ctranslate2
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import logging
from typing import Dict, Any, List
import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel

logger = logging.getLogger("clipvault.transcription")

# Cache model instance to avoid reloading between calls
_MODEL_CACHE: Dict[str, WhisperModel] = {}

def get_whisper_model(model_size: str = "base", device: str = "cpu", compute_type: str = "int8") -> WhisperModel:
    key = f"{model_size}_{device}_{compute_type}"
    if key not in _MODEL_CACHE:
        logger.info(f"Loading faster-whisper model '{model_size}' on {device} ({compute_type})...")
        _MODEL_CACHE[key] = WhisperModel(model_size, device=device, compute_type=compute_type, cpu_threads=4)
        logger.info(f"Whisper model '{model_size}' loaded successfully.")
    return _MODEL_CACHE[key]

def transcribe_audio(audio_path: str, model_size: str = "base") -> Dict[str, Any]:
    """
    Transcribes audio using local faster-whisper.
    Uses soundfile to pass normalized 16kHz float32 audio array directly,
    ensuring maximum speed and compatibility on Windows without PyAV issues.
    """
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    # Read audio with soundfile
    audio_data, sr = sf.read(audio_path, dtype="float32")
    if len(audio_data.shape) > 1:
        audio_data = audio_data.mean(axis=1)

    model = get_whisper_model(model_size=model_size, device="cpu", compute_type="int8")

    segments, info = model.transcribe(
        audio_data,
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500)
    )

    result_segments: List[Dict[str, Any]] = []
    full_text_parts: List[str] = []

    for seg in segments:
        words = []
        if seg.words:
            for w in seg.words:
                words.append({
                    "word": w.word.strip(),
                    "start": round(w.start, 2),
                    "end": round(w.end, 2),
                    "probability": round(w.probability, 3)
                })

        text = seg.text.strip()
        full_text_parts.append(text)
        result_segments.append({
            "id": seg.id,
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": text,
            "words": words
        })

    return {
        "language": info.language,
        "language_probability": round(info.language_probability, 3),
        "duration": round(info.duration, 2),
        "full_text": " ".join(full_text_parts),
        "segments": result_segments
    }
