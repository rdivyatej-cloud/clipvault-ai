import { Router, Request, Response } from 'express';
import db from '../db/database.js';
import { queue } from '../services/queue.js';

const router = Router();

// GET /api/jobs - list all processing jobs
router.get('/', (_req: Request, res: Response) => {
  try {
    const jobs = db.prepare(`
      SELECT j.*, p.name as project_name 
      FROM jobs j
      LEFT JOIN projects p ON j.project_id = p.id
      ORDER BY datetime(j.created_at) DESC
      LIMIT 100
    `).all();
    res.json({ success: true, jobs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/jobs/:id - single job details
router.get('/:id', (req: Request, res: Response) => {
  try {
    const job = db.prepare(`
      SELECT j.*, p.name as project_name 
      FROM jobs j
      LEFT JOIN projects p ON j.project_id = p.id
      WHERE j.id = ?
    `).get(req.params.id);

    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, job });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/jobs/:id/retry - retry a failed job
router.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id) as any;
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    const newJobId = await queue.enqueueJob(job.project_id, job.type, job.clip_id);
    res.json({ success: true, new_job_id: newJobId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/jobs/:id/cancel - cancel a queued job
router.post('/:id/cancel', (req: Request, res: Response) => {
  try {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id) as any;
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    if (job.status === 'queued') {
      db.prepare("UPDATE jobs SET status = 'cancelled' WHERE id = ?").run(req.params.id);
      return res.json({ success: true, message: 'Job cancelled' });
    }

    res.status(400).json({ success: false, error: 'Only queued jobs can be cancelled' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

