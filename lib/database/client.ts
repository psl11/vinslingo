import * as SQLite from 'expo-sqlite';
import { LOCAL_SCHEMA, INIT_QUERIES } from './schema';
import { GAP_FILL_CONNECTORS } from './gapFillSeed';
import { WORD_FORMATION_EXERCISES } from './wordFormationSeed';
import { KEY_WORD_TRANSFORM_EXERCISES } from './keyWordTransformSeed';
import { ERROR_CORRECTION_EXERCISES } from './errorCorrectionSeed';
import { OPEN_CLOZE_EXERCISES } from './openClozeSeed';
import { OFFICIAL_CAMBRIDGE_EXERCISES } from './officialCambridgeSeed';
import { PHRASAL_VERB_PARTICLES } from './phrasalVerbParticleSeed';

let db: SQLite.SQLiteDatabase | null = null;
let dbReady: Promise<SQLite.SQLiteDatabase> | null = null;
let needsResync = false;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  // Memoizar la PROMESA (no solo el handle): antes se asignaba `db` antes de
  // terminar initializeDatabase(), así que un llamador concurrente durante el
  // arranque (p.ej. el sync de foreground en web, donde la visibilidad cambia
  // constantemente) recibía una BD a medio inicializar y las queries fallaban
  // con SQLITE_MISUSE (error 21).
  if (!dbReady) {
    dbReady = (async () => {
      db = await SQLite.openDatabaseAsync('vinslingo.db');
      await initializeDatabase();
      return db;
    })().catch((err) => {
      // Si el init falla, permitir reintentar en vez de cachear el fallo
      dbReady = null;
      db = null;
      throw err;
    });
  }
  return dbReady;
}

export function checkNeedsResync(): boolean {
  return needsResync;
}

async function initializeDatabase(): Promise<void> {
  if (!db) return;
  
  // Ejecutar schema
  await db.execAsync(LOCAL_SCHEMA);
  
  // Ejecutar queries de inicialización
  await db.execAsync(INIT_QUERIES.initSyncMetadata);
  await db.execAsync(INIT_QUERIES.initSettings);
  
  // Migración: añadir nuevas columnas para ejemplos adicionales y canciones
  await runMigrations();
  
  // Seed gap-fill exercises
  await seedGapFillExercises();
  
  console.log('✅ Database initialized');
}

async function runMigrations(): Promise<void> {
  if (!db) return;
  
  // Verificar si las nuevas columnas existen, si no, añadirlas
  try {
    const columns = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(vocabulary)"
    );
    const columnNames = columns.map(c => c.name);
    
    let migrationsRan = false;
    
    // Añadir columnas faltantes
    if (!columnNames.includes('example_sentence_2')) {
      await db.execAsync('ALTER TABLE vocabulary ADD COLUMN example_sentence_2 TEXT');
      migrationsRan = true;
    }
    if (!columnNames.includes('example_translation_2')) {
      await db.execAsync('ALTER TABLE vocabulary ADD COLUMN example_translation_2 TEXT');
      migrationsRan = true;
    }
    if (!columnNames.includes('song_lyric')) {
      await db.execAsync('ALTER TABLE vocabulary ADD COLUMN song_lyric TEXT');
      migrationsRan = true;
    }
    if (!columnNames.includes('song_lyric_translation')) {
      await db.execAsync('ALTER TABLE vocabulary ADD COLUMN song_lyric_translation TEXT');
      migrationsRan = true;
    }
    if (!columnNames.includes('song_title')) {
      await db.execAsync('ALTER TABLE vocabulary ADD COLUMN song_title TEXT');
      migrationsRan = true;
    }
    if (!columnNames.includes('song_artist')) {
      await db.execAsync('ALTER TABLE vocabulary ADD COLUMN song_artist TEXT');
      migrationsRan = true;
    }
    if (!columnNames.includes('anchor_type')) {
      await db.execAsync('ALTER TABLE vocabulary ADD COLUMN anchor_type TEXT');
      migrationsRan = true;
    }
    if (!columnNames.includes('anchor_year')) {
      await db.execAsync('ALTER TABLE vocabulary ADD COLUMN anchor_year INTEGER');
      migrationsRan = true;
    }

    if (migrationsRan) {
      // Forzar resincronización del vocabulario para obtener los nuevos datos
      await db.runAsync(
        "DELETE FROM sync_metadata WHERE key = 'vocabulary_last_sync'"
      );
      needsResync = true;
      console.log('✅ Migrations completed - resync needed');
    } else {
      // Verificar si las columnas existen pero los datos están vacíos
      const emptyCheck = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM vocabulary WHERE song_lyric IS NOT NULL"
      );
      if (emptyCheck && emptyCheck.count === 0) {
        // Las columnas existen pero no hay datos, necesita resync
        await db.runAsync(
          "DELETE FROM sync_metadata WHERE key = 'vocabulary_last_sync'"
        );
        needsResync = true;
        console.log('✅ New columns empty - resync needed');
      }
    }
  } catch (error) {
    console.log('Migration check:', error);
  }

  // Migración FSRS: añadir columnas de estado del algoritmo a user_vocabulary.
  // (La tabla review_log se crea vía CREATE TABLE IF NOT EXISTS en LOCAL_SCHEMA,
  // que corre en cada init, así que cubre instalaciones nuevas y existentes.)
  // Ver docs/fsrs-migration.md. Aditivo: SM-2 sigue operativo hasta el paso 4.
  try {
    const uvCols = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(user_vocabulary)"
    );
    const uvColNames = uvCols.map(c => c.name);
    const fsrsColumns: [string, string][] = [
      ['stability', 'REAL DEFAULT 0'],
      ['difficulty', 'REAL DEFAULT 0'],
      ['elapsed_days', 'INTEGER DEFAULT 0'],
      ['scheduled_days', 'INTEGER DEFAULT 0'],
      ['learning_steps', 'INTEGER DEFAULT 0'],
      ['reps', 'INTEGER DEFAULT 0'],
      ['lapses', 'INTEGER DEFAULT 0'],
      ['fsrs_state', 'INTEGER DEFAULT 0'],
      ['due', 'INTEGER'],
      ['last_review', 'INTEGER'],
    ];
    for (const [name, def] of fsrsColumns) {
      if (!uvColNames.includes(name)) {
        await db.execAsync(`ALTER TABLE user_vocabulary ADD COLUMN ${name} ${def}`);
      }
    }
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_user_vocab_due ON user_vocabulary(due)');
  } catch (error) {
    console.log('FSRS migration check:', error);
  }

  // Migrate gap_fill_exercises: add base_word and context_sentence columns
  try {
    const gfCols = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(gap_fill_exercises)"
    );
    const gfColNames = gfCols.map(c => c.name);
    if (!gfColNames.includes('base_word')) {
      await db.execAsync('ALTER TABLE gap_fill_exercises ADD COLUMN base_word TEXT');
    }
    if (!gfColNames.includes('context_sentence')) {
      await db.execAsync('ALTER TABLE gap_fill_exercises ADD COLUMN context_sentence TEXT');
    }
    if (!gfColNames.includes('is_official')) {
      await db.execAsync('ALTER TABLE gap_fill_exercises ADD COLUMN is_official INTEGER DEFAULT 0');
    }
    if (!gfColNames.includes('answer_es')) {
      await db.execAsync('ALTER TABLE gap_fill_exercises ADD COLUMN answer_es TEXT');
    }
  } catch (error) {
    console.log('Gap-fill migration check:', error);
  }
}

