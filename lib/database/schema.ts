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
    example_sentence_2 TEXT,
    example_translation_2 TEXT,
    song_lyric TEXT,
    song_lyric_translation TEXT,
    song_title TEXT,
    song_artist TEXT,
    anchor_type TEXT,
    anchor_year INTEGER,
    formal_synonym TEXT,
    separability TEXT,
    updated_at INTEGER,
    synced_at INTEGER
  );

  -- Índices para vocabulario
  CREATE INDEX IF NOT EXISTS idx_vocab_cefr ON vocabulary(cefr_level);
  CREATE INDEX IF NOT EXISTS idx_vocab_category ON vocabulary(category);
  CREATE INDEX IF NOT EXISTS idx_vocab_rank ON vocabulary(frequency_rank);

  -- Progreso del usuario por palabra (sync bidireccional)
  -- Columnas SM-2 (ease_factor, interval_days, repetitions, next_review_at) y
  -- columnas FSRS (stability..due) conviven durante la migración; ver
  -- docs/fsrs-migration.md. Las SM-2 sin equivalente se retiran en el paso 8.
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
    -- Estado FSRS (ver lib/srs/fsrs.ts -> PersistedFsrsState)
    stability REAL DEFAULT 0,
    difficulty REAL DEFAULT 0,
    elapsed_days INTEGER DEFAULT 0,
    scheduled_days INTEGER DEFAULT 0,
    learning_steps INTEGER DEFAULT 0,
    reps INTEGER DEFAULT 0,
    lapses INTEGER DEFAULT 0,
    fsrs_state INTEGER DEFAULT 0,
    due INTEGER,
    last_review INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    needs_sync INTEGER DEFAULT 0,
    FOREIGN KEY (vocabulary_id) REFERENCES vocabulary(id)
  );

  -- Índices para user_vocabulary
  CREATE INDEX IF NOT EXISTS idx_user_vocab_review ON user_vocabulary(next_review_at);
  CREATE INDEX IF NOT EXISTS idx_user_vocab_mastery ON user_vocabulary(mastery_level);
  CREATE INDEX IF NOT EXISTS idx_user_vocab_sync ON user_vocabulary(needs_sync);
  CREATE INDEX IF NOT EXISTS idx_user_vocab_due ON user_vocabulary(due);

  -- Log de repasos FSRS (append-only). Base para optimizar los parámetros del
  -- algoritmo en el futuro (ver docs/fsrs-migration.md). Dato de usuario.
  CREATE TABLE IF NOT EXISTS review_log (
    id TEXT PRIMARY KEY,
    vocabulary_id TEXT NOT NULL,
    rating INTEGER NOT NULL,          -- grado FSRS 1-4 (Again/Hard/Good/Easy)
    state INTEGER NOT NULL,           -- estado PREVIO al repaso (0-3)
    due INTEGER,                      -- due previo (epoch ms)
    stability REAL,
    difficulty REAL,
    elapsed_days INTEGER,
    scheduled_days INTEGER,
    review INTEGER NOT NULL,          -- timestamp del repaso (epoch ms)
    review_duration_ms INTEGER,       -- responseTimeMs, nullable
    needs_sync INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (vocabulary_id) REFERENCES vocabulary(id)
  );

  CREATE INDEX IF NOT EXISTS idx_review_log_vocab ON review_log(vocabulary_id);
  CREATE INDEX IF NOT EXISTS idx_review_log_sync ON review_log(needs_sync);

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

  -- Ejercicios de rellenar huecos (local, no synced)
  CREATE TABLE IF NOT EXISTS gap_fill_exercises (
    id TEXT PRIMARY KEY,
    sentence TEXT NOT NULL,
    answer TEXT NOT NULL,
    options TEXT,
    explanation TEXT,
    explanation_es TEXT,
    cefr_level TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'connector',
    difficulty INTEGER DEFAULT 1,
    source TEXT DEFAULT 'cambridge',
    base_word TEXT,
    context_sentence TEXT,
    is_official INTEGER DEFAULT 0,
    answer_es TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_gap_fill_category ON gap_fill_exercises(category);
  CREATE INDEX IF NOT EXISTS idx_gap_fill_level ON gap_fill_exercises(cefr_level);

  -- Progreso del usuario en ejercicios gap-fill
  CREATE TABLE IF NOT EXISTS user_gap_fill (
    id TEXT PRIMARY KEY,
    exercise_id TEXT NOT NULL,
    times_correct INTEGER DEFAULT 0,
    times_incorrect INTEGER DEFAULT 0,
    last_attempted_at INTEGER,
    FOREIGN KEY (exercise_id) REFERENCES gap_fill_exercises(id)
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

  -- "Aprende con tu música": espejo local de las tablas de contenido musical.
  -- Solo canciones del usuario (source='user'); ver docs/music-feature.md.
  CREATE TABLE IF NOT EXISTS artists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS songs (
    id TEXT PRIMARY KEY,
    artist_id TEXT,
    title TEXT NOT NULL,
    source TEXT
  );
  CREATE TABLE IF NOT EXISTS song_vocabulary (
    id TEXT PRIMARY KEY,
    song_id TEXT NOT NULL,
    vocabulary_id TEXT NOT NULL,
    line_text TEXT,
    highlighted_word TEXT,
    line_index INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_sv_vocab ON song_vocabulary(vocabulary_id);
  CREATE INDEX IF NOT EXISTS idx_sv_song ON song_vocabulary(song_id);
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
