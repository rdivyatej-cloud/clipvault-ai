import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { validateDirectMediaUrl, ValidationResult } from './sourceValidator.js';
import { probeVideo, VideoMetadata } from '../ffmpeg.js';

export interface IngestProgress {
  bytesDownloaded: number;
  totalBytes: number;
  percentage: number;
  speedBytesPerSec: number;
  status: 'downloading' | 'verifying' | 'completed' | 'failed';
}

export type ProgressCallback = (progress: IngestProgress) => void;

export interface IngestionResult {
  success: boolean;
  filePath: string;
  fileSize: number;
  filename: string;
  metadata: VideoMetadata;
  error?: string;
}

export class DirectMediaAdapter {
  private storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir || path.resolve(__dirname, '../../../../storage');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  public sanitizeFilename(name: string): string {
    // Remove null bytes, slashes, parent directory tokens
    const cleaned = name.replace(/[/\\?%*:|"<>]/g, '_').replace(/\.\.+/g, '.').trim();
    return cleaned || `video_${Date.now()}.mp4`;
  }

  public async ingestUrl(
    url: string,
    onProgress?: ProgressCallback,
    customFilename?: string
  ): Promise<IngestionResult> {
    // 1. SSRF validation
    const validation: ValidationResult = await validateDirectMediaUrl(url);
    if (!validation.valid || !validation.normalizedUrl) {
      throw new Error(validation.error || 'Direct media URL validation failed');
    }

    const safeBase = this.sanitizeFilename(customFilename || validation.suggestedFilename || `stream_${Date.now()}.mp4`);
    const ext = path.extname(safeBase) || '.mp4';
    const targetFilename = `${Date.now()}_${randomUUID().substring(0, 8)}${ext}`;
    const destinationPath = path.join(this.storageDir, targetFilename);
    const tempPath = `${destinationPath}.downloading`;

    let totalBytes = validation.contentLength || 0;
    let downloadedBytes = 0;
    let startTime = Date.now();
    let lastProgressUpdate = 0;

    try {
      const response = await fetch(validation.normalizedUrl, {
        headers: {
          'User-Agent': 'ClipVault-AI-Ingestion/2.0',
        },
      });

      if (!response.ok || !response.body) {
        throw new Error(`Media server responded with status code ${response.status}: ${response.statusText}`);
      }

      if (!totalBytes) {
        totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
      }

      const fileStream = fs.createWriteStream(tempPath);

      // Track progress via a pass-through transform stream
      const progressTracker = new Transform({
        transform(chunk, _encoding, callback) {
          downloadedBytes += chunk.length;
          const now = Date.now();

          // Throttle progress updates to at most once per 250ms or at completion
          if (now - lastProgressUpdate > 250 || (totalBytes > 0 && downloadedBytes >= totalBytes)) {
            lastProgressUpdate = now;
            const elapsedSec = (now - startTime) / 1000;
            const speed = elapsedSec > 0 ? downloadedBytes / elapsedSec : 0;
            const percentage = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;

            if (onProgress) {
              onProgress({
                bytesDownloaded: downloadedBytes,
                totalBytes,
                percentage,
                speedBytesPerSec: Math.round(speed),
                status: 'downloading',
              });
            }
          }
          callback(null, chunk);
        },
      });

      // Stream download to temporary file
      // @ts-ignore
      await pipeline(response.body, progressTracker, fileStream);

      // Move temporary file to final path
      if (fs.existsSync(destinationPath)) {
        fs.unlinkSync(destinationPath);
      }
      fs.renameSync(tempPath, destinationPath);

      if (onProgress) {
        onProgress({
          bytesDownloaded: downloadedBytes,
          totalBytes: downloadedBytes,
          percentage: 100,
          speedBytesPerSec: 0,
          status: 'verifying',
        });
      }

      // 2. Validate downloaded media integrity with FFprobe
      const metadata = await probeVideo(destinationPath);
      if (metadata.duration <= 0) {
        throw new Error('Downloaded file does not contain a valid playable video stream');
      }

      return {
        success: true,
        filePath: destinationPath,
        fileSize: downloadedBytes,
        filename: targetFilename,
        metadata,
      };
    } catch (err: any) {
      // Clean up temporary download file upon failure
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
      if (fs.existsSync(destinationPath)) {
        try { fs.unlinkSync(destinationPath); } catch {}
      }
      throw new Error(`Direct media ingestion failed: ${err.message || String(err)}`);
    }
  }
}

