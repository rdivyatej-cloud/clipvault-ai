import { Router, Request, Response } from 'express';
import db from '../db/database.js';
import { queue, queueEvents } from '../services/queue.js';

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

// GET /api/jobs/:id/events - Server-Sent Events (SSE) live progress updates
router.get('/:id/events', (req: Request, res: Response) => {
  const jobId = req.params.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send current initial state
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (job) {
    res.write(`data: ${JSON.stringify(job)}\n\n`);
  }

  const listener = (data: any) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
        res.end();
      }
    } catch {
      // Stream closed
    }
  };

  queueEvents.on(`job:${jobId}`, listener);

  req.on('close', () => {
    queueEvents.off(`job:${jobId}`, listener);
  });
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

// POST /api/jobs/:id/cancel - cancel a queued or active job
router.post('/:id/cancel', (req: Request, res: Response) => {
  try {
    const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id) as any;
    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    if (job.status === 'completed') {
      return res.status(400).json({ success: false, error: 'Completed jobs cannot be cancelled' });
    }

    const cancelled = queue.cancelJob(req.params.id);
    if (cancelled) {
      return res.json({ success: true, message: 'Job cancelled successfully' });
    }

    res.status(400).json({ success: false, error: 'Could not cancel job' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;


