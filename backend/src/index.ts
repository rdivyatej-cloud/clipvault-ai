import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';

import projectsRouter from './routes/projects.js';
import jobsRouter from './routes/jobs.js';
import clipsRouter from './routes/clips.js';
import settingsRouter from './routes/settings.js';
import mediaRouter from './routes/media.js';
import systemRouter from './routes/system.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/projects', projectsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/clips', clipsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/system', systemRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    service: 'clipvault-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend static build if exists
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

// Catch-all for React SPA routing
app.get('*', (_req, res, next) => {
  if (_req.path.startsWith('/api')) return next();
  const indexHtml = path.join(frontendDist, 'index.html');
  res.sendFile(indexHtml, (err) => {
    if (err) next();
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🎬 CLIPVAULT AI Backend listening on port ${PORT}`);
  console.log(`   Local URL: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
