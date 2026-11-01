import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  bitrate: number;
}

let cachedFfmpegPath: string | null = null;
let cachedFfprobePath: string | null = null;

export function getFFmpegPath(): string {
  if (cachedFfmpegPath) return cachedFfmpegPath;

  // 1. Check direct environment variable
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    cachedFfmpegPath = process.env.FFMPEG_PATH;
    return cachedFfmpegPath;
  }

  // 2. Check Winget installation paths on Windows
  const userProfile = process.env.USERPROFILE || 'C:\\Users\\Dell';
  const wingetPkgDir = path.join(userProfile, 'AppData', 'Local', 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(wingetPkgDir)) {
    try {
      const dirs = fs.readdirSync(wingetPkgDir);
      for (const d of dirs) {
        if (d.toLowerCase().includes('ffmpeg')) {
          const fullPkgDir = path.join(wingetPkgDir, d);
          const subDirs = fs.readdirSync(fullPkgDir);
          for (const sd of subDirs) {
            const candidate = path.join(fullPkgDir, sd, 'bin', 'ffmpeg.exe');
            if (fs.existsSync(candidate)) {
              cachedFfmpegPath = candidate;
              return cachedFfmpegPath;
            }
          }
        }
      }
    } catch {
      // Continue to fallback
    }
  }

  // 3. Fallback to system command
  cachedFfmpegPath = 'ffmpeg';
  return cachedFfmpegPath;
}

export function getFFprobePath(): string {
  if (cachedFfprobePath) return cachedFfprobePath;

  if (process.env.FFPROBE_PATH && fs.existsSync(process.env.FFPROBE_PATH)) {
    cachedFfprobePath = process.env.FFPROBE_PATH;
    return cachedFfprobePath;
  }

  const ffmpegP = getFFmpegPath();
  if (ffmpegP !== 'ffmpeg') {
    const probeCandidate = path.join(path.dirname(ffmpegP), 'ffprobe.exe');
    if (fs.existsSync(probeCandidate)) {
      cachedFfprobePath = probeCandidate;
      return cachedFfprobePath;
    }
  }

  cachedFfprobePath = 'ffprobe';
  return cachedFfprobePath;
}

export async function probeVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn(getFFprobePath(), [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,r_frame_rate,duration,bit_rate',
      '-show_entries', 'format=duration,bit_rate',
      '-of', 'json',
      filePath
    ]);

    let output = '';
    let errorOutput = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed with code ${code}: ${errorOutput}`));
      }

      try {
        const data = JSON.parse(output);
        const stream = data.streams?.[0] || {};
        const format = data.format || {};

        let duration = parseFloat(stream.duration || format.duration || '0');
        const width = parseInt(stream.width || '1920', 10);
        const height = parseInt(stream.height || '1080', 10);

        let fps = 30;
        if (stream.r_frame_rate && stream.r_frame_rate.includes('/')) {
          const [num, den] = stream.r_frame_rate.split('/').map(Number);
          if (den > 0) fps = Math.round(num / den);
        }

        const bitrate = parseInt(format.bit_rate || stream.bit_rate || '0', 10);

        resolve({ duration, width, height, fps, bitrate });
      } catch (err) {
        reject(new Error(`Failed to parse ffprobe output: ${err}`));
      }
    });
  });
}

export async function extractAudio(videoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 16kHz mono WAV for Whisper & Librosa
    const ffmpeg = spawn(getFFmpegPath(), [
      '-y',
      '-i', videoPath,
      '-vn',
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      outputPath
    ]);

    let errorOutput = '';
    ffmpeg.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg audio extraction failed (${code}): ${errorOutput}`));
      }
      resolve();
    });
  });
}
