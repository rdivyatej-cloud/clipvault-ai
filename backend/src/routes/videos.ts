import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import db from '../db/database.js';
import { probeVideo } from '../services/ffmpeg.js';
import { queue } from '../services/queue.js';
import { extractYouTubeVideoId, fetchYouTubeMetadata } from '../services/youtube.js';

const router = Router();

const storageDir = path.resolve(__dirname, '../../../storage');
if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, storageDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}_${randomUUID().substring(0, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 * 1024 }, // 4GB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['.mp4', '.mkv', '.mov', '.webm', '.avi'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported video format: ${ext}. Allowed formats: ${allowed.join(', ')}`));
    }
  },
});

// POST /api/videos/youtube/verify - Validate URL and fetch video metadata
router.post('/youtube/verify', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide a valid YouTube URL.' 
      });
    }

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid YouTube URL format. Supported formats include youtube.com/watch?v=..., youtu.be/..., shorts, live, and embed links.'
      });
    }

    // Retrieve metadata (YouTube Data API v3 if configured, or public oEmbed fallback)
    const metadata = await fetchYouTubeMetadata(videoId);

    // Check if a project already exists with this YouTube video ID
    const existingProject = db.prepare(`
      SELECT id, name, status, duration, created_at, source_path
      FROM projects
      WHERE youtube_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT 1
    `).get(videoId) as any;

    return res.json({
      success: true,
      video_id: metadata.video_id,
      url: metadata.url,
      metadata,
      existing_project: existingProject ? {
        id: existingProject.id,
        name: existingProject.name,
        status: existingProject.status,
        duration: existingProject.duration,
        created_at: existingProject.created_at
      } : null,
      instructions: {
        summary: 'To perform local AI clipping on this video without bypassing platform protections, please select your authorized local video file.',
        export_methods: [
          'Creator Export: Download your video directly from YouTube Studio (Studio > Content > Options > Download).',
          'Google Takeout: Export your channel archives via takeout.google.com.',
          'Streamer VODs / Captures: Select the original recording exported from OBS Studio, Twitch VOD, or your local capture card.'
        ]
      }
    });
  } catch (err: any) {
    const statusCode = err.message?.includes('not found, private, or unavailable') ? 404 : 500;
    return res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to verify YouTube video.'
    });
  }
});

