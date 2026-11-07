import test from 'node:test';
import assert from 'node:assert';
import { extractYouTubeVideoId, parseIsoDuration, formatDuration } from '../services/youtube.js';
import db from '../db/database.js';

test('YouTube URL extraction - all formats', () => {
  const watchUrl = extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.strictEqual(watchUrl, 'dQw4w9WgXcQ', 'Standard watch URL should extract video ID');

  const shortUrl = extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?t=15');
  assert.strictEqual(shortUrl, 'dQw4w9WgXcQ', 'youtu.be shortlink should extract video ID');

  const shortsUrl = extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ');
  assert.strictEqual(shortsUrl, 'dQw4w9WgXcQ', 'Shorts URL should extract video ID');

  const liveUrl = extractYouTubeVideoId('https://www.youtube.com/live/dQw4w9WgXcQ?feature=share');
  assert.strictEqual(liveUrl, 'dQw4w9WgXcQ', 'Live URL should extract video ID');

  const embedUrl = extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ');
  assert.strictEqual(embedUrl, 'dQw4w9WgXcQ', 'Embed URL should extract video ID');

  const rawId = extractYouTubeVideoId('dQw4w9WgXcQ');
  assert.strictEqual(rawId, 'dQw4w9WgXcQ', 'Raw 11-char ID should be accepted');

  const invalidUrl = extractYouTubeVideoId('https://vimeo.com/123456');
  assert.strictEqual(invalidUrl, null, 'Non-YouTube URL should return null');

  const empty = extractYouTubeVideoId('');
  assert.strictEqual(empty, null, 'Empty string should return null');
});

test('YouTube duration parsing and formatting', () => {
  assert.strictEqual(parseIsoDuration('PT1H2M30S'), 3750);
  assert.strictEqual(parseIsoDuration('PT45M'), 2700);
  assert.strictEqual(parseIsoDuration('PT30S'), 30);
  assert.strictEqual(parseIsoDuration('P1DT2H'), 93600);
  assert.strictEqual(parseIsoDuration('invalid'), 0);

  assert.strictEqual(formatDuration(3750), '1:02:30');
  assert.strictEqual(formatDuration(125), '02:05');
  assert.strictEqual(formatDuration(45), '00:45');
  assert.strictEqual(formatDuration(0), '00:00');
});

test('Database schema supports YouTube association fields and duplicate check', () => {
  const testYtId = 'test_yt_dup';
  const testProjId = 'test_proj_' + Date.now();

  // Test insert with YouTube fields
  db.prepare(`
    INSERT INTO projects (
      id, name, source_type, source_path, duration, width, height, fps, file_size, status,
      youtube_id, youtube_url, metadata_json
    ) VALUES (?, 'Test YouTube Project', 'youtube_assisted', 'temp.mp4', 60.0, 1920, 1080, 30.0, 5000, 'created', ?, ?, ?)
  `).run(testProjId, testYtId, 'https://www.youtube.com/watch?v=' + testYtId, JSON.stringify({ title: 'Test Video' }));

  // Query by youtube_id (duplicate detection)
  const existing = db.prepare('SELECT * FROM projects WHERE youtube_id = ?').get(testYtId) as any;
  assert.ok(existing, 'Should find project by youtube_id');
  assert.strictEqual(existing.youtube_id, testYtId);
  assert.strictEqual(existing.source_type, 'youtube_assisted');

  // Cleanup
  db.prepare('DELETE FROM projects WHERE id = ?').run(testProjId);
  const deleted = db.prepare('SELECT * FROM projects WHERE id = ?').get(testProjId);
  assert.strictEqual(deleted, undefined);
});

