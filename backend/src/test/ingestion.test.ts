import test from 'node:test';
import assert from 'node:assert';
import { detectSourceType } from '../services/ingestion/sourceDetector.js';
import { isPrivateOrReservedIp, validateDirectMediaUrl } from '../services/ingestion/sourceValidator.js';
import { directMediaAdapter } from '../services/ingestion/sourceRegistry.js';
import { queue } from '../services/queue.js';
import db from '../db/database.js';

test('Ingestion - Source Type Detection', () => {
  assert.strictEqual(detectSourceType('https://www.youtube.com/watch?v=dQw4w9WgXcQ').sourceType, 'youtube');
  assert.strictEqual(detectSourceType('https://youtu.be/dQw4w9WgXcQ').sourceType, 'youtube');
  assert.strictEqual(detectSourceType('https://www.youtube.com/shorts/dQw4w9WgXcQ').sourceType, 'youtube');
  assert.strictEqual(detectSourceType('https://cdn.example.com/stream/vod.mp4').sourceType, 'direct_media');
  assert.strictEqual(detectSourceType('https://domain.com/video.webm?token=123').sourceType, 'direct_media');
  assert.strictEqual(detectSourceType('C:\\Videos\\recording.mp4').sourceType, 'local_file');
  assert.strictEqual(detectSourceType('random text').sourceType, 'unknown');
});

test('Ingestion - SSRF IP Protection', () => {
  // Loopback & local
  assert.strictEqual(isPrivateOrReservedIp('127.0.0.1'), true);
  assert.strictEqual(isPrivateOrReservedIp('127.0.1.5'), true);
  assert.strictEqual(isPrivateOrReservedIp('::1'), true);

  // Private IPv4 ranges
  assert.strictEqual(isPrivateOrReservedIp('10.0.0.1'), true);
  assert.strictEqual(isPrivateOrReservedIp('10.255.255.255'), true);
  assert.strictEqual(isPrivateOrReservedIp('172.16.0.1'), true);
  assert.strictEqual(isPrivateOrReservedIp('172.25.10.2'), true);
  assert.strictEqual(isPrivateOrReservedIp('172.31.255.255'), true);
  assert.strictEqual(isPrivateOrReservedIp('192.168.1.1'), true);
  assert.strictEqual(isPrivateOrReservedIp('192.168.0.254'), true);

  // Link-local & cloud metadata service
  assert.strictEqual(isPrivateOrReservedIp('169.254.169.254'), true);
  assert.strictEqual(isPrivateOrReservedIp('0.0.0.0'), true);

  // Public valid IPs
  assert.strictEqual(isPrivateOrReservedIp('8.8.8.8'), false);
  assert.strictEqual(isPrivateOrReservedIp('1.1.1.1'), false);
  assert.strictEqual(isPrivateOrReservedIp('142.250.190.46'), false);
});

test('Ingestion - SSRF Direct URL Validation', async () => {
  // Protocol rejection
  const fileProto = await validateDirectMediaUrl('file:///C:/Windows/win.ini');
  assert.strictEqual(fileProto.valid, false);

  const ftpProto = await validateDirectMediaUrl('ftp://example.com/video.mp4');
  assert.strictEqual(ftpProto.valid, false);

  // Localhost rejection
  const localUrl = await validateDirectMediaUrl('http://localhost/video.mp4');
  assert.strictEqual(localUrl.valid, false);

  const loopbackUrl = await validateDirectMediaUrl('http://127.0.0.1:8000/video.mp4');
  assert.strictEqual(loopbackUrl.valid, false);
});

test('Ingestion - Filename sanitization', () => {
  const sanitized1 = directMediaAdapter.sanitizeFilename('../../../etc/passwd.mp4');
  assert.strictEqual(sanitized1.includes('..'), false);
  assert.strictEqual(sanitized1.includes('/'), false);

  const sanitized2 = directMediaAdapter.sanitizeFilename('kai cenat: 24h stream? *wow*.mp4');
  assert.strictEqual(/[:*?"<>|]/.test(sanitized2), false);
});

test('Ingestion - Job Cancellation and Recovery', async () => {
  // Create dummy project & queued job
  const testProjId = 'cancel_test_proj_' + Date.now();
  db.prepare(`
    INSERT INTO projects (id, name, source_type, source_path, duration, width, height, fps, file_size, status)
    VALUES (?, 'Cancel Test', 'test', 'none.mp4', 10, 1920, 1080, 30, 100, 'created')
  `).run(testProjId);

  const jobId = await queue.enqueueJob(testProjId, 'analysis');
  assert.ok(jobId, 'Job should be enqueued');

  const cancelled = queue.cancelJob(jobId);
  assert.strictEqual(cancelled, true, 'Job should be successfully cancelled');

  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
  assert.strictEqual(job.status, 'cancelled');

  // Cleanup
  db.prepare('DELETE FROM jobs WHERE id = ?').run(jobId);
  db.prepare('DELETE FROM projects WHERE id = ?').run(testProjId);
});

