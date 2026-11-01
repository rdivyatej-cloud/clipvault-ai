import os
import json
import logging
import re
from typing import Dict, Any, List
import requests

logger = logging.getLogger("clipvault.llm_analyzer")

# Streamer slang, reaction patterns, and category keywords for NLP scoring
HYPE_KEYWORDS = {
    "clutch", "insane", "lets go", "let's go", "no way", "oh my god", "omg", 
    "unbelievable", "holy", "crazy", "what just happened", "did you see that",
    "gg", "pog", "ace", "headshot", "god tier", "cracked", "goated", "sheesh"
}

RAGE_KEYWORDS = {
    "broken game", "are you kidding me", "trash", "uninstalled", "fix this",
    "how did he", "lag", "cheater", "hacker", "i hate this", "worst game",
    "so bad", "stupid", "stop", "dead", "why", "hitbox", "cap"
}

FUNNY_KEYWORDS = {
    "haha", "hahaha", "lol", "lmao", "died", "dead", "crying", "bruh", "bro",
    "clown", "fail", "awkward", "oops", "embarrassing", "chat look", "naur",
    "kekw", "skull", "goofy", "whomp", "wait what"
}

CONVERSATION_KEYWORDS = {
    "listen", "story", "the truth is", "remember when", "secret", "honestly",
    "in my opinion", "advice", "you know what", "the craziest thing", "actually"
}

def analyze_transcript_with_ollama(
    transcript_segments: List[Dict[str, Any]],
    ollama_url: str = "http://localhost:11434",
    model: str = "qwen2.5:3b",
    min_clip_sec: float = 25.0,
    max_clip_sec: float = 60.0
) -> List[Dict[str, Any]]:
    """
    Sends transcript to local Ollama (Qwen 2.5 3B) for moment identification.
    Falls back cleanly to heuristic NLP analyzer if Ollama is unreachable.
    """
    if not transcript_segments:
        return []

    # Prepare readable text block with timestamps
    formatted_lines = []
    for seg in transcript_segments:
        formatted_lines.append(f"[{seg['start']:.1f}s - {seg['end']:.1f}s]: {seg['text']}")
    transcript_text = "\n".join(formatted_lines)

    prompt = f"""You are an elite short-form video editor for viral Twitch and YouTube streamer clips (TikTok, Shorts, Reels).
Analyze the following timestamped video transcript and identify the most viral, entertaining, and engaging moments.

Target clip length: {min_clip_sec}s to {max_clip_sec}s each.
Candidate categories:
- funny (hilarious jokes, laughs, fails, goofy moments)
- rage (streamer screaming, desk slam, rage quit, bug frustration)
- hype (insane gaming clutch, winning moment, high-energy victory)
- unexpected (plot twist, surprise donation/event, jump scare)
- conversation (fascinating story, drama, hot take, inspiring quote)

TRANSCRIPT:
{transcript_text}

OUTPUT INSTRUCTION:
Return ONLY valid JSON (no markdown formatting, no code fences, no extra text) as a list of candidate moments in this exact structure:
[
  {{
    "title": "Short punchy viral title (3-6 words)",
    "category": "funny | rage | hype | unexpected | conversation",
    "start_time": 12.5,
    "end_time": 45.0,
    "score": 92.5,
    "hook_strength": 88.0,
    "explanation": "Why this moment is viral and entertaining"
  }}
]
"""

    try:
        logger.info(f"Querying Ollama at {ollama_url} with model {model}...")
        resp = requests.post(
            f"{ollama_url.rstrip('/')}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,
                    "top_p": 0.9,
                    "num_ctx": 4096
                }
            },
            timeout=45
        )

        if resp.status_code == 200:
            result_json = resp.json().get("response", "").strip()
            # Clean possible markdown fences
            clean_str = re.sub(r"^```(?:json)?", "", result_json).strip()
            clean_str = re.sub(r"```$", "", clean_str).strip()

            candidates = json.loads(clean_str)
            if isinstance(candidates, list) and len(candidates) > 0:
                logger.info(f"Ollama identified {len(candidates)} candidate moments.")
                return candidates
    except Exception as e:
        logger.warning(f"Ollama query failed or timed out: {e}. Switching to heuristic streamer NLP analyzer.")

    return fallback_heuristic_analyzer(transcript_segments, min_clip_sec, max_clip_sec)

