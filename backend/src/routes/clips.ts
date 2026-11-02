import { Router, Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import db from '../db/database.js';
import { queue } from '../services/queue.js';

const router = Router();
const outputDir = path.resolve(__dirname, '../../../output');

// GET /api/clips - list all generated clips
router.get('/', (req: Request, res: Response) => {
  try {
    const { status, category, project_id } = req.query;
    let query = `
      SELECT c.*, p.name as project_name 
      FROM clips c
      LEFT JOIN projects p ON c.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }
    if (category) {
      query += ' AND c.category = ?';
      params.push(category);
    }
    if (project_id) {
      query += ' AND c.project_id = ?';
      params.push(project_id);
    }

    query += ' ORDER BY datetime(c.created_at) DESC';

    const clips = db.prepare(query).all(...params);
    res.json({ success: true, clips });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/clips/:id - single clip
router.get('/:id', (req: Request, res: Response) => {
  try {
    const clip = db.prepare(`
      SELECT c.*, p.name as project_name, p.source_path 
      FROM clips c
      LEFT JOIN projects p ON c.project_id = p.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!clip) return res.status(404).json({ success: false, error: 'Clip not found' });
    res.json({ success: true, clip });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/clips/from-moment - create and render a clip from a candidate moment
router.post('/from-moment', async (req: Request, res: Response) => {
  try {
    const { moment_id, project_id, subtitle_style } = req.body;
    const moment = db.prepare('SELECT * FROM candidate_moments WHERE id = ?').get(moment_id) as any;
    if (!moment) return res.status(404).json({ success: false, error: 'Moment not found' });

    const clipId = randomUUID();
    db.prepare(`
      INSERT INTO clips (
        id, project_id, moment_id, title, category, start_time, end_time,
        duration, video_path, thumbnail_path, file_size, status, subtitle_style, aspect_ratio, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, null, null, 0, 'rendering', ?, '9:16', datetime('now'))
    `).run(
      clipId,
      project_id || moment.project_id,
      moment.id,
      moment.title,
      moment.category,
      moment.start_time,
      moment.end_time,
      moment.duration,
      subtitle_style || 'red_highlight'
    );

    const jobId = await queue.enqueueJob(project_id || moment.project_id, 'render_clip', clipId);
    res.json({ success: true, clip_id: clipId, job_id: jobId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/clips/:id - update clip title, status (approved/rejected), category
router.patch('/:id', (req: Request, res: Response) => {
  try {
    const { title, category, status, subtitle_style, start_time, end_time } = req.body;
    const clip = db.prepare('SELECT * FROM clips WHERE id = ?').get(req.params.id) as any;
    if (!clip) return res.status(404).json({ success: false, error: 'Clip not found' });

    let duration = clip.duration;
    if (start_time !== undefined && end_time !== undefined) {
      duration = Math.max(1, end_time - start_time);
    }

    db.prepare(`
      UPDATE clips 
      SET title = COALESCE(?, title),
          category = COALESCE(?, category),
          status = COALESCE(?, status),
          subtitle_style = COALESCE(?, subtitle_style),
          start_time = COALESCE(?, start_time),
          end_time = COALESCE(?, end_time),
          duration = ?
      WHERE id = ?
    `).run(
      title,
      category,
      status,
      subtitle_style,
      start_time,
      end_time,
      duration,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM clips WHERE id = ?').get(req.params.id);
    res.json({ success: true, clip: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/clips/:id/render - trigger re-render
router.post('/:id/render', async (req: Request, res: Response) => {
  try {
    const clip = db.prepare('SELECT * FROM clips WHERE id = ?').get(req.params.id) as any;
    if (!clip) return res.status(404).json({ success: false, error: 'Clip not found' });

    db.prepare("UPDATE clips SET status = 'rendering' WHERE id = ?").run(req.params.id);
    const jobId = await queue.enqueueJob(clip.project_id, 'render_clip', req.params.id);

    res.json({ success: true, job_id: jobId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/clips/:id - delete clip and file
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const clip = db.prepare('SELECT * FROM clips WHERE id = ?').get(req.params.id) as any;
    if (!clip) return res.status(404).json({ success: false, error: 'Clip not found' });

    if (clip.video_path) {
      const vPath = path.join(outputDir, clip.video_path);
      if (fs.existsSync(vPath)) fs.unlinkSync(vPath);
    }
    if (clip.thumbnail_path) {
      const tPath = path.join(outputDir, clip.thumbnail_path);
      if (fs.existsSync(tPath)) fs.unlinkSync(tPath);
    }

    db.prepare('DELETE FROM clips WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Clip deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

