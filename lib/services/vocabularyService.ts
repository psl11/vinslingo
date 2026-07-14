import { supabase } from '../supabase';
import { runQuery, withTransaction, getSyncMetadata, setSyncMetadata } from '../database/client';
import { VocabularyItem } from '../database/queries';
import { extractParticle } from '../vocabulary/particleHints';

export interface SupabaseVocabulary {
  id: string;
  word: string;
  translation: string;
  pronunciation?: string;
  pronunciation_es?: string;
  audio_url?: string;
  part_of_speech?: string;
  cefr_level: string;
  category?: string;
  frequency_rank?: number;
  example_sentence?: string;
  example_translation?: string;
  example_sentence_2?: string;
  example_translation_2?: string;
  song_lyric?: string;
  song_lyric_translation?: string;
  song_title?: string;
  song_artist?: string;
  anchor_type?: string;
  anchor_year?: number;
  formal_synonym?: string;
  separability?: string;
  updated_at?: string; // ISO timestamptz del servidor (para el sync incremental)
}

export interface VocabSyncOptions {
  // Fuerza el sync ya (ignora el intervalo mínimo entre syncs).
  force?: boolean;
  // Fuerza un sync COMPLETO (no incremental): re-baja todo y reconcilia borrados.
  fullResync?: boolean;
  // No re-sincronizar si el último intento fue hace menos de esto.
  minIntervalMs?: number;
  // Cada cuánto se hace un full completo (para reconciliar filas borradas en el
  // servidor, que el incremental por updated_at no puede detectar).
  fullResyncMaxAgeMs?: number;
}

// Intervalo mínimo entre syncs (evita re-sincronizar en relanzamientos rápidos).
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000;
// Cada cuánto un full completo (reconcilia borrados). Entre medias, incremental.
const FULL_RESYNC_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const VOCAB_COLUMNS = `id, word, translation, pronunciation, pronunciation_es, audio_url,
  part_of_speech, cefr_level, category, frequency_rank,
  example_sentence, example_translation, example_sentence_2, example_translation_2,
  song_lyric, song_lyric_translation, song_title, song_artist,
  anchor_type, anchor_year, formal_synonym, separability, updated_at`;

function vocabRowParams(item: SupabaseVocabulary, localTs: number): (string | number | null)[] {
  return [
    item.id, item.word, item.translation,
    item.pronunciation || null, item.pronunciation_es || null, item.audio_url || null, item.part_of_speech || null,
    item.cefr_level, item.category || null, item.frequency_rank || null,
    item.example_sentence || null, item.example_translation || null,
    item.example_sentence_2 || null, item.example_translation_2 || null,
    item.song_lyric || null, item.song_lyric_translation || null,
    item.song_title || null, item.song_artist || null,
    item.anchor_type || null, item.anchor_year || null,
    item.formal_synonym || null, item.separability || null,
    localTs,
  ];
}

