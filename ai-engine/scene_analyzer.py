import os
import logging
from typing import Dict, Any, List
import cv2
import numpy as np

logger = logging.getLogger("clipvault.scene_analyzer")

class SceneAnalyzer:
    def __init__(self, video_path: str):
        self.video_path = video_path
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video file not found: {video_path}")

    def analyze_visual_activity(self, sample_interval_sec: float = 0.5) -> Dict[str, Any]:
        """
        Samples video frames at regular intervals to compute:
        - Motion / Activity curve (frame-to-frame pixel differences)
        - Scene cut candidates
        Optimized for CPU processing without loading entire video into memory.
        """
        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened():
            logger.warning(f"Could not open video {self.video_path} for scene analysis.")
            return {"scene_cuts": [], "mean_activity": 50.0, "activity_timestamps": []}

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps if fps > 0 else 0

        frame_step = max(1, int(fps * sample_interval_sec))
        prev_gray = None

        activity_records = []
        scene_cuts = []

        frame_idx = 0
        while True:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                break

            # Downsample frame to 240p for ultra-fast CPU processing
            small = cv2.resize(frame, (320, 180), interpolation=cv2.INTER_AREA)
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

            curr_time = frame_idx / fps

            if prev_gray is not None:
                diff = cv2.absdiff(curr_time_gray := gray, prev_gray)
                diff_score = float(np.mean(diff))

                activity_records.append({
                    "timestamp": round(curr_time, 2),
                    "activity": round(diff_score, 2)
                })

                # Threshold for hard scene cut
                if diff_score > 35.0:
                    scene_cuts.append(round(curr_time, 2))

            prev_gray = gray
            frame_idx += frame_step
            if frame_idx >= total_frames:
                break

        cap.release()

        mean_act = float(np.mean([r["activity"] for r in activity_records])) if activity_records else 50.0

        return {
            "scene_cuts": scene_cuts,
            "mean_activity": round(mean_act, 2),
            "activity_samples": activity_records
        }

    def get_visual_score(self, start_sec: float, end_sec: float, activity_samples: List[Dict[str, Any]]) -> float:
        """
        Calculates normalized visual activity score (0-100) for a given window.
        """
        in_range = [s["activity"] for s in activity_samples if start_sec <= s["timestamp"] <= end_sec]
        if not in_range:
            return 50.0

        avg = float(np.mean(in_range))
        peak = float(np.max(in_range))

        # Normalized to 0 - 100
        score = min(100.0, (avg * 1.8) + (peak * 0.8))
        return round(score, 1)

