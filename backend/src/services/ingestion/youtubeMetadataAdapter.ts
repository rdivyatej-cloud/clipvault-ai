import { extractYouTubeVideoId, fetchYouTubeMetadata, YouTubeMetadata } from '../youtube.js';
import db from '../../db/database.js';

export type YouTubeAvailabilityState =
  | 'metadata_verified'
  | 'awaiting_authorized_recording'
  | 'authorized_media_available'
  | 'ingestion_in_progress'
  | 'ingestion_completed'
  | 'source_unavailable'
  | 'processing_failed';

export interface YouTubeIngestionCheck {
  valid: boolean;
  videoId?: string;
  metadata?: YouTubeMetadata;
  availabilityState: YouTubeAvailabilityState;
  isDownloadableDirectly: false;
  existingProject?: {
    id: string;
    name: string;
    status: string;
    duration?: number;
    created_at?: string;
  } | null;
  instructions: {
    summary: string;
    export_methods: string[];
    complianceNotice: string;
  };
  error?: string;
}

export class YouTubeMetadataAdapter {
  public async inspectUrl(url: string): Promise<YouTubeIngestionCheck> {
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      return {
        valid: false,
        availabilityState: 'source_unavailable',
        isDownloadableDirectly: false,
        error: 'Invalid YouTube URL format. Supported formats include youtube.com/watch?v=..., youtu.be/..., /shorts, /live, and /embed.',
        instructions: {
          summary: 'Please provide a valid YouTube link.',
          export_methods: [],
          complianceNotice: '',
        },
      };
    }

    try {
      const metadata = await fetchYouTubeMetadata(videoId);

      // Check existing project
      const existing = db.prepare(`
        SELECT id, name, status, duration, created_at
        FROM projects
        WHERE youtube_id = ?
        ORDER BY datetime(created_at) DESC
        LIMIT 1
      `).get(videoId) as any;

      let state: YouTubeAvailabilityState = 'metadata_verified';
      if (existing) {
        state = existing.status === 'analyzed' ? 'ingestion_completed' : 'authorized_media_available';
      } else {
        state = 'awaiting_authorized_recording';
      }

      return {
        valid: true,
        videoId,
        metadata,
        availabilityState: state,
        isDownloadableDirectly: false,
        existingProject: existing ? {
          id: existing.id,
          name: existing.name,
          status: existing.status,
          duration: existing.duration,
          created_at: existing.created_at,
        } : null,
        instructions: {
          summary: 'YouTube provides metadata and player embeds through its API, not direct raw media file streams. To analyze this video with local AI, please provide your authorized local video export.',
          export_methods: [
            'Creator Export: Download your 1080p source video directly from YouTube Studio (Studio > Content > Options > Download).',
            'Google Takeout: Export your channel archives via takeout.google.com.',
            'Local Streamer Capture: Select your original local recording exported from OBS Studio, Twitch VOD, or capture card.',
          ],
          complianceNotice: 'CLIPVAULT AI strictly complies with YouTube Terms of Service and does not perform unauthorized stream ripping or DRM circumvention.',
        },
      };
    } catch (err: any) {
      return {
        valid: false,
        videoId,
        availabilityState: 'source_unavailable',
        isDownloadableDirectly: false,
        error: err.message || 'YouTube video not found, private, or unavailable.',
        instructions: {
          summary: 'Video is unavailable or private on YouTube.',
          export_methods: [],
          complianceNotice: '',
        },
      };
    }
  }
}

