import { extractYouTubeVideoId } from '../youtube.js';
import path from 'node:path';
import fs from 'node:fs';

export type SourceType = 'youtube' | 'direct_media' | 'local_file' | 'unknown';

export interface SourceDetectionResult {
  sourceType: SourceType;
  normalizedInput: string;
  details: {
    isUrl: boolean;
    videoId?: string;
    extension?: string;
    protocol?: string;
  };
}

const SUPPORTED_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi']);

export function detectSourceType(input: string): SourceDetectionResult {
  if (!input || typeof input !== 'string') {
    return {
      sourceType: 'unknown',
      normalizedInput: '',
      details: { isUrl: false },
    };
  }

  const trimmed = input.trim();

  // 1. Check for YouTube formats
  const ytVideoId = extractYouTubeVideoId(trimmed);
  if (ytVideoId) {
    return {
      sourceType: 'youtube',
      normalizedInput: `https://www.youtube.com/watch?v=${ytVideoId}`,
      details: {
        isUrl: true,
        videoId: ytVideoId,
      },
    };
  }

  // 2. Check for URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      const ext = path.extname(url.pathname).toLowerCase();
      return {
        sourceType: 'direct_media',
        normalizedInput: trimmed,
        details: {
          isUrl: true,
          extension: ext || undefined,
          protocol: url.protocol,
        },
      };
    } catch {
      // Invalid URL
    }
  }

  // 3. Check for local filesystem path
  const ext = path.extname(trimmed).toLowerCase();
  if (SUPPORTED_EXTENSIONS.has(ext) || fs.existsSync(trimmed)) {
    return {
      sourceType: 'local_file',
      normalizedInput: trimmed,
      details: {
        isUrl: false,
        extension: ext,
      },
    };
  }

  return {
    sourceType: 'unknown',
    normalizedInput: trimmed,
    details: { isUrl: false },
  };
}

