import test from 'node:test';
import assert from 'node:assert';
import db from '../db/database.js';

test('Backend Health & API verification', () => {
  const projects = db.prepare('SELECT COUNT(*) as count FROM projects').get() as any;
  assert.strictEqual(typeof projects.count, 'number');

  const settings = db.prepare('SELECT value FROM settings WHERE key = ?').get('whisper_model') as any;
  assert.strictEqual(settings.value, 'base');

  const clips = db.prepare('SELECT COUNT(*) as count FROM clips').get() as any;
  assert.strictEqual(typeof clips.count, 'number');
});