def fallback_heuristic_analyzer(
    segments: List[Dict[str, Any]],
    min_clip_sec: float = 25.0,
    max_clip_sec: float = 60.0
) -> List[Dict[str, Any]]:
    """
    Intelligent rule-based NLP moment detector that operates locally with zero external dependencies.
    Evaluates streamer vocabulary, reaction density, punctuation emphasis, and pacing.
    """
    if not segments:
        return []

    total_duration = segments[-1]["end"]
    candidates = []

    # Sliding window approach across transcript segments
    i = 0
    while i < len(segments):
        start_seg = segments[i]
        start_time = start_seg["start"]
        
        # Look forward to find window between min_clip_sec and max_clip_sec
        j = i
        window_text = []
        while j < len(segments) and (segments[j]["end"] - start_time) <= max_clip_sec:
            window_text.append(segments[j]["text"])
            j += 1

        end_time = segments[min(j - 1, len(segments) - 1)]["end"]
        duration = end_time - start_time

        if duration >= min_clip_sec or (duration >= total_duration * 0.8):
            full_window_text = " ".join(window_text).lower()
            
            # Score categories
            hype_count = sum(1 for kw in HYPE_KEYWORDS if kw in full_window_text)
            rage_count = sum(1 for kw in RAGE_KEYWORDS if kw in full_window_text)
            funny_count = sum(1 for kw in FUNNY_KEYWORDS if kw in full_window_text)
            conv_count = sum(1 for kw in CONVERSATION_KEYWORDS if kw in full_window_text)

            # Determine dominant category
            scores = {
                "funny": funny_count * 1.5,
                "rage": rage_count * 1.6,
                "hype": hype_count * 1.4,
                "conversation": conv_count * 1.2
            }
            top_category = max(scores, key=scores.get)
            top_cat_score = scores[top_category]

            # Hook score: check if first segment has questions, exclamation, or strong keywords
            first_text = start_seg["text"].lower()
            hook_score = 65.0
            if any(k in first_text for k in HYPE_KEYWORDS | RAGE_KEYWORDS | FUNNY_KEYWORDS):
                hook_score += 25.0
            if "?" in start_seg["text"] or "!" in start_seg["text"]:
                hook_score += 10.0
            hook_score = min(100.0, hook_score)

            # Composite semantic score
            word_count = len(full_window_text.split())
            density = min(1.0, word_count / max(1.0, duration * 2.5)) # reasonable talking speed
            
            base_score = 60.0 + (top_cat_score * 8.0) + (density * 15.0)
            final_score = min(98.0, round(base_score, 1))

            # Generate smart titles based on category and first words
            words = start_seg["text"].strip().split()
            title_prefix = " ".join(words[:4]).strip('.,!?')
            if top_category == "funny":
                title = f"Bro Really Did This: {title_prefix.title()}"
            elif top_category == "rage":
                title = f"Streamer Loses It! {title_prefix.title()}"
            elif top_category == "hype":
                title = f"Insane Clutch Moment! {title_prefix.title()}"
            else:
                title = f"Wait For It... {title_prefix.title()}"

            candidates.append({
                "title": title[:50],
                "category": top_category if top_cat_score > 0 else "unexpected",
                "start_time": round(start_time, 2),
                "end_time": round(end_time, 2),
                "score": final_score,
                "hook_strength": hook_score,
                "explanation": f"High engagement {top_category} pattern detected with strong conversational hook."
            })

        i += max(1, (j - i) // 2) # 50% overlap step

    return candidates
