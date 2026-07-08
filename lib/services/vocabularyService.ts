import { supabase } from '../supabase';
import { runQuery, runStatement, getDatabase } from '../database/client';
import { VocabularyItem } from '../database/queries';

export interface SupabaseVocabulary {
  id: string;
  word: string;
  translation: string;
  pronunciation?: string;
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
}

export async function syncVocabularyFromSupabase(): Promise<number> {
  try {
    // Fetch todo el vocabulario de Supabase (sin filtro incremental).
    // PostgREST limita cada respuesta a 1000 filas, así que hay que paginar
    // con .range() o solo llegarían las primeras 1000 palabras de ~3250.
    const PAGE_SIZE = 1000;
    const data: SupabaseVocabulary[] = [];
    let from = 0;

    while (true) {
      const { data: page, error } = await supabase
        .from('vocabulary')
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('Error fetching vocabulary:', error);
        throw error;
      }
      if (!page || page.length === 0) break;

      data.push(...page);
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    if (data.length === 0) {
      return 0;
    }
    
    // Insertar/actualizar en SQLite
    const db = await getDatabase();
    const syncStartedAt = Date.now();
    let insertedCount = 0;

    for (const item of data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO vocabulary (
          id, word, translation, pronunciation, audio_url,
          part_of_speech, cefr_level, category, frequency_rank,
          example_sentence, example_translation,
          example_sentence_2, example_translation_2,
          song_lyric, song_lyric_translation, song_title, song_artist,
          anchor_type, anchor_year,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.word,
          item.translation,
          item.pronunciation || null,
          item.audio_url || null,
          item.part_of_speech || null,
          item.cefr_level,
          item.category || null,
          item.frequency_rank || null,
          item.example_sentence || null,
          item.example_translation || null,
          item.example_sentence_2 || null,
          item.example_translation_2 || null,
          item.song_lyric || null,
          item.song_lyric_translation || null,
          item.song_title || null,
          item.song_artist || null,
          item.anchor_type || null,
          item.anchor_year || null,
          Date.now(),
        ]
      );
      insertedCount++;
    }

    // Purgar filas que ya no existen en el servidor (p.ej. duplicados
    // eliminados): todo lo recién sincronizado tiene updated_at >= inicio
    // del sync, así que lo anterior es contenido obsoleto. También se
    // limpia el progreso huérfano que apunte a vocabulario borrado.
    await db.runAsync(
      'DELETE FROM vocabulary WHERE updated_at IS NULL OR updated_at < ?',
      [syncStartedAt]
    );
    await db.runAsync(
      'DELETE FROM user_vocabulary WHERE vocabulary_id NOT IN (SELECT id FROM vocabulary)'
    );

    console.log(`✅ Synced ${insertedCount} vocabulary items`);
    return insertedCount;
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
