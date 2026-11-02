import test from 'node:test';
import assert from 'node:assert';
import db from '../db/database.js';

test('Database initialization and queries', () => {
  // Check settings table exists and has defaults
  const whisperModel = db.prepare('SELECT value FROM settings WHERE key = ?').get('whisper_model') as any;
  assert.ok(whisperModel, 'whisper_model setting should exist');
  assert.strictEqual(whisperModel.value, 'base');

  const ollamaModel = db.prepare('SELECT value FROM settings WHERE key = ?').get('ollama_model') as any;
  assert.ok(ollamaModel, 'ollama_model setting should exist');
  assert.strictEqual(ollamaModel.value, 'qwen2.5:1.5b');

  // Verify projects table works
  const testId = 'test_project_' + Date.now();
  db.prepare(`
    INSERT INTO projects (id, name, source_type, source_path, duration, width, height, fps, file_size, status)
    VALUES (?, 'Test Project', 'file', 'test.mp4', 10.0, 1920, 1080, 30.0, 1000, 'created')
  `).run(testId);

  const fetched = db.prepare('SELECT * FROM projects WHERE id = ?').get(testId) as any;
  assert.ok(fetched, 'Should fetch inserted project');
  assert.strictEqual(fetched.name, 'Test Project');

  // Cleanup
  db.prepare('DELETE FROM projects WHERE id = ?').run(testId);
  const deleted = db.prepare('SELECT * FROM projects WHERE id = ?').get(testId);
  assert.strictEqual(deleted, undefined, 'Project should be deleted');
});

