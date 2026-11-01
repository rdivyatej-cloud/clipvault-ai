import { Router, Request, Response } from 'express';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import db from '../db/database.js';
import { checkAiEngineHealth } from '../services/aiClient.js';

const router = Router();
const outputDir = path.resolve(__dirname, '../../../output');

// GET /api/system/stats - Dashboard summary metrics
router.get('/stats', (_req: Request, res: Response) => {
  try {
    const totalProjects = (db.prepare('SELECT COUNT(*) as count FROM projects').get() as any).count;
    const totalClips = (db.prepare('SELECT COUNT(*) as count FROM clips').get() as any).count;
    const totalApproved = (db.prepare("SELECT COUNT(*) as count FROM clips WHERE status = 'approved'").get() as any).count;
    const queuedJobs = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'queued'").get() as any).count;
    const processingJobs = (db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status = 'processing'").get() as any).count;
    const recentProjects = db.prepare('SELECT * FROM projects ORDER BY datetime(created_at) DESC LIMIT 5').all();
    const recentClips = db.prepare(`
      SELECT c.*, p.name as project_name 
      FROM clips c 
      LEFT JOIN projects p ON c.project_id = p.id 
      ORDER BY datetime(c.created_at) DESC LIMIT 6
    `).all();

    res.json({
      success: true,
      stats: {
        total_projects: totalProjects,
        total_clips: totalClips,
        total_approved: totalApproved,
        queued_jobs: queuedJobs,
        processing_jobs: processingJobs,
      },
      recent_projects: recentProjects,
      recent_clips: recentClips,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/system/diagnostics - Deep health inspection
router.get('/diagnostics', async (_req: Request, res: Response) => {
  try {
    const aiHealth = await checkAiEngineHealth();
    res.json({
      success: true,
      system: {
        os: 'Windows 11',
        node_version: process.version,
        cpu: 'Intel Core i5-11320H (4 Cores / 8 Threads)',
        memory: '16 GB RAM',
        graphics: 'Intel Iris Xe Graphics (CPU-first execution)',
        storage: '477 GB SSD'
      },
      ai_engine: aiHealth,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/system/open-output - Open output folder in Windows Explorer
router.post('/open-output', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    // Launch Windows explorer.exe on the directory
    spawn('explorer.exe', [outputDir], { detached: true, stdio: 'ignore' });
    res.json({ success: true, message: 'Opened output folder in Windows Explorer', path: outputDir });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
