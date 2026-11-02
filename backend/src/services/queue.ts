import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import db from '../db/database.js';
import { extractAudio, probeVideo } from './ffmpeg.js';
import { transcribeAudio, analyzeMoments, renderClip } from './aiClient.js';

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
          "UPDATE jobs SET status = 'failed', error_message = 'Job interrupted by system restart. Ready for retry.' WHERE id = ?"
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
  }

  public async enqueueJob(projectId: string, type: 'analysis' | 'render_clip', clipId?: string): Promise<string> {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO jobs (id, project_id, type, status, progress, current_step, clip_id, created_at)
      VALUES (?, ?, ?, 'queued', 0, 'Waiting in queue...', ?, datetime('now'))
    `).run(id, projectId, type, clipId || null);

    // Trigger immediate check
    setImmediate(() => this.processNextJob());
    return id;
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
        SET status = 'processing', started_at = datetime('now'), progress = 5, current_step = 'Starting job...' 
        WHERE id = ?
      `).run(jobId);

      if (nextJob.type === 'analysis') {
        await this.runAnalysisJob(jobId, projectId);
      } else if (nextJob.type === 'render_clip') {
        await this.runRenderClipJob(jobId, projectId, nextJob.clip_id);
      }

      db.prepare(`
        UPDATE jobs 
        SET status = 'completed', progress = 100, current_step = 'Completed successfully', completed_at = datetime('now') 
        WHERE id = ?
      `).run(jobId);
    } catch (err: any) {
      console.error(`Job ${jobId} failed:`, err);
      db.prepare(`
        UPDATE jobs 
        SET status = 'failed', error_message = ?, completed_at = datetime('now') 
        WHERE id = ?
      `).run(err.message || String(err), jobId);

      db.prepare("UPDATE projects SET status = 'error' WHERE id = ?").run(projectId);
    } finally {
      this.isProcessing = false;
    }
  }

  private updateJobProgress(jobId: string, progress: number, step: string) {
    db.prepare(`
      UPDATE jobs SET progress = ?, current_step = ? WHERE id = ?
    `).run(progress, step, jobId);
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

    db.prepare("UPDATE projects SET status = 'analyzing' WHERE id = ?").run(projectId);

    // 1. Probe video
    this.updateJobProgress(jobId, 10, 'Inspecting video stream and metadata...');
    const meta = await probeVideo(videoPath);
    db.prepare(`
      UPDATE projects 
      SET duration = ?, width = ?, height = ?, fps = ? 
      WHERE id = ?
    `).run(meta.duration, meta.width, meta.height, meta.fps, projectId);

    // 2. Extract Audio
    this.updateJobProgress(jobId, 25, 'Extracting 16kHz audio stream...');
    const tempDir = path.resolve(__dirname, '../../../temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const audioPath = path.join(tempDir, `${projectId}_audio.wav`);
    await extractAudio(videoPath, audioPath);

    // 3. Speech Transcription
    const whisperModel = this.getSetting('whisper_model', 'base');
    this.updateJobProgress(jobId, 45, `Transcribing speech with faster-whisper (${whisperModel})...`);
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

    // 4. Moment Detection
    this.updateJobProgress(jobId, 70, 'Detecting hype, funny & rage moments (Audio + Scene + Qwen AI)...');
    const minClipDuration = parseFloat(this.getSetting('default_clip_min_duration', '25'));
    const maxClipDuration = parseFloat(this.getSetting('default_clip_max_duration', '60'));
    const ollamaUrl = this.getSetting('ollama_url', 'http://localhost:11434');
    const ollamaModel = this.getSetting('ollama_model', 'qwen2.5:3b');

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
    this.updateJobProgress(jobId, 85, `Found ${moments.length} entertaining candidate moments!`);

    // Save candidate moments
    for (const m of moments) {
      const momentId = randomUUID();
      db.prepare(`
        INSERT INTO candidate_moments (
          id, project_id, title, category, start_time, end_time, duration,
          score, hook_strength, audio_intensity, visual_activity, semantic_score,
          explanation, transcript_excerpt, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
        m.transcript_excerpt || ''
      );
    }

    // 5. Automatically Render Top Clips (if configured)
    const autoClipCount = parseInt(this.getSetting('auto_generate_clips_count', '3'), 10);
    const framingMode = this.getSetting('framing_mode', 'blur_pillarbox');
    const subtitleStyle = this.getSetting('subtitle_style', 'red_highlight');
    const audioNorm = this.getSetting('audio_normalization', 'true') === 'true';

    const outputDir = path.resolve(__dirname, '../../../output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const topMoments = moments.slice(0, autoClipCount);
    for (let i = 0; i < topMoments.length; i++) {
      const tm = topMoments[i];
      const clipProgress = 85 + Math.round(((i + 1) / topMoments.length) * 12);
      this.updateJobProgress(jobId, clipProgress, `Rendering vertical 9:16 clip ${i + 1}/${topMoments.length}...`);

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

    db.prepare("UPDATE projects SET status = 'analyzed' WHERE id = ?").run(projectId);
  }

  private async runRenderClipJob(jobId: string, projectId: string, clipId?: string) {
    if (!clipId) throw new Error('Clip ID required for render_clip job');

    const clip = db.prepare('SELECT * FROM clips WHERE id = ?').get(clipId) as any;
    if (!clip) throw new Error(`Clip ${clipId} not found`);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as any;
    if (!project) throw new Error(`Project ${projectId} not found`);

    const transcriptRow = db.prepare('SELECT segments_json FROM transcripts WHERE project_id = ?').get(projectId) as any;
    const segments = transcriptRow ? JSON.parse(transcriptRow.segments_json) : [];

    this.updateJobProgress(jobId, 30, 'Rendering custom vertical 9:16 clip...');

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

