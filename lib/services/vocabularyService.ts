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
}

export async function syncVocabularyFromSupabase(): Promise<number> {
  try {
    // Fetch todo el vocabulario de Supabase paginando: PostgREST limita cada
    // petición a ~1000 filas por defecto, así que sin paginar solo llegarían
    // las primeras 1000 palabras (el dataset NGSL supera las 2800).
    const PAGE_SIZE = 1000;
    const data: SupabaseVocabulary[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data: page, error } = await supabase
        .from('vocabulary')
        .select('*')
        .order('frequency_rank', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('Error fetching vocabulary:', error);
        throw error;
      }

      if (!page || page.length === 0) break;
      data.push(...page);
      if (page.length < PAGE_SIZE) break;
    }

    if (data.length === 0) {
      return 0;
    }

    // Insertar/actualizar en SQLite dentro de una transacción.
    // Sin transacción, cada INSERT es un commit independiente y sincronizar
    // cientos de palabras en cada arranque resulta muy lento.
    const db = await getDatabase();
    let insertedCount = 0;

    await db.withTransactionAsync(async () => {
      for (const item of data) {
        await db.runAsync(
          `INSERT OR REPLACE INTO vocabulary (
            id, word, translation, pronunciation, audio_url,
            part_of_speech, cefr_level, category, frequency_rank,
            example_sentence, example_translation,
            example_sentence_2, example_translation_2,
            song_lyric, song_lyric_translation, song_title, song_artist,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            Date.now(),
          ]
        );
        insertedCount++;
      }
    });

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
  
  let query = `SELECT v.*, uv.ease_factor, uv.interval_days as interval, uv.repetitions
     FROM vocabulary v
     INNER JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
     WHERE uv.next_review_at <= ?`;
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

  query += ` ORDER BY uv.next_review_at ASC LIMIT ?`;
  params.push(limit);

  return runQuery<VocabularyItem>(query, params);
}

// "Difficult words" (leeches): words the user gets wrong more often than right.
// Drilling these has an outsized effect on retention, so they get a dedicated
// review separate from the SRS schedule.
export async function getDifficultVocabulary(
  limit: number = 20,
  cefrLevels?: string[]
): Promise<VocabularyItem[]> {
  let query = `SELECT v.*, uv.ease_factor, uv.interval_days as interval, uv.repetitions
     FROM vocabulary v
     INNER JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
     WHERE uv.times_incorrect > uv.times_correct`;
  const params: any[] = [];

  if (cefrLevels && cefrLevels.length > 0) {
    const placeholders = cefrLevels.map(() => '?').join(', ');
    query += ` AND v.cefr_level IN (${placeholders})`;
    params.push(...cefrLevels);
  }

  // Most-failed first (largest net incorrect margin).
  query += ` ORDER BY (uv.times_incorrect - uv.times_correct) DESC, uv.times_incorrect DESC LIMIT ?`;
  params.push(limit);

  return runQuery<VocabularyItem>(query, params);
}

export async function getDifficultVocabularyCount(): Promise<number> {
  const result = await runQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM user_vocabulary WHERE times_incorrect > times_correct'
  );
  return result[0]?.count ?? 0;
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
