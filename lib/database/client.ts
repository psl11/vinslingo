import * as SQLite from 'expo-sqlite';
import { LOCAL_SCHEMA, INIT_QUERIES } from './schema';
import { GAP_FILL_CONNECTORS } from './gapFillSeed';
import { WORD_FORMATION_EXERCISES } from './wordFormationSeed';
import { KEY_WORD_TRANSFORM_EXERCISES } from './keyWordTransformSeed';
import { ERROR_CORRECTION_EXERCISES } from './errorCorrectionSeed';
import { OPEN_CLOZE_EXERCISES } from './openClozeSeed';
import { OFFICIAL_CAMBRIDGE_EXERCISES } from './officialCambridgeSeed';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync('vinslingo.db');
  await initializeDatabase();
  return db;
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
    
    if (migrationsRan) {
      // Forzar resincronización del vocabulario para obtener los nuevos datos
      await db.runAsync(
        "DELETE FROM sync_metadata WHERE key = 'vocabulary_last_sync'"
      );
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
        console.log('✅ New columns empty - resync needed');
      }
    }
  } catch (error) {
    console.log('Migration check:', error);
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

  // Enforce one user_vocabulary row per vocabulary_id.
  // Historically the table keyed only on `id` (a UUID), so a word studied
  // offline (local UUID) and later downloaded from Supabase (server UUID)
  // could produce two rows for the same vocabulary_id, double-counting stats.
  // Deduplicate keeping the most recently updated row, then add a UNIQUE index
  // so INSERT OR REPLACE collapses future duplicates by vocabulary_id.
  try {
    await db.execAsync(`
      DELETE FROM user_vocabulary
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, MAX(updated_at) AS keep FROM user_vocabulary
          GROUP BY vocabulary_id
        )
      );
    `);
    await db.execAsync(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_user_vocab_vocab_unique ON user_vocabulary(vocabulary_id)'
    );
  } catch (error) {
    console.log('user_vocabulary dedup/unique migration:', error);
  }
}

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
    ];

    const count = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM gap_fill_exercises'
    );
    if (count && count.count >= allExercises.length) return;

    // Insertar en una sola transacción: mucho más rápido que un commit por fila.
    await db.withTransactionAsync(async () => {
      for (const item of allExercises) {
        await db!.runAsync(
          `INSERT OR IGNORE INTO gap_fill_exercises
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
    });
    console.log(`✅ Seeded ${allExercises.length} exercises`);
  } catch (error) {
    console.log('Gap-fill seed error:', error);
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
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
