import { randomUUID } from 'node:crypto';
import db from '../../db/database.js';
import { queue } from '../queue.js';
import {
  detectSourceType,
  SourceDetectionResult,
  directMediaAdapter,
  youtubeMetadataAdapter,
  localFileAdapter,
  validateDirectMediaUrl,
  ProgressCallback,
  IngestionResult,
} from './sourceRegistry.js';

export interface VerifyResult {
  success: boolean;
  sourceType: 'youtube' | 'direct_media' | 'local_file' | 'unknown';
  normalizedInput: string;
  isDownloadableDirectly: boolean;
  metadata?: any;
  existingProject?: any;
  instructions?: any;
  error?: string;
}

export class IngestionManager {
  /**
   * Unified source verification for any input (YouTube link, Direct MP4 URL, Local file)
   */
  public async verifySource(input: string): Promise<VerifyResult> {
    const detection: SourceDetectionResult = detectSourceType(input);

    if (detection.sourceType === 'youtube') {
      const ytCheck = await youtubeMetadataAdapter.inspectUrl(input);
      if (!ytCheck.valid) {
        return {
          success: false,
          sourceType: 'youtube',
          normalizedInput: detection.normalizedInput,
          isDownloadableDirectly: false,
          error: ytCheck.error,
        };
      }
      return {
        success: true,
        sourceType: 'youtube',
        normalizedInput: ytCheck.metadata?.url || detection.normalizedInput,
        isDownloadableDirectly: false,
        metadata: ytCheck.metadata,
        existingProject: ytCheck.existingProject,
        instructions: ytCheck.instructions,
      };
    }

    if (detection.sourceType === 'direct_media') {
      const directCheck = await validateDirectMediaUrl(detection.normalizedInput);
      if (!directCheck.valid) {
        return {
          success: false,
          sourceType: 'direct_media',
          normalizedInput: detection.normalizedInput,
          isDownloadableDirectly: false,
          error: directCheck.error,
        };
      }

      // Check if project with this source URL already exists
      const existing = db.prepare(`
        SELECT id, name, status, duration, created_at 
        FROM projects 
        WHERE source_url = ? 
        LIMIT 1
      `).get(directCheck.normalizedUrl) as any;

      return {
        success: true,
        sourceType: 'direct_media',
        normalizedInput: directCheck.normalizedUrl || detection.normalizedInput,
        isDownloadableDirectly: true,
        metadata: {
          title: directCheck.suggestedFilename || 'Direct Media Video',
          suggested_filename: directCheck.suggestedFilename,
          content_length: directCheck.contentLength,
          content_type: directCheck.contentType,
          resolved_ip: directCheck.resolvedIp,
        },
        existingProject: existing ? {
          id: existing.id,
          name: existing.name,
          status: existing.status,
          duration: existing.duration,
          created_at: existing.created_at,
        } : null,
        instructions: {
          summary: 'Direct media URL verified. CLIPVAULT AI will automatically stream, ingest, and process this media locally.',
        },
      };
    }

    if (detection.sourceType === 'local_file') {
      const localCheck = await localFileAdapter.inspectLocalPath(detection.normalizedInput);
      if (!localCheck.valid) {
        return {
          success: false,
          sourceType: 'local_file',
          normalizedInput: detection.normalizedInput,
          isDownloadableDirectly: false,
          error: localCheck.error,
        };
      }

      return {
        success: true,
        sourceType: 'local_file',
        normalizedInput: localCheck.filePath || detection.normalizedInput,
        isDownloadableDirectly: false,
        metadata: {
          title: localCheck.filename,
          duration: localCheck.metadata?.duration,
          file_size: localCheck.fileSize,
          width: localCheck.metadata?.width,
          height: localCheck.metadata?.height,
        },
      };
    }

    return {
      success: false,
      sourceType: 'unknown',
      normalizedInput: input,
      isDownloadableDirectly: false,
      error: 'Unrecognized input. Please provide a YouTube video URL, direct media URL (.mp4/.mov/.webm/.mkv), or local file path.',
    };
  }

  /**
   * Ingest an authorized direct media URL
   */
  public async ingestDirectUrl(params: {
    url: string;
    name?: string;
    auto_analyze?: boolean;
    force?: boolean;
    onProgress?: ProgressCallback;
  }): Promise<{
    success: boolean;
    project: any;
    job_id: string | null;
    message?: string;
  }> {
    const { url, name, auto_analyze = true, force = false, onProgress } = params;

    // 1. Check duplicate by source_url
    const existing = db.prepare(`
      SELECT id, name, status, duration, created_at 
      FROM projects 
      WHERE source_url = ? 
      LIMIT 1
    `).get(url.trim()) as any;

    if (existing && !force) {
      return {
        success: false,
        project: existing,
        job_id: null,
        message: `Project "${existing.name}" already exists for this media URL.`,
      };
    }

    // 2. Stream download & validate
    const ingestResult: IngestionResult = await directMediaAdapter.ingestUrl(
      url.trim(),
      onProgress,
      name ? `${name}.mp4` : undefined
    );

    const projectId = randomUUID();
    const projectName = name?.trim() || ingestResult.filename.replace(/\.[^/.]+$/, '');
    const meta = ingestResult.metadata;

    // 3. Save project
    db.prepare(`
      INSERT INTO projects (
        id, name, source_type, source_path, source_url, local_media_path,
        duration, width, height, fps, file_size, status, created_at, updated_at
      ) VALUES (?, ?, 'direct_url', ?, ?, ?, ?, ?, ?, ?, ?, 'created', datetime('now'), datetime('now'))
    `).run(
      projectId,
      projectName,
      ingestResult.filePath,
      url.trim(),
      ingestResult.filePath,
      meta.duration,
      meta.width,
      meta.height,
      meta.fps,
      ingestResult.fileSize
    );

    // 4. Auto-enqueue AI clipping pipeline
    let jobId: string | null = null;
    if (auto_analyze) {
      jobId = await queue.enqueueJob(projectId, 'analysis');
    }

    return {
      success: true,
      project: {
        id: projectId,
        name: projectName,
        source_type: 'direct_url',
        duration: meta.duration,
        file_size: ingestResult.fileSize,
        status: 'created',
      },
      job_id: jobId,
      message: 'Direct media URL ingested and project created successfully.',
    };
  }
}

export const ingestionManager = new IngestionManager();

