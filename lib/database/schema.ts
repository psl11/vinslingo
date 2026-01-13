// SQLite Local Database Schema
// This schema mirrors the Supabase tables for offline-first functionality

export const LOCAL_SCHEMA = `
  -- Vocabulario (cache de servidor, read-only local)
  CREATE TABLE IF NOT EXISTS vocabulary (
    id TEXT PRIMARY KEY,
    word TEXT NOT NULL,
    translation TEXT NOT NULL,
    pronunciation TEXT,
    audio_url TEXT,
    part_of_speech TEXT,
    cefr_level TEXT NOT NULL,
    category TEXT,
    frequency_rank INTEGER,
    example_sentence TEXT,
    example_translation TEXT,
    synced_at INTEGER
  );

  -- Índices para vocabulario
  CREATE INDEX IF NOT EXISTS idx_vocab_cefr ON vocabulary(cefr_level);
  CREATE INDEX IF NOT EXISTS idx_vocab_category ON vocabulary(category);
  CREATE INDEX IF NOT EXISTS idx_vocab_rank ON vocabulary(frequency_rank);

  -- Progreso del usuario por palabra (sync bidireccional)
  CREATE TABLE IF NOT EXISTS user_vocabulary (
    id TEXT PRIMARY KEY,
    vocabulary_id TEXT NOT NULL,
    ease_factor REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 0,
    repetitions INTEGER DEFAULT 0,
    next_review_at INTEGER,
    last_reviewed_at INTEGER,
    times_correct INTEGER DEFAULT 0,
    times_incorrect INTEGER DEFAULT 0,
    mastery_level INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    needs_sync INTEGER DEFAULT 0,
    FOREIGN KEY (vocabulary_id) REFERENCES vocabulary(id)
  );

  -- Índices para user_vocabulary
  CREATE INDEX IF NOT EXISTS idx_user_vocab_review ON user_vocabulary(next_review_at);
  CREATE INDEX IF NOT EXISTS idx_user_vocab_mastery ON user_vocabulary(mastery_level);
  CREATE INDEX IF NOT EXISTS idx_user_vocab_sync ON user_vocabulary(needs_sync);

  -- Lecciones (cache de servidor)
  CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    cefr_level TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    category TEXT,
    estimated_minutes INTEGER DEFAULT 10,
    xp_reward INTEGER DEFAULT 10,
    is_active INTEGER DEFAULT 1,
    synced_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_lessons_level ON lessons(cefr_level, order_index);

  -- Progreso del usuario por lección (sync bidireccional)
  CREATE TABLE IF NOT EXISTS user_lessons (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL,
    status TEXT DEFAULT 'locked',
    progress_percent INTEGER DEFAULT 0,
    completed_at INTEGER,
    best_score INTEGER,
    attempts INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    needs_sync INTEGER DEFAULT 0,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
  );

  -- Sesiones de estudio (sync bidireccional)
  CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY,
    session_type TEXT NOT NULL,
    started_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    ended_at INTEGER,
    duration_seconds INTEGER,
    cards_studied INTEGER DEFAULT 0,
    cards_correct INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    lesson_id TEXT,
    needs_sync INTEGER DEFAULT 0,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
  );

  -- Cola de sincronización
  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    synced_at INTEGER,
    retry_count INTEGER DEFAULT 0,
    last_error TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(synced_at) WHERE synced_at IS NULL;

  -- Metadata de sincronización
  CREATE TABLE IF NOT EXISTS sync_metadata (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
  );

  -- Configuración local del usuario
  CREATE TABLE IF NOT EXISTS local_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`;

// Queries para inicialización
export const INIT_QUERIES = {
  // Insertar metadata inicial
  initSyncMetadata: `
    INSERT OR IGNORE INTO sync_metadata (key, value) VALUES 
    ('last_vocab_sync', '0'),
    ('last_lessons_sync', '0'),
    ('last_full_sync', '0');
  `,
  
  // Insertar configuración por defecto
  initSettings: `
    INSERT OR IGNORE INTO local_settings (key, value) VALUES 
    ('daily_goal_minutes', '10'),
    ('notifications_enabled', 'true'),
    ('sound_enabled', 'true'),
    ('haptics_enabled', 'true'),
    ('dark_mode', 'system'),
    ('cards_per_session', '20');
  `,
};
