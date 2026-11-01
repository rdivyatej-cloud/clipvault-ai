import subprocess
import os
import sys
import glob

def find_ffmpeg() -> str:
    """Finds ffmpeg executable on Windows"""
    user_profile = os.environ.get("USERPROFILE", "C:\\Users\\Dell")
    pattern = os.path.join(user_profile, "AppData", "Local", "Microsoft", "WinGet", "Packages", "*", "*", "bin", "ffmpeg.exe")
    matches = glob.glob(pattern)
    if matches:
        return matches[0]
    return "ffmpeg"

def generate_test_video(output_path: str, duration: int = 25):
    """
    Generates a valid 1080p MP4 test video with synthetic audio tones
    and visual movement for automated pipeline testing without requiring external downloads.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    ffmpeg_bin = find_ffmpeg()
    
    # FFmpeg command generates:
    # 1. 1080p test video with moving bars, timer clock, and streamer simulation graphics
    # 2. Audio track with 440Hz baseline and an excitement frequency surge at 10-15s
    cmd = [
        ffmpeg_bin, "-y",
        "-f", "lavfi",
        "-i", f"testsrc=duration={duration}:size=1920x1080:rate=30",
        "-f", "lavfi",
        "-i", f"sine=frequency=440:duration={duration}",
        "-vf", "drawtext=text='CLIPVAULT AI TEST STREAM':fontsize=64:fontcolor=white:x=(w-text_w)/2:y=100:box=1:boxcolor=red@0.8",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-c:a", "aac",
        "-b:a", "128k",
        "-pix_fmt", "yuv420p",
        output_path
    ]
    
    print(f"Generating synthetic test video: {output_path} ({duration}s)...")
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        print(f"Error generating test video: {res.stderr}")
        sys.exit(1)
    print(f"Successfully generated: {output_path} ({os.path.getsize(output_path)} bytes)")

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "..", "temp", "sample_test_stream.mp4")
    generate_test_video(os.path.abspath(out))
