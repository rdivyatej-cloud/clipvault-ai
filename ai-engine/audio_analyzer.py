import os
import logging
from typing import Dict, Any, List, Tuple
import numpy as np
import librosa

logger = logging.getLogger("clipvault.audio_analyzer")

class AudioAnalyzer:
    def __init__(self, audio_path: str):
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        logger.info(f"Loading audio for analysis: {audio_path}")
        # Load audio at 16kHz
        self.y, self.sr = librosa.load(audio_path, sr=16000, mono=True)
        self.duration = float(len(self.y)) / float(self.sr)

        # Calculate frame-based RMS energy
        self.hop_length = 512
        self.frame_duration = float(self.hop_length) / float(self.sr) # ~0.032s per frame
        self.rms = librosa.feature.rms(y=self.y, hop_length=self.hop_length)[0]
        
        # Calculate Spectral Centroid (pitch brightness / yelling)
        self.centroid = librosa.feature.spectral_centroid(y=self.y, sr=self.sr, hop_length=self.hop_length)[0]

        # Normalization
        max_rms = np.max(self.rms) if np.max(self.rms) > 0 else 1.0
        self.norm_rms = self.rms / max_rms

        max_cent = np.max(self.centroid) if np.max(self.centroid) > 0 else 1.0
        self.norm_cent = self.centroid / max_cent

        # Combined excitement curve
        self.excitement_curve = 0.65 * self.norm_rms + 0.35 * self.norm_cent
        self.mean_excitement = float(np.mean(self.excitement_curve))
        self.std_excitement = float(np.std(self.excitement_curve))

    def get_window_score(self, start_sec: float, end_sec: float) -> Dict[str, float]:
        """
        Calculates audio energy and excitement metrics for a given time window.
        Returns score (0-100), peak_intensity, and mean_intensity.
        """
        start_frame = max(0, int(start_sec / self.frame_duration))
        end_frame = min(len(self.excitement_curve), int(end_sec / self.frame_duration))

        if start_frame >= end_frame:
            return {"score": 50.0, "peak": 0.5, "mean": 0.5}

        window_curve = self.excitement_curve[start_frame:end_frame]
        window_rms = self.norm_rms[start_frame:end_frame]

        peak = float(np.max(window_curve))
        mean = float(np.mean(window_curve))
        rms_peak = float(np.max(window_rms))

        # Dynamic range / burstiness (distinguishes sudden laughter/screams from steady noise)
        burstiness = float(np.std(window_curve))

        # Score calculation: 0 - 100
        # Combines peak height, average excitement, and burstiness
        raw_score = (peak * 45.0) + (mean * 35.0) + (min(burstiness * 4.0, 1.0) * 20.0)
        score = min(100.0, max(10.0, raw_score * 100.0 if raw_score <= 1.0 else raw_score))

        return {
            "score": round(score, 1),
            "peak": round(peak, 3),
            "mean": round(mean, 3),
            "rms_peak": round(rms_peak, 3)
        }

    def find_high_energy_peaks(self, min_duration: float = 20.0, max_duration: float = 60.0) -> List[Dict[str, Any]]:
        """
        Detects top audio excitement bursts across the entire recording.
        """
        threshold = self.mean_excitement + 1.2 * self.std_excitement
        frames_above = np.where(self.excitement_curve > threshold)[0]

        if len(frames_above) == 0:
            return []

        # Group contiguous frames
        clusters: List[List[int]] = []
        current_cluster: List[int] = [frames_above[0]]

        for f in frames_above[1:]:
            # If within 2 seconds (approx 62 frames), merge into same cluster
            if f - current_cluster[-1] < 62:
                current_cluster.append(f)
            else:
                clusters.append(current_cluster)
                current_cluster = [f]
        if current_cluster:
            clusters.append(current_cluster)

        candidates = []
        for cluster in clusters:
            peak_frame = cluster[int(np.argmax(self.excitement_curve[cluster]))]
            peak_time = peak_frame * self.frame_duration

            # Center window around peak
            half_win = min_duration / 2.0
            start = max(0.0, peak_time - half_win)
            end = min(self.duration, start + min_duration)

            metrics = self.get_window_score(start, end)
            candidates.append({
                "start": round(start, 2),
                "end": round(end, 2),
                "peak_time": round(peak_time, 2),
                "score": metrics["score"]
            })

        # Sort descending by score
        candidates.sort(key=lambda x: x["score"], reverse=True)
        return candidates

