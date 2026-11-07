import fs from 'node:fs';
import path from 'node:path';
import { probeVideo, VideoMetadata } from '../ffmpeg.js';

export interface LocalFileCheckResult {
  valid: boolean;
  filePath?: string;
  filename?: string;
  fileSize?: number;
  metadata?: VideoMetadata;
  error?: string;
}

const SUPPORTED_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi']);

export class LocalFileAdapter {
  public async inspectLocalPath(inputPath: string): Promise<LocalFileCheckResult> {
    if (!inputPath || typeof inputPath !== 'string') {
      return { valid: false, error: 'File path is required.' };
    }

    const resolved = path.resolve(inputPath.trim());
    if (!fs.existsSync(resolved)) {
      return { valid: false, error: `Local file not found at: ${resolved}` };
    }

    const ext = path.extname(resolved).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        error: `Unsupported file format "${ext}". Allowed: ${Array.from(SUPPORTED_EXTENSIONS).join(', ')}`,
      };
    }

    const stat = fs.statSync(resolved);
    if (stat.size <= 0) {
      return { valid: false, error: 'File is empty (0 bytes).' };
    }

    try {
      const metadata = await probeVideo(resolved);
      return {
        valid: true,
        filePath: resolved,
        filename: path.basename(resolved),
        fileSize: stat.size,
        metadata,
      };
    } catch (err: any) {
      return {
        valid: false,
        error: `Could not parse video stream with FFprobe: ${err.message || String(err)}`,
      };
    }
  }
}