// Incrementar cada vez que se corrija o añada contenido en los ficheros
// *Seed.ts para que los dispositivos ya instalados re-siembren los ejercicios.
// (Con el mecanismo anterior de INSERT OR IGNORE + check de recuento, las
// correcciones de contenido nunca llegaban a instalaciones existentes.)
const SEED_VERSION = 5;

async function seedGapFillExercises(): Promise<void> {
  if (!db) return;
  try {
    const allExercises = [
      ...GAP_FILL_CONNECTORS,
      ...WORD_FORMATION_EXERCISES,
      ...KEY_WORD_TRANSFORM_EXERCISES,
      ...ERROR_CORRECTION_EXERCISES,
      ...OPEN_CLOZE_EXERCISES,
      ...OFFICIAL_CAMBRIDGE_EXERCISES,
      ...PHRASAL_VERB_PARTICLES,
    ];

    const versionRow = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM sync_metadata WHERE key = 'gap_fill_seed_version'"
    );
    const currentVersion = versionRow ? parseInt(versionRow.value, 10) : 0;

    const count = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM gap_fill_exercises'
    );
    const upToDate =
      currentVersion >= SEED_VERSION && count && count.count >= allExercises.length;
    if (upToDate) return;

    // INSERT OR REPLACE: refresca el contenido de ejercicios existentes
    // (el progreso del usuario vive en user_gap_fill, no se toca).
    for (const item of allExercises) {
      await db.runAsync(
        `INSERT OR REPLACE INTO gap_fill_exercises
         (id, sentence, answer, options, explanation, explanation_es, cefr_level, category, difficulty, source, base_word, context_sentence, is_official, answer_es)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'cambridge', ?, ?, ?, ?)`,
        [
          item.id, item.sentence, item.answer, item.options || null,
          item.explanation, item.explanation_es, item.cefr_level,
          item.category, item.difficulty,
          (item as any).base_word || null,
          (item as any).context_sentence || null,
          (item as any).is_official ? 1 : 0,
          (item as any).answer_es || null,
        ]
      );
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES ('gap_fill_seed_version', ?, ?)`,
      [String(SEED_VERSION), Date.now()]
    );
    console.log(`✅ Seeded ${allExercises.length} exercises (seed v${SEED_VERSION})`);
  } catch (error) {
    console.log('Gap-fill seed error:', error);
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
    dbReady = null;
  }
}

// Helper para ejecutar queries con parámetros
export async function runQuery<T>(
  query: string,
  params: (string | number | null)[] = []
): Promise<T[]> {
  const database = await getDatabase();
  return database.getAllAsync<T>(query, params);
}

// Helper para ejecutar un statement (INSERT, UPDATE, DELETE)
export async function runStatement(
  query: string,
  params: (string | number | null)[] = []
): Promise<SQLite.SQLiteRunResult> {
  const database = await getDatabase();
  return database.runAsync(query, params);
}

// Helper para obtener un solo registro
export async function getOne<T>(
  query: string,
  params: (string | number | null)[] = []
): Promise<T | null> {
  const database = await getDatabase();
  return database.getFirstAsync<T>(query, params);
}

// Helper para transacciones
export async function withTransaction(
  callback: (db: SQLite.SQLiteDatabase) => Promise<void>
): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await callback(database);
  });
}
