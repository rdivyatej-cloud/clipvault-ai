import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import db from '../db/database.js';
import { ingestionManager } from '../services/ingestion/ingestionManager.js';
import { localFileAdapter } from '../services/ingestion/sourceRegistry.js';
import { queue } from '../services/queue.js';
import { probeVideo } from '../services/ffmpeg.js';

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

// POST /api/ingestion/verify - Unified source verification
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { input, url } = req.body;
    const targetInput = (input || url || '').trim();

    if (!targetInput) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid video URL or local file path.',
      });
    }

    const result = await ingestionManager.verifySource(targetInput);
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Source verification failed',
    });
  }
});

// POST /api/ingestion/direct-url - Stream and ingest authorized direct media URL
router.post('/direct-url', async (req: Request, res: Response) => {
  try {
    const { url, name, auto_analyze = true, force = false } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'A direct media URL is required.',
      });
    }

    const result = await ingestionManager.ingestDirectUrl({
      url,
      name,
      auto_analyze: auto_analyze === true || auto_analyze === 'true',
      force: force === true || force === 'force',
    });

    if (!result.success && result.project) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        message: result.message,
        project: result.project,
      });
    }

    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Direct media URL ingestion failed',
    });
  }
});

// POST /api/ingestion/local-file - Ingest uploaded or local file
router.post('/local-file', upload.single('video'), async (req: Request, res: Response) => {
  try {
    let filePath = '';
    let fileSize = 0;
    let fileName = '';

    if (req.file) {
      filePath = req.file.path;
      fileSize = req.file.size;
      fileName = req.file.originalname;
    } else if (req.body.file_path) {
      const inspectRes = await localFileAdapter.inspectLocalPath(req.body.file_path);
      if (!inspectRes.valid || !inspectRes.filePath) {
        return res.status(400).json({ success: false, error: inspectRes.error });
      }
      filePath = inspectRes.filePath;
      fileSize = inspectRes.fileSize || 0;
      fileName = inspectRes.filename || path.basename(filePath);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Please provide a file upload or valid local file path.',
      });
    }

    const meta = await probeVideo(filePath);
    const projectName = req.body.name?.trim() || fileName.replace(/\.[^/.]+$/, '');
    const projectId = randomUUID();

    db.prepare(`
      INSERT INTO projects (
        id, name, source_type, source_path, local_media_path,
        duration, width, height, fps, file_size, status, created_at, updated_at
      ) VALUES (?, ?, 'local_file', ?, ?, ?, ?, ?, ?, ?, 'created', datetime('now'), datetime('now'))
    `).run(
      projectId,
      projectName,
      filePath,
      filePath,
      meta.duration,
      meta.width,
      meta.height,
      meta.fps,
      fileSize
    );

    let jobId: string | null = null;
    const shouldAutoAnalyze = req.body.auto_analyze === true || req.body.auto_analyze === 'true' || req.body.auto_analyze === undefined;
    if (shouldAutoAnalyze) {
      jobId = await queue.enqueueJob(projectId, 'analysis');
    }

    return res.json({
      success: true,
      project: {
        id: projectId,
        name: projectName,
        duration: meta.duration,
        file_size: fileSize,
        status: 'created',
      },
      job_id: jobId,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Local file ingestion failed',
    });
  }
});

export default router;
