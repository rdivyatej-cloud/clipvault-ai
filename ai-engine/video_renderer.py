import os
import subprocess
import logging
import math
import glob
from typing import Dict, Any, List

logger = logging.getLogger("clipvault.video_renderer")

def find_ffmpeg() -> str:
    user_profile = os.environ.get("USERPROFILE", "C:\\Users\\Dell")
    pattern = os.path.join(user_profile, "AppData", "Local", "Microsoft", "WinGet", "Packages", "*", "*", "bin", "ffmpeg.exe")
    matches = glob.glob(pattern)
    if matches:
        return matches[0]
    return "ffmpeg"

def format_ass_timestamp(seconds: float) -> str:
    """Converts seconds float to ASS timestamp format: H:MM:SS.cc"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs >= 100:
        cs = 99
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

def generate_ass_subtitles(
    segments: List[Dict[str, Any]],
    clip_start: float,
    clip_end: float,
    output_ass_path: str,
    style_mode: str = "red_highlight"
) -> str:
    """
    Generates high-production ASS subtitle file with synchronized word highlights.
    ASS Colors are in &HAABBGGRR format:
    - Pure White: &H00FFFFFF
    - Vivid Crimson Red: &H002020EF
    - Dark Outline/Shadow: &H00000000
    """
    ass_header = """[Script Info]
Title: CLIPVAULT Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Montserrat,72,&H00FFFFFF,&H002020EF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,5,2,2,60,60,260,1
Style: RedHighlight,Montserrat,74,&H002020EF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,1,0,1,6,3,2,60,60,260,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    dialogue_lines: List[str] = []

    # Filter segments within clip duration
    for seg in segments:
        seg_start = seg["start"]
        seg_end = seg["end"]

        # Only include if intersects with clip
        if seg_end <= clip_start or seg_start >= clip_end:
            continue

        # Relativize to clip start
        rel_start = max(0.0, seg_start - clip_start)
        rel_end = min(clip_end - clip_start, seg_end - clip_start)

        words = seg.get("words", [])
        if words and len(words) > 0:
            # Word-level karaoke / color animation
            # Group into 3-5 word chunks for clean 9:16 reading
            chunk_size = 4
            for i in range(0, len(words), chunk_size):
                word_group = words[i:i + chunk_size]
                g_start = max(0.0, word_group[0]["start"] - clip_start)
                g_end = min(clip_end - clip_start, word_group[-1]["end"] - clip_start)

                if g_end <= 0 or g_start >= (clip_end - clip_start):
                    continue

                for active_idx, target_word in enumerate(word_group):
                    w_start = max(0.0, target_word["start"] - clip_start)
                    w_end = min(clip_end - clip_start, target_word["end"] - clip_start)
                    
                    if w_end <= w_start:
                        w_end = w_start + 0.3

                    # Build text line where target_word has red accent
                    rendered_words = []
                    for w_idx, w in enumerate(word_group):
                        word_text = w["word"].upper()
                        if w_idx == active_idx:
                            # Highlight in vibrant red
                            rendered_words.append(r"{\c&H002020EF\b1}" + word_text + r"{\c&H00FFFFFF\b0}")
                        else:
                            rendered_words.append(word_text)

                    dialogue_lines.append(
                        f"Dialogue: 0,{format_ass_timestamp(w_start)},{format_ass_timestamp(w_end)},Default,,0,0,0,,{' '.join(rendered_words)}"
                    )
        else:
            # Fallback to segment-level subtitles
            text = seg["text"].upper()
            dialogue_lines.append(
                f"Dialogue: 0,{format_ass_timestamp(rel_start)},{format_ass_timestamp(rel_end)},Default,,0,0,0,,{text}"
            )

    os.makedirs(os.path.dirname(output_ass_path), exist_ok=True)
    with open(output_ass_path, "w", encoding="utf-8") as f:
        f.write(ass_header + "\n".join(dialogue_lines) + "\n")

    return output_ass_path

def render_vertical_clip(
    video_path: str,
    start_sec: float,
    end_sec: float,
    output_path: str,
    thumbnail_path: str,
    segments: List[Dict[str, Any]],
    framing_mode: str = "blur_pillarbox",
    subtitle_style: str = "red_highlight",
    audio_norm: bool = True
) -> Dict[str, Any]:
    """
    Renders a vertical 9:16 (1080x1920) MP4 video with synchronized subtitles using FFmpeg.
    """
    duration = end_sec - start_sec
    if duration <= 0:
        raise ValueError("Invalid clip duration: end_sec must be greater than start_sec")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    os.makedirs(os.path.dirname(thumbnail_path), exist_ok=True)

    # Temporary ASS file
    ass_path = output_path.replace(".mp4", ".ass")
    generate_ass_subtitles(segments, start_sec, end_sec, ass_path, style_mode=subtitle_style)

    # Escape path for FFmpeg subtitles filter on Windows
    # FFmpeg requires escaping colons and backslashes
    escaped_ass = ass_path.replace("\\", "/").replace(":", "\\:")

    # Build filter complex for 9:16 vertical canvas
    if framing_mode == "center_crop":
        # Direct center crop to 9:16
        vf_chain = (
            f"crop=ih*9/16:ih:(iw-ow)/2:0,scale=1080:1920,"
            f"subtitles='{escaped_ass}'"
        )
        filter_args = ["-vf", vf_chain]
    else:
        # High-end blur-pillarbox:
        # Background: scaled and heavily blurred to fill 1080x1920
        # Foreground: crisp 16:9 video centered horizontally and vertically
        filter_complex = (
            f"[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=20:5[bg];"
            f"[0:v]scale=1080:-1[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2[merged];"
            f"[merged]subtitles='{escaped_ass}'[v]"
        )
        filter_args = ["-filter_complex", filter_complex, "-map", "[v]", "-map", "0:a?"]

    # Audio filters
    audio_args = ["-c:a", "aac", "-b:a", "192k"]
    if audio_norm:
        audio_args.extend(["-af", "loudnorm=I=-16:TP=-1.5:LRA=11"])

    ffmpeg_bin = find_ffmpeg()
    # Full FFmpeg render command
    cmd = [
        ffmpeg_bin, "-y",
        "-ss", str(round(start_sec, 3)),
        "-i", video_path,
        "-t", str(round(duration, 3)),
        *filter_args,
        "-c:v", "libx264",
        "-preset", "veryfast",  # Optimized for CPU execution on i5-11320H
        "-crf", "22",
        "-pix_fmt", "yuv420p",
        *audio_args,
        "-movflags", "+faststart",
        output_path
    ]

    logger.info(f"Rendering clip: {start_sec}s -> {end_sec}s into {output_path}")
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        logger.error(f"FFmpeg error: {proc.stderr}")
        raise RuntimeError(f"FFmpeg render failed: {proc.stderr[-500:]}")

    # Generate thumbnail frame from the middle of the clip
    mid_time = duration / 2.0
    thumb_cmd = [
        ffmpeg_bin, "-y",
        "-ss", str(round(mid_time, 2)),
        "-i", output_path,
        "-vframes", "1",
        "-q:v", "2",
        thumbnail_path
    ]
    subprocess.run(thumb_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # Clean up temporary ASS file
    if os.path.exists(ass_path):
        try:
            os.remove(ass_path)
        except Exception:
            pass

    file_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0

    return {
        "output_path": output_path,
        "thumbnail_path": thumbnail_path,
        "duration": duration,
        "file_size": file_size
    }