// POST /api/videos/youtube/associate - Associate authorized local video with verified YouTube video
router.post('/youtube/associate', upload.single('video'), async (req: Request, res: Response) => {
  try {
    const youtubeId = req.body.youtube_id?.trim();
    if (!youtubeId || !/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
      return res.status(400).json({
        success: false,
        error: 'A valid 11-character YouTube video ID is required for association.'
      });
    }

    const force = req.body.force === 'true' || req.body.force === true;

    // Check duplicate project
    const existingProject = db.prepare(`
      SELECT id, name, status, duration, created_at
      FROM projects
      WHERE youtube_id = ?
      LIMIT 1
    `).get(youtubeId) as any;

    if (existingProject && !force) {
      // Clean up uploaded file if rejected as duplicate
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }

      return res.status(409).json({
        success: false,
        duplicate: true,
        message: `A project for YouTube video "${existingProject.name}" already exists.`,
        project: existingProject
      });
    }

    // Determine video source path (either uploaded file or local file path)
    let videoPath = '';
    let fileSize = 0;

    if (req.file) {
      videoPath = req.file.path;
      fileSize = req.file.size;
    } else if (req.body.file_path) {
      videoPath = path.resolve(req.body.file_path.trim());
      if (!fs.existsSync(videoPath)) {
        return res.status(400).json({
          success: false,
          error: `Authorized local video file not found at: ${videoPath}`
        });
      }
      const allowedExts = ['.mp4', '.mkv', '.mov', '.webm', '.avi'];
      const ext = path.extname(videoPath).toLowerCase();
      if (!allowedExts.includes(ext)) {
        return res.status(400).json({
          success: false,
          error: `Unsupported file type "${ext}". Allowed types: ${allowedExts.join(', ')}`
        });
      }
      const stat = fs.statSync(videoPath);
      fileSize = stat.size;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Please provide an authorized local video file (via file upload or local file path).'
      });
    }

    // Inspect video stream metadata with ffprobe
    let meta = { duration: 0, width: 0, height: 0, fps: 0, bitrate: 0 };
    try {
      meta = await probeVideo(videoPath);
    } catch (probeErr) {
      console.warn('ffprobe warning during YouTube video association:', probeErr);
    }

    const youtubeUrl = req.body.youtube_url?.trim() || `https://www.youtube.com/watch?v=${youtubeId}`;
    const projectName = req.body.title?.trim() || req.body.name?.trim() || `YouTube - ${youtubeId}`;
    const metadataJson = typeof req.body.metadata === 'string' 
      ? req.body.metadata 
      : JSON.stringify(req.body.metadata || {});

    const projectId = randomUUID();

    db.prepare(`
      INSERT INTO projects (
        id, name, source_type, source_path, duration, width, height, fps, file_size, status,
        youtube_id, youtube_url, metadata_json, created_at, updated_at
      ) VALUES (?, ?, 'youtube_assisted', ?, ?, ?, ?, ?, ?, 'created', ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      projectId,
      projectName,
      videoPath,
      meta.duration,
      meta.width,
      meta.height,
      meta.fps,
      fileSize,
      youtubeId,
      youtubeUrl,
      metadataJson
    );

    // Auto-enqueue AI analysis job if requested
    let jobId = null;
    const shouldAutoAnalyze = req.body.auto_analyze === 'true' || req.body.auto_analyze === true || req.body.auto_analyze === undefined;
    if (shouldAutoAnalyze) {
      jobId = await queue.enqueueJob(projectId, 'analysis');
    }

    return res.json({
      success: true,
      message: 'Authorized local video successfully associated with YouTube project.',
      project: {
        id: projectId,
        name: projectName,
        source_type: 'youtube_assisted',
        duration: meta.duration,
        file_size: fileSize,
        status: 'created',
        youtube_id: youtubeId,
        youtube_url: youtubeUrl
      },
      job_id: jobId
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to associate local video with YouTube video.'
    });
  }
});

// GET /api/videos/youtube/:id/status - Status check by YouTube ID or Project ID
router.get('/youtube/:id/status', (req: Request, res: Response) => {
  try {
    const paramId = req.params.id;
    const project = db.prepare(`
      SELECT * FROM projects 
      WHERE youtube_id = ? OR id = ?
      ORDER BY datetime(created_at) DESC 
      LIMIT 1
    `).get(paramId, paramId) as any;

    if (!project) {
      return res.json({
        success: true,
        associated: false,
        message: 'No project associated with this YouTube ID or project ID.'
      });
    }

    const latestJob = db.prepare(`
      SELECT * FROM jobs 
      WHERE project_id = ? 
      ORDER BY datetime(created_at) DESC 
      LIMIT 1
    `).get(project.id) as any;

    const clipsCount = (db.prepare('SELECT COUNT(*) as count FROM clips WHERE project_id = ?').get(project.id) as any)?.count || 0;
    const momentsCount = (db.prepare('SELECT COUNT(*) as count FROM candidate_moments WHERE project_id = ?').get(project.id) as any)?.count || 0;

    return res.json({
      success: true,
      associated: true,
      project: {
        id: project.id,
        name: project.name,
        source_type: project.source_type,
        source_path: project.source_path,
        duration: project.duration,
        width: project.width,
        height: project.height,
        fps: project.fps,
        file_size: project.file_size,
        status: project.status,
        youtube_id: project.youtube_id,
        youtube_url: project.youtube_url,
        created_at: project.created_at,
        updated_at: project.updated_at
      },
      job: latestJob ? {
        id: latestJob.id,
        status: latestJob.status,
        progress: latestJob.progress,
        current_step: latestJob.current_step,
        error_message: latestJob.error_message,
        started_at: latestJob.started_at,
        completed_at: latestJob.completed_at
      } : null,
      clips_count: clipsCount,
      moments_count: momentsCount
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to retrieve YouTube project status.'
    });
  }
});

export default router;

