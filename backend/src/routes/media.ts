import { Router, Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';

const router = Router();
const storageDir = path.resolve(__dirname, '../../../storage');
const outputDir = path.resolve(__dirname, '../../../output');

// Stream video with HTTP 206 Partial Content support
router.get('/stream/:type/:filename', (req: Request, res: Response) => {
  const { type, filename } = req.params;
  const baseDir = type === 'source' ? storageDir : outputDir;
  const filePath = path.join(baseDir, path.basename(filename));

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
      return;
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Serve thumbnail image
router.get('/thumbnail/:filename', (req: Request, res: Response) => {
  const filePath = path.join(outputDir, path.basename(req.params.filename));
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Thumbnail not found');
  }
  res.sendFile(filePath);
});

// Direct file download attachment
router.get('/download/:filename', (req: Request, res: Response) => {
  const filePath = path.join(outputDir, path.basename(req.params.filename));
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  res.download(filePath, req.params.filename);
});

export default router;

