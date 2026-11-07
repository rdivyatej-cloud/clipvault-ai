import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = path.resolve(__dirname, '../../../database');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'clipvault.db');
const db = new DatabaseSync(DB_PATH);

// Run WAL mode & pragmas
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
`);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_path TEXT NOT NULL,
    duration REAL DEFAULT 0,
    width INTEGER DEFAULT 0,
    height INTEGER DEFAULT 0,
    fps REAL DEFAULT 0,
    file_size INTEGER DEFAULT 0,
    status TEXT DEFAULT 'created',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transcripts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    language TEXT DEFAULT 'en',
    full_text TEXT,
    segments_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS candidate_moments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    start_time REAL NOT NULL,
    end_time REAL NOT NULL,
    duration REAL NOT NULL,
    score REAL NOT NULL,
    hook_strength REAL DEFAULT 0,
    audio_intensity REAL DEFAULT 0,
    visual_activity REAL DEFAULT 0,
    semantic_score REAL DEFAULT 0,
    explanation TEXT,
    transcript_excerpt TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS clips (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    moment_id TEXT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    start_time REAL NOT NULL,
    end_time REAL NOT NULL,
    duration REAL NOT NULL,
    video_path TEXT,
    thumbnail_path TEXT,
    file_size INTEGER DEFAULT 0,
    status TEXT DEFAULT 'rendered',
    subtitle_style TEXT DEFAULT 'red_highlight',
    aspect_ratio TEXT DEFAULT '9:16',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    progress REAL DEFAULT 0,
    current_step TEXT DEFAULT '',
    clip_id TEXT,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Safe migrations for YouTube assisted and direct URL import
try {
  db.exec(`ALTER TABLE projects ADD COLUMN youtube_id TEXT;`);
} catch {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN youtube_url TEXT;`);
} catch {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN metadata_json TEXT;`);
} catch {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN source_url TEXT;`);
} catch {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN source_id TEXT;`);
} catch {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN source_metadata TEXT;`);
} catch {}
try {
  db.exec(`ALTER TABLE projects ADD COLUMN local_media_path TEXT;`);
} catch {}

// Safe migrations for jobs
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN current_stage TEXT;`);
} catch {}
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN stage_details TEXT;`);
} catch {}
try {
  db.exec(`ALTER TABLE jobs ADD COLUMN updated_at TEXT;`);
} catch {}

// Safe migrations for moments
try {
  db.exec(`ALTER TABLE candidate_moments ADD COLUMN scoring_json TEXT;`);
} catch {}

// Insert default settings if not exists
const defaultSettings: Record<string, string> = {
  'whisper_model': 'base',
  'ollama_url': 'http://localhost:11434',
  'ollama_model': 'qwen2.5:1.5b',
  'default_clip_min_duration': '25',
  'default_clip_max_duration': '55',
  'target_aspect_ratio': '9:16',
  'subtitle_style': 'red_highlight',
  'audio_normalization': 'true',
  'auto_generate_clips_count': '3',
  'framing_mode': 'blur_pillarbox'
};

for (const [key, value] of Object.entries(defaultSettings)) {
  const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  if (!existing) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
  }
}

export default db;