// Sincroniza el vocabulario desde Supabase. Por defecto INCREMENTAL: solo baja
// las filas cambiadas desde el último sync (comparando el `updated_at` del
// servidor). Hace un full completo la primera vez, cada FULL_RESYNC_MAX_AGE_MS
// (para reconciliar borrados) o si se fuerza. Degrada con gracia: si la columna
// `updated_at` aún no existe en Supabase, no se captura marca de agua y se queda
// en modo full (comportamiento anterior).
// Devuelve nº de filas escritas (0 si nada cambió), o -1 si se saltó por intervalo.
export async function syncVocabularyFromSupabase(
  options: VocabSyncOptions = {}
): Promise<number> {
  const {
    force = false,
    fullResync = false,
    minIntervalMs = MIN_SYNC_INTERVAL_MS,
    fullResyncMaxAgeMs = FULL_RESYNC_MAX_AGE_MS,
  } = options;
  try {
    // Intervalo mínimo: no re-sincronizar en relanzamientos rápidos.
    if (!force) {
      const last = await getSyncMetadata('vocabulary_last_sync');
      if (last && Date.now() - Number(last) < minIntervalMs) {
        return -1;
      }
    }

    const watermark = await getSyncMetadata('vocabulary_sync_watermark');
    const lastFull = await getSyncMetadata('vocabulary_last_full_sync');
    // Full si: se fuerza, no hay marca de agua (primera vez / columna ausente),
    // o el último full es demasiado viejo (reconciliar borrados).
    const needFull =
      fullResync ||
      !watermark ||
      !lastFull ||
      Date.now() - Number(lastFull) >= fullResyncMaxAgeMs;

    // Fetch paginado (PostgREST limita a 1000 filas/respuesta).
    const PAGE_SIZE = 1000;
    const data: SupabaseVocabulary[] = [];
    let from = 0;
    while (true) {
      let query = supabase.from('vocabulary').select('*');
      query = needFull
        ? query.order('id', { ascending: true })
        : query.gt('updated_at', watermark!).order('updated_at', { ascending: true });
      const { data: page, error } = await query.range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error('Error fetching vocabulary:', error);
        throw error;
      }
      if (!page || page.length === 0) break;
      data.push(...page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    // Nueva marca de agua = máximo updated_at del servidor entre lo traído.
    let maxUpdatedAt: string | null = needFull ? null : watermark;
    let maxMs = maxUpdatedAt ? new Date(maxUpdatedAt).getTime() : -Infinity;
    for (const r of data) {
      if (r.updated_at) {
        const ms = new Date(r.updated_at).getTime();
        if (ms > maxMs) {
          maxMs = ms;
          maxUpdatedAt = r.updated_at;
        }
      }
    }

    if (data.length === 0) {
      // Incremental sin cambios: nada que escribir.
      await setSyncMetadata('vocabulary_last_sync', String(Date.now()));
      console.log('✅ Vocabulary up to date (incremental, 0 cambios)');
      return 0;
    }

    const syncStartedAt = Date.now();

    // UNA sola transacción para todas las filas (+ purga en full). En la PWA cada
    // runAsync suelto es un round-trip al worker de SQLite; batchearlo en un
    // único commit es ~10-50x más rápido.
    await withTransaction(async (db) => {
      for (const item of data) {
        await db.runAsync(
          `INSERT OR REPLACE INTO vocabulary (${VOCAB_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          vocabRowParams(item, syncStartedAt)
        );
      }
      // Purga de borrados: SOLO en full (el incremental no ve las filas
      // borradas en el servidor). En full traemos todo → lo que quede con
      // updated_at < syncStartedAt es obsoleto.
      if (needFull) {
        await db.runAsync(
          'DELETE FROM vocabulary WHERE updated_at IS NULL OR updated_at < ?',
          [syncStartedAt]
        );
        await db.runAsync(
          'DELETE FROM user_vocabulary WHERE vocabulary_id NOT IN (SELECT id FROM vocabulary)'
        );
      }
    });

    await setSyncMetadata('vocabulary_last_sync', String(Date.now()));
    if (maxUpdatedAt) await setSyncMetadata('vocabulary_sync_watermark', maxUpdatedAt);
    if (needFull) await setSyncMetadata('vocabulary_last_full_sync', String(Date.now()));

    console.log(`✅ Synced ${data.length} vocabulary items (${needFull ? 'full' : 'incremental'})`);
    return data.length;
  } catch (error) {
    console.error('Failed to sync vocabulary:', error);
    throw error;
  }
}

export async function getLocalVocabularyCount(): Promise<number> {
  const result = await runQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM vocabulary'
  );
  return result[0]?.count ?? 0;
}

export async function getVocabularyByFrequencyRange(
  start: number,
  end: number
): Promise<VocabularyItem[]> {
  return runQuery<VocabularyItem>(
    `SELECT * FROM vocabulary 
     WHERE frequency_rank >= ? AND frequency_rank <= ?
     ORDER BY frequency_rank`,
    [start, end]
  );
}

export async function getVocabularyForLesson(
  category: string,
  limit: number = 20,
  cefrLevels?: string[]
): Promise<VocabularyItem[]> {
  // Obtener palabras que el usuario aún no ha estudiado
  if (cefrLevels && cefrLevels.length > 0) {
    const placeholders = cefrLevels.map(() => '?').join(', ');
    return runQuery<VocabularyItem>(
      `SELECT v.* FROM vocabulary v
       LEFT JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
       WHERE v.category = ? AND uv.id IS NULL
       AND v.cefr_level IN (${placeholders})
       ORDER BY v.frequency_rank ASC
       LIMIT ?`,
      [category, ...cefrLevels, limit]
    );
  }
  return runQuery<VocabularyItem>(
    `SELECT v.* FROM vocabulary v
     LEFT JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
     WHERE v.category = ? AND uv.id IS NULL
     ORDER BY v.frequency_rank ASC
     LIMIT ?`,
    [category, limit]
  );
}

// Estudiar por partícula: agrupa los phrasal verbs con la misma partícula (up,
// out, off…). Enseñar así — todos los "up" juntos — refuerza el patrón de la
// partícula (Rudzka-Ostyn). Incluye el grupo completo (estudiados o no) para
// que se vea el patrón, ordenado por frecuencia. La partícula se deriva de la
// palabra, así que se filtra en JS (solo 150 phrasal, coste despreciable).
export async function getVocabularyByParticle(
  particle: string,
  limit: number = 20,
  cefrLevels?: string[]
): Promise<VocabularyItem[]> {
  let query = `SELECT v.* FROM vocabulary v WHERE v.category = 'phave'`;
  const params: (string | number)[] = [];
  if (cefrLevels && cefrLevels.length > 0) {
    query += ` AND v.cefr_level IN (${cefrLevels.map(() => '?').join(', ')})`;
    params.push(...cefrLevels);
  }
  query += ` ORDER BY v.frequency_rank ASC`;
  const all = await runQuery<VocabularyItem>(query, params);
  return all.filter((v) => extractParticle(v.word) === particle).slice(0, limit);
}

export async function getDueVocabulary(
  limit: number = 20, 
  cefrLevels?: string[],
  categories?: string[]
): Promise<VocabularyItem[]> {
  const now = Date.now();
  
  // Hidrata las tarjetas con el estado FSRS (fsrs_state se aliasa como `state`,
  // que es como lo espera StudyFsrsFields en lib/srs/fsrs.ts).
  // COALESCE(due, next_review_at): las filas de la era SM-2 (soft-reset) tienen
  // due NULL pero next_review_at válido — sin el COALESCE desaparecerían del
  // repaso (y tampoco saldrían como "nuevas", porque ya tienen fila de progreso).
  let query = `SELECT v.*,
       uv.stability, uv.difficulty, uv.elapsed_days, uv.scheduled_days,
       uv.learning_steps, uv.reps, uv.lapses, uv.fsrs_state AS state,
       uv.due, uv.last_review
     FROM vocabulary v
     INNER JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
     WHERE COALESCE(uv.due, uv.next_review_at) <= ?`;
  const params: any[] = [now];

  if (cefrLevels && cefrLevels.length > 0) {
    const placeholders = cefrLevels.map(() => '?').join(', ');
    query += ` AND v.cefr_level IN (${placeholders})`;
    params.push(...cefrLevels);
  }

  if (categories && categories.length > 0) {
    const placeholders = categories.map(() => '?').join(', ');
    query += ` AND v.category IN (${placeholders})`;
    params.push(...categories);
  }

  // Orden de repaso con desempate suave por frecuencia:
  //  1º) por "día de vencimiento" (los más atrasados primero) para no romper
  //      la urgencia de memoria del scheduler a nivel de día;
  //  2º) dentro del mismo día, por frecuencia real (rank más bajo = más común
  //      = antes), de modo que si hay más tarjetas vencidas que el límite de la
  //      sesión, se ven antes las expresiones más útiles;
  //  3º) por la marca de tiempo exacta, como orden estable final.
  // Es "suave" porque una tarjeta poco frecuente que se va atrasando cae a un
  // día anterior y acaba ganando igualmente: nunca se queda sin repasar.
  // COALESCE evita que un frequency_rank NULL (categorías sin rank) se cuele
  // primero (en SQLite los NULL ordenarían antes en ASC).
  query += ` ORDER BY CAST(COALESCE(uv.due, uv.next_review_at) / 86400000 AS INTEGER) ASC,
             COALESCE(v.frequency_rank, 999999) ASC,
             COALESCE(uv.due, uv.next_review_at) ASC
             LIMIT ?`;
  params.push(limit);

  return runQuery<VocabularyItem>(query, params);
}

export interface SearchResult {
  id: string;
  word: string;
  translation: string;
  category: string;
  cefr_level: string;
  part_of_speech?: string;
  example_sentence?: string;
  example_translation?: string;
  example_sentence_2?: string;
  example_translation_2?: string;
  song_lyric?: string;
  song_lyric_translation?: string;
  song_title?: string;
  song_artist?: string;
  anchor_type?: string;
  anchor_year?: number;
  formal_synonym?: string;
  separability?: string;
  mastery_level?: number;
  times_correct?: number;
  times_incorrect?: number;
}

export async function searchVocabulary(query: string, limit: number = 50): Promise<SearchResult[]> {
  const searchTerm = `%${query}%`;
  return runQuery<SearchResult>(
    `SELECT v.*, uv.mastery_level, uv.times_correct, uv.times_incorrect
     FROM vocabulary v
     LEFT JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
     WHERE v.word LIKE ? OR v.translation LIKE ?
     ORDER BY 
       CASE WHEN v.word LIKE ? THEN 0 ELSE 1 END,
       v.frequency_rank ASC
     LIMIT ?`,
    [searchTerm, searchTerm, searchTerm, limit]
  );
}

export interface FailedWordFilter {
  // true = solo palabras aún NO dominadas (mastery < 3); false/undefined = todas
  // las que se hayan fallado alguna vez (historial completo, incluso dominadas).
  onlyNotMastered?: boolean;
  cefrLevels?: string[];
  limit?: number;
}

// "Palabras más falladas": las que el usuario ha fallado al menos una vez,
// ordenadas por nº de fallos ↓ (desempate: menos dominadas primero, luego por
// frecuencia). Para el listado (sin límite) y para el cuestionario (con límite).
export async function getMostFailedVocabulary(
  filter: FailedWordFilter = {}
): Promise<SearchResult[]> {
  const { onlyNotMastered, cefrLevels, limit } = filter;
  let query = `SELECT v.*, uv.mastery_level, uv.times_correct, uv.times_incorrect
     FROM vocabulary v
     INNER JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
     WHERE uv.times_incorrect > 0`;
  const params: (string | number)[] = [];
  if (onlyNotMastered) {
    query += ` AND uv.mastery_level < 3`;
  }
  if (cefrLevels && cefrLevels.length > 0) {
    query += ` AND v.cefr_level IN (${cefrLevels.map(() => '?').join(', ')})`;
    params.push(...cefrLevels);
  }
  query += ` ORDER BY uv.times_incorrect DESC, uv.mastery_level ASC, COALESCE(v.frequency_rank, 999999) ASC`;
  if (limit && limit > 0) {
    query += ` LIMIT ?`;
    params.push(limit);
  }
  return runQuery<SearchResult>(query, params);
}

// Pool para generar distractores del modo Entrenamiento (drill): todo el
// vocabulario, solo con los campos que usa el generador (ligero: ~3k filas).
export async function getDistractorPool(): Promise<VocabularyItem[]> {
  return runQuery<VocabularyItem>(
    'SELECT id, word, translation, category, cefr_level, part_of_speech FROM vocabulary'
  );
}

export async function getAllLearnedVocabulary(limit: number = 100, offset: number = 0): Promise<SearchResult[]> {
  return runQuery<SearchResult>(
    `SELECT v.*, uv.mastery_level, uv.times_correct, uv.times_incorrect
     FROM vocabulary v
     INNER JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
     ORDER BY uv.last_reviewed_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

export async function getVocabularyStats(): Promise<{
  total: number;
  byCategory: { category: string; count: number }[];
  byLevel: { level: string; count: number }[];
  learnedByCategory: { category: string; count: number }[];
}> {
  const [totalResult] = await runQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM vocabulary'
  );
  
  const byCategory = await runQuery<{ category: string; count: number }>(
    'SELECT category, COUNT(*) as count FROM vocabulary GROUP BY category'
  );
  
  const byLevel = await runQuery<{ level: string; count: number }>(
    'SELECT cefr_level as level, COUNT(*) as count FROM vocabulary GROUP BY cefr_level ORDER BY cefr_level'
  );
  
  const learnedByCategory = await runQuery<{ category: string; count: number }>(
    `SELECT v.category, COUNT(*) as count
     FROM user_vocabulary uv
     INNER JOIN vocabulary v ON uv.vocabulary_id = v.id
     WHERE uv.mastery_level >= 1
     GROUP BY v.category`
  );
  
  return {
    total: totalResult?.count ?? 0,
    byCategory,
    byLevel,
    learnedByCategory,
  };
}
