import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import db from '../db/database.js';
import { probeVideo } from '../services/ffmpeg.js';
import { queue } from '../services/queue.js';

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

// GET /api/projects - list all projects
router.get('/', (_req: Request, res: Response) => {
  try {
    const projects = db.prepare(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM clips WHERE project_id = p.id) as clips_count,
        (SELECT COUNT(*) FROM candidate_moments WHERE project_id = p.id) as moments_count,
        (SELECT id FROM jobs WHERE project_id = p.id ORDER BY datetime(created_at) DESC LIMIT 1) as latest_job_id,
        (SELECT status FROM jobs WHERE project_id = p.id ORDER BY datetime(created_at) DESC LIMIT 1) as latest_job_status,
        (SELECT progress FROM jobs WHERE project_id = p.id ORDER BY datetime(created_at) DESC LIMIT 1) as latest_job_progress,
        (SELECT current_step FROM jobs WHERE project_id = p.id ORDER BY datetime(created_at) DESC LIMIT 1) as latest_job_step
      FROM projects p
      ORDER BY datetime(p.created_at) DESC
    `).all();
    res.json({ success: true, projects });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/upload - Upload file and create project
router.post('/upload', upload.single('video'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video file provided' });
    }

    const name = req.body.name || path.basename(req.file.originalname, path.extname(req.file.originalname));
    const filePath = req.file.path;
    const projectId = randomUUID();

    let meta = { duration: 0, width: 0, height: 0, fps: 0, bitrate: 0 };
    try {
      meta = await probeVideo(filePath);
    } catch (e) {
      console.warn('Could not probe uploaded video:', e);
    }

    db.prepare(`
      INSERT INTO projects (id, name, source_type, source_path, duration, width, height, fps, file_size, status, created_at, updated_at)
      VALUES (?, ?, 'file', ?, ?, ?, ?, ?, ?, 'created', datetime('now'), datetime('now'))
    `).run(
      projectId,
      name,
      filePath,
      meta.duration,
      meta.width,
      meta.height,
      meta.fps,
      req.file.size
    );

    // Auto-enqueue analysis if requested
    let jobId = null;
    if (req.body.auto_analyze === 'true' || req.body.auto_analyze === true) {
      jobId = await queue.enqueueJob(projectId, 'analysis');
    }

    res.json({
      success: true,
      project: { id: projectId, name, duration: meta.duration, status: 'created' },
      job_id: jobId,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/local - Import an existing local video path
router.post('/local', async (req: Request, res: Response) => {
  try {
    const { file_path, name } = req.body;
    if (!file_path || !fs.existsSync(file_path)) {
      return res.status(400).json({ success: false, error: 'Invalid or non-existent local file path' });
    }

    const projectName = name || path.basename(file_path, path.extname(file_path));
    const projectId = randomUUID();
    const stats = fs.statSync(file_path);

    const meta = await probeVideo(file_path);

    db.prepare(`
      INSERT INTO projects (id, name, source_type, source_path, duration, width, height, fps, file_size, status, created_at, updated_at)
      VALUES (?, ?, 'file', ?, ?, ?, ?, ?, ?, 'created', datetime('now'), datetime('now'))
    `).run(
      projectId,
      projectName,
      file_path,
      meta.duration,
      meta.width,
      meta.height,
      meta.fps,
      stats.size
    );

    let jobId = null;
    if (req.body.auto_analyze) {
      jobId = await queue.enqueueJob(projectId, 'analysis');
    }

    res.json({
      success: true,
      project: { id: projectId, name: projectName, duration: meta.duration },
      job_id: jobId,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/url - Validate YouTube URL and advise on local download
router.post('/url', async (req: Request, res: Response) => {
  try {
    const { url, name } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' });
    }

    // In compliance with section 4:
    // Do not bypass DRM or platform restrictions.
    // Validate YouTube URL structure and provide helpful streamer workflow instruction.
    const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!ytRegex.test(url)) {
      return res.status(400).json({ success: false, error: 'Invalid URL. Please enter a valid YouTube or streamer link.' });
    }

    res.json({
      success: true,
      requires_local_file: true,
      message: 'URL recognized. In accordance with platform terms and copyright compliance, please use your streamer recording or download the authorized video file locally, then import it via the Local File tab for complete AI moment detection.',
      suggested_name: name || 'Authorized Stream Recording'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/projects/:id/clips - Get all clips for project
router.get('/:id/clips', (req: Request, res: Response) => {
  try {
    const clips = db.prepare('SELECT * FROM clips WHERE project_id = ? ORDER BY datetime(created_at) DESC').all(req.params.id);
    res.json({ success: true, clips });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/projects/:id - Project details with moments, clips, transcript, jobs
router.get('/:id', (req: Request, res: Response) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any;
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    const transcriptRow = db.prepare('SELECT * FROM transcripts WHERE project_id = ?').get(req.params.id) as any;
    const transcript = transcriptRow
      ? { ...transcriptRow, segments: JSON.parse(transcriptRow.segments_json || '[]') }
      : null;

    const moments = db.prepare('SELECT * FROM candidate_moments WHERE project_id = ? ORDER BY score DESC').all(req.params.id);
    const clips = db.prepare('SELECT * FROM clips WHERE project_id = ? ORDER BY datetime(created_at) DESC').all(req.params.id);
    const jobs = db.prepare('SELECT * FROM jobs WHERE project_id = ? ORDER BY datetime(created_at) DESC').all(req.params.id);

    res.json({
      success: true,
      project,
      transcript,
      moments,
      clips,
      jobs,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:id/analyze - Trigger analysis
router.post('/:id/analyze', async (req: Request, res: Response) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    const jobId = await queue.enqueueJob(req.params.id, 'analysis');
    res.json({ success: true, job_id: jobId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/projects/:id - Delete project and related data
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as any;
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    // Delete records
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);

    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

