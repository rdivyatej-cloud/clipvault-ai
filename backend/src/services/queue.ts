import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import db from '../db/database.js';
import { extractAudio, probeVideo } from './ffmpeg.js';
import { transcribeAudio, analyzeMoments, renderClip } from './aiClient.js';

export const queueEvents = new EventEmitter();

export type JobStage =
  | 'pending'
  | 'validating_source'
  | 'ingesting_media'
  | 'preparing_media'
  | 'transcribing'
  | 'analyzing_audio'
  | 'analyzing_video'
  | 'ranking_moments'
  | 'generating_clips'
  | 'completed'
  | 'failed'
  | 'cancelled';

class ProcessingQueue {
  private isProcessing: boolean = false;
  private queueInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.recoverInterruptedJobs();
    this.startQueueWorker();
  }

  private recoverInterruptedJobs() {
    try {
      const interrupted = db.prepare("SELECT id FROM jobs WHERE status = 'processing'").all() as { id: string }[];
      for (const job of interrupted) {
        db.prepare(
          "UPDATE jobs SET status = 'failed', error_message = 'Job interrupted by system restart. Ready for retry.', current_step = 'Interrupted by system restart' WHERE id = ?"
        ).run(job.id);
      }
    } catch (err) {
      console.error('Failed to recover interrupted jobs:', err);
    }
  }

  private startQueueWorker() {
    if (this.queueInterval) clearInterval(this.queueInterval);
    this.queueInterval = setInterval(() => {
      this.processNextJob();
    }, 1500);
    this.queueInterval.unref();
  }

  public async enqueueJob(projectId: string, type: 'analysis' | 'render_clip', clipId?: string): Promise<string> {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO jobs (id, project_id, type, status, progress, current_step, current_stage, clip_id, created_at, updated_at)
      VALUES (?, ?, ?, 'queued', 0, 'Waiting in queue...', 'pending', ?, datetime('now'), datetime('now'))
    `).run(id, projectId, type, clipId || null);

    queueEvents.emit('enqueued', { jobId: id, projectId, type });
    setImmediate(() => this.processNextJob());
    return id;
  }

  public cancelJob(jobId: string): boolean {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
    if (!job) return false;

    db.prepare(`
      UPDATE jobs 
      SET status = 'cancelled', current_step = 'Job cancelled by user', current_stage = 'cancelled', completed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(jobId);

    queueEvents.emit(`job:${jobId}`, {
      jobId,
      status: 'cancelled',
      progress: job.progress,
      step: 'Job cancelled by user',
      stage: 'cancelled',
    });
    return true;
  }

  private isJobCancelled(jobId: string): boolean {
    const job = db.prepare('SELECT status FROM jobs WHERE id = ?').get(jobId) as any;
    return !job || job.status === 'cancelled';
  }

  private async processNextJob() {
    if (this.isProcessing) return;

    const nextJob = db.prepare(`
      SELECT * FROM jobs 
      WHERE status = 'queued' 
      ORDER BY datetime(created_at) ASC 
      LIMIT 1
    `).get() as any;

    if (!nextJob) return;

    this.isProcessing = true;
    const jobId = nextJob.id;
    const projectId = nextJob.project_id;

    try {
      db.prepare(`
        UPDATE jobs 
        SET status = 'processing', started_at = datetime('now'), progress = 5, current_step = 'Starting job...', current_stage = 'validating_source', updated_at = datetime('now') 
        WHERE id = ?
      `).run(jobId);

      queueEvents.emit(`job:${jobId}`, { jobId, status: 'processing', progress: 5, step: 'Starting job...', stage: 'validating_source' });

      if (nextJob.type === 'analysis') {
        await this.runAnalysisJob(jobId, projectId);
      } else if (nextJob.type === 'render_clip') {
        await this.runRenderClipJob(jobId, projectId, nextJob.clip_id);
      }

      if (this.isJobCancelled(jobId)) {
        return;
      }

      db.prepare(`
        UPDATE jobs 
        SET status = 'completed', progress = 100, current_step = 'Completed successfully', current_stage = 'completed', completed_at = datetime('now'), updated_at = datetime('now') 
        WHERE id = ?
      `).run(jobId);

      queueEvents.emit(`job:${jobId}`, { jobId, status: 'completed', progress: 100, step: 'Completed successfully', stage: 'completed' });
    } catch (err: any) {
      if (this.isJobCancelled(jobId)) return;

      console.error(`Job ${jobId} failed:`, err);
      db.prepare(`
        UPDATE jobs 
        SET status = 'failed', error_message = ?, current_stage = 'failed', completed_at = datetime('now'), updated_at = datetime('now') 
        WHERE id = ?
      `).run(err.message || String(err), jobId);

      db.prepare("UPDATE projects SET status = 'error', updated_at = datetime('now') WHERE id = ?").run(projectId);

      queueEvents.emit(`job:${jobId}`, { jobId, status: 'failed', error: err.message, stage: 'failed' });
    } finally {
      this.isProcessing = false;
    }
  }

  public updateJobProgress(jobId: string, progress: number, step: string, stage?: JobStage) {
    const currentStage = stage || 'preparing_media';
    db.prepare(`
      UPDATE jobs 
      SET progress = ?, current_step = ?, current_stage = ?, stage_details = ?, updated_at = datetime('now') 
      WHERE id = ?
    `).run(progress, step, currentStage, step, jobId);

    const payload = { jobId, progress, step, stage: currentStage, status: 'processing' };
    queueEvents.emit('progress', payload);
    queueEvents.emit(`job:${jobId}`, payload);
  }

  private getSetting(key: string, defaultValue: string): string {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any;
    return row ? row.value : defaultValue;
  }

  private async runAnalysisJob(jobId: string, projectId: string) {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
    if (!project) throw new Error(`Project ${projectId} not found`);

    const videoPath = project.source_path;
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found at: ${videoPath}`);
    }

    db.prepare("UPDATE projects SET status = 'analyzing', updated_at = datetime('now') WHERE id = ?").run(projectId);

    // 1. Probe video
    if (this.isJobCancelled(jobId)) return;
    this.updateJobProgress(jobId, 10, 'Inspecting video stream and metadata...', 'validating_source');
    const meta = await probeVideo(videoPath);
    db.prepare(`
      UPDATE projects 
      SET duration = ?, width = ?, height = ?, fps = ?, updated_at = datetime('now') 
      WHERE id = ?
    `).run(meta.duration, meta.width, meta.height, meta.fps, projectId);

    // 2. Extract Audio
    if (this.isJobCancelled(jobId)) return;
    this.updateJobProgress(jobId, 25, 'Extracting 16kHz audio stream...', 'preparing_media');
    const tempDir = path.resolve(__dirname, '../../../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const audioPath = path.join(tempDir, `${projectId}_audio.wav`);
    await extractAudio(videoPath, audioPath);

    // 3. Speech Transcription
    if (this.isJobCancelled(jobId)) return;
    const whisperModel = this.getSetting('whisper_model', 'base');
    this.updateJobProgress(jobId, 45, `Transcribing speech with faster-whisper (${whisperModel})...`, 'transcribing');
    const transcriptResult = await transcribeAudio(audioPath, whisperModel);

    // Save transcript
    const transcriptId = randomUUID();
    db.prepare(`
      INSERT INTO transcripts (id, project_id, language, full_text, segments_json, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(
      transcriptId,
      projectId,
      transcriptResult.language || 'en',
      transcriptResult.full_text || '',
      JSON.stringify(transcriptResult.segments || [])
    );

    // 4. Moment Detection (Audio + Scene + Contextual Qwen)
    if (this.isJobCancelled(jobId)) return;
    this.updateJobProgress(jobId, 65, 'Analyzing audio excitement & energy peaks...', 'analyzing_audio');
    const minClipDuration = parseFloat(this.getSetting('default_clip_min_duration', '25'));
    const maxClipDuration = parseFloat(this.getSetting('default_clip_max_duration', '60'));
    const ollamaUrl = this.getSetting('ollama_url', 'http://localhost:11434');
    const ollamaModel = this.getSetting('ollama_model', 'qwen2.5:1.5b');

    this.updateJobProgress(jobId, 75, 'Analyzing visual activity & scene transitions...', 'analyzing_video');
    this.updateJobProgress(jobId, 82, 'Detecting viral hooks with local Qwen 2.5 1.5B...', 'ranking_moments');

    const analysisResult = await analyzeMoments({
      video_path: videoPath,
      audio_path: audioPath,
      transcript_segments: transcriptResult.segments || [],
      min_clip_duration: minClipDuration,
      max_clip_duration: maxClipDuration,
      ollama_url: ollamaUrl,
      ollama_model: ollamaModel,
    });

    const moments = analysisResult.moments || [];
    this.updateJobProgress(jobId, 85, `Found ${moments.length} entertaining candidate moments!`, 'ranking_moments');

    // Save candidate moments with scoring details
    for (const m of moments) {
      const momentId = randomUUID();
      db.prepare(`
        INSERT INTO candidate_moments (
          id, project_id, title, category, start_time, end_time, duration,
          score, hook_strength, audio_intensity, visual_activity, semantic_score,
          explanation, transcript_excerpt, scoring_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        momentId,
        projectId,
        m.title,
        m.category,
        m.start_time,
        m.end_time,
        m.duration,
        m.score,
        m.hook_strength || 0,
        m.audio_intensity || 0,
        m.visual_activity || 0,
        m.semantic_score || 0,
        m.explanation || '',
        m.transcript_excerpt || '',
        JSON.stringify({
          emotional_intensity: m.semantic_score || 0,
          audio_excitement: m.audio_intensity || 0,
          visual_activity: m.visual_activity || 0,
          hook_strength: m.hook_strength || 0,
          composite_score: m.score || 0,
        })
      );
    }

    // 5. Automatically Render Top Clips (if configured)
    if (this.isJobCancelled(jobId)) return;
    const autoClipCount = parseInt(this.getSetting('auto_generate_clips_count', '3'), 10);
    const framingMode = this.getSetting('framing_mode', 'blur_pillarbox');
    const subtitleStyle = this.getSetting('subtitle_style', 'red_highlight');
    const audioNorm = this.getSetting('audio_normalization', 'true') === 'true';

    const outputDir = path.resolve(__dirname, '../../../output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const topMoments = moments.slice(0, autoClipCount);
    for (let i = 0; i < topMoments.length; i++) {
      if (this.isJobCancelled(jobId)) return;
      const tm = topMoments[i];
      const clipProgress = 85 + Math.round(((i + 1) / topMoments.length) * 13);
      this.updateJobProgress(jobId, clipProgress, `Rendering vertical 9:16 clip ${i + 1}/${topMoments.length}...`, 'generating_clips');

      const clipId = randomUUID();
      const clipFileName = `${projectId}_clip_${i + 1}_${clipId.substring(0, 8)}.mp4`;
      const thumbFileName = `${projectId}_clip_${i + 1}_${clipId.substring(0, 8)}.jpg`;

      const clipOutputPath = path.join(outputDir, clipFileName);
      const thumbOutputPath = path.join(outputDir, thumbFileName);

      const renderRes = await renderClip({
        video_path: videoPath,
        start_time: tm.start_time,
        end_time: tm.end_time,
        output_path: clipOutputPath,
        thumbnail_path: thumbOutputPath,
        transcript_segments: transcriptResult.segments || [],
        framing_mode: framingMode,
        subtitle_style: subtitleStyle,
        audio_norm: audioNorm,
      });

      db.prepare(`
        INSERT INTO clips (
          id, project_id, moment_id, title, category, start_time, end_time,
          duration, video_path, thumbnail_path, file_size, status, subtitle_style, aspect_ratio, created_at
        ) VALUES (?, ?, null, ?, ?, ?, ?, ?, ?, ?, ?, 'rendered', ?, '9:16', datetime('now'))
      `).run(
        clipId,
        projectId,
        tm.title,
        tm.category,
        tm.start_time,
        tm.end_time,
        tm.duration,
        clipFileName,
        thumbFileName,
        renderRes.file_size || 0,
        subtitleStyle
      );
    }

    // 6. Clean up temporary audio file
    if (fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath);
      } catch (err) {
        console.warn('Could not remove temporary WAV file:', err);
      }
    }

    db.prepare("UPDATE projects SET status = 'analyzed', updated_at = datetime('now') WHERE id = ?").run(projectId);
  }

  private async runRenderClipJob(jobId: string, projectId: string, clipId?: string) {
    if (!clipId) throw new Error('Clip ID required for render_clip job');

    const clip = db.prepare('SELECT * FROM clips WHERE id = ?').get(clipId) as any;
    if (!clip) throw new Error(`Clip ${clipId} not found`);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
    if (!project) throw new Error(`Project ${projectId} not found`);

    const transcriptRow = db.prepare('SELECT segments_json FROM transcripts WHERE project_id = ?').get(projectId) as any;
    const segments = transcriptRow ? JSON.parse(transcriptRow.segments_json) : [];

    this.updateJobProgress(jobId, 30, 'Rendering custom vertical 9:16 clip...', 'generating_clips');

    const framingMode = this.getSetting('framing_mode', 'blur_pillarbox');
    const audioNorm = this.getSetting('audio_normalization', 'true') === 'true';
    const outputDir = path.resolve(__dirname, '../../../output');

    const clipFileName = `${projectId}_clip_${clipId.substring(0, 8)}.mp4`;
    const thumbFileName = `${projectId}_clip_${clipId.substring(0, 8)}.jpg`;

    const clipOutputPath = path.join(outputDir, clipFileName);
    const thumbOutputPath = path.join(outputDir, thumbFileName);

    const renderRes = await renderClip({
      video_path: project.source_path,
      start_time: clip.start_time,
      end_time: clip.end_time,
      output_path: clipOutputPath,
      thumbnail_path: thumbOutputPath,
      transcript_segments: segments,
      framing_mode: framingMode,
      subtitle_style: clip.subtitle_style || 'red_highlight',
      audio_norm: audioNorm,
    });

    db.prepare(`
      UPDATE clips 
      SET video_path = ?, thumbnail_path = ?, file_size = ?, status = 'rendered' 
      WHERE id = ?
    `).run(clipFileName, thumbFileName, renderRes.file_size || 0, clipId);
  }
}

export const queue = new ProcessingQueue();


