import logging
from typing import Dict, Any, List

logger = logging.getLogger("clipvault.moment_ranker")

def snap_to_transcript_boundaries(
    start_time: float,
    end_time: float,
    segments: List[Dict[str, Any]],
    padding_before: float = 0.5,
    padding_after: float = 0.8
) -> tuple[float, float]:
    """
    Snaps candidate timestamps to natural silence and word boundaries in transcript
    so speech isn't cut abruptly mid-word or mid-sentence.
    """
    if not segments:
        return (start_time, end_time)

    # Find closest start boundary
    best_start = start_time
    min_dist_start = float("inf")
    for seg in segments:
        dist = abs(seg["start"] - start_time)
        if dist < min_dist_start and dist <= 3.0:
            min_dist_start = dist
            best_start = max(0.0, seg["start"] - padding_before)

    # Find closest end boundary
    best_end = end_time
    min_dist_end = float("inf")
    for seg in segments:
        dist = abs(seg["end"] - end_time)
        if dist < min_dist_end and dist <= 3.0:
            min_dist_end = dist
            best_end = seg["end"] + padding_after

    return (round(best_start, 2), round(best_end, 2))

def rank_and_deduplicate_moments(
    llm_candidates: List[Dict[str, Any]],
    audio_peaks: List[Dict[str, Any]],
    audio_analyzer,
    scene_analyzer,
    visual_samples: List[Dict[str, Any]],
    transcript_segments: List[Dict[str, Any]],
    min_clip_sec: float = 20.0,
    max_clip_sec: float = 60.0
) -> List[Dict[str, Any]]:
    """
    Combines LLM semantic candidates with audio excitement and visual activity.
    Computes unified composite score, snaps to boundaries, and eliminates overlaps.
    """
    combined_pool: List[Dict[str, Any]] = []

    # Add LLM / NLP candidates
    for c in llm_candidates:
        combined_pool.append({
            "title": c.get("title", "Entertaining Moment"),
            "category": c.get("category", "hype"),
            "start_time": float(c["start_time"]),
            "end_time": float(c["end_time"]),
            "semantic_score": float(c.get("score", 70.0)),
            "hook_strength": float(c.get("hook_strength", 65.0)),
            "explanation": c.get("explanation", "Detected engaging moment.")
        })

    # Add pure audio peaks if not already covered
    for peak in audio_peaks[:5]:
        p_start = float(peak["start"])
        p_end = float(peak["end"])
        
        # Check if already in pool
        already_covered = any(
            abs(c["start_time"] - p_start) < 10.0 for c in combined_pool
        )
        if not already_covered:
            combined_pool.append({
                "title": f"Extreme Reaction Peak @ {int(p_start)}s",
                "category": "rage" if peak["score"] > 80 else "hype",
                "start_time": p_start,
                "end_time": p_end,
                "semantic_score": 65.0,
                "hook_strength": 75.0,
                "explanation": f"Massive audio volume and frequency surge (Score: {peak['score']})."
            })

    ranked_results: List[Dict[str, Any]] = []

    for item in combined_pool:
        # Snap boundaries
        start, end = snap_to_transcript_boundaries(
            item["start_time"], item["end_time"], transcript_segments
        )
        duration = end - start
        if duration < min_clip_sec:
            end = start + min_clip_sec
            duration = min_clip_sec
        elif duration > max_clip_sec:
            end = start + max_clip_sec
            duration = max_clip_sec

        # Calculate exact audio & visual metrics in snapped window
        audio_metrics = audio_analyzer.get_window_score(start, end)
        audio_score = audio_metrics["score"]

        visual_score = scene_analyzer.get_visual_score(start, end, visual_samples)

        semantic_score = item["semantic_score"]
        hook_score = item["hook_strength"]

        # Composite Ranking Formula
        # Semantic & Hook: 45%, Audio Energy: 35%, Visual Activity: 20%
        composite = (
            (semantic_score * 0.30) +
            (hook_score * 0.15) +
            (audio_score * 0.35) +
            (visual_score * 0.20)
        )
        composite = min(100.0, max(10.0, round(composite, 1)))

        # Find matching transcript text
        matching_text = [
            s["text"] for s in transcript_segments 
            if s["end"] >= start and s["start"] <= end
        ]

        ranked_results.append({
            "title": item["title"],
            "category": item["category"],
            "start_time": start,
            "end_time": end,
            "duration": round(duration, 2),
            "score": composite,
            "hook_strength": round(hook_score, 1),
            "audio_intensity": round(audio_score, 1),
            "visual_activity": round(visual_score, 1),
            "semantic_score": round(semantic_score, 1),
            "explanation": item["explanation"],
            "transcript_excerpt": " ".join(matching_text)
        })

    # Sort descending by composite score
    ranked_results.sort(key=lambda x: x["score"], reverse=True)

    # Non-overlapping deduplication
    final_selection: List[Dict[str, Any]] = []
    for candidate in ranked_results:
        c_start = candidate["start_time"]
        c_end = candidate["end_time"]

        # Check overlap with any accepted candidate
        has_overlap = False
        for accepted in final_selection:
            a_start = accepted["start_time"]
            a_end = accepted["end_time"]
            # Calculate intersection
            inter = max(0.0, min(c_end, a_end) - max(c_start, a_start))
            if inter > 12.0: # more than 12s overlap
                has_overlap = True
                break

        if not has_overlap:
            final_selection.append(candidate)

    logger.info(f"Final moment ranking produced {len(final_selection)} non-overlapping moments.")
    return final_selection

