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
}

export async function syncVocabularyFromSupabase(): Promise<number> {
  try {
    // Obtener última sincronización
    const lastSync = await getLastVocabularySyncTime();
    
    // Fetch vocabulario de Supabase
    let query = supabase
      .from('vocabulary')
      .select('*')
      .order('frequency_rank', { ascending: true });
    
    if (lastSync) {
      query = query.gt('updated_at', new Date(lastSync).toISOString());
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching vocabulary:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      return 0;
    }
    
    // Insertar/actualizar en SQLite
    const db = await getDatabase();
    let insertedCount = 0;
    
    for (const item of data) {
      await db.runAsync(
        `INSERT OR REPLACE INTO vocabulary (
          id, word, translation, pronunciation, audio_url,
          part_of_speech, cefr_level, category, frequency_rank,
          example_sentence, example_translation, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          Date.now(),
        ]
      );
      insertedCount++;
    }
    
    // Actualizar tiempo de sincronización
    await updateLastVocabularySyncTime();
    
    console.log(`✅ Synced ${insertedCount} vocabulary items`);
    return insertedCount;
  } catch (error) {
    console.error('Failed to sync vocabulary:', error);
    throw error;
  }
}

async function getLastVocabularySyncTime(): Promise<number | null> {
  try {
    const result = await runQuery<{ value: string }>(
      "SELECT value FROM sync_metadata WHERE key = 'vocabulary_last_sync'"
    );
    return result[0] ? parseInt(result[0].value, 10) : null;
  } catch {
    return null;
  }
}

async function updateLastVocabularySyncTime(): Promise<void> {
  await runStatement(
    `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) 
     VALUES ('vocabulary_last_sync', ?, ?)`,
    [Date.now().toString(), Date.now()]
  );
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
  limit: number = 20
): Promise<VocabularyItem[]> {
  // Obtener palabras que el usuario aún no ha estudiado
  return runQuery<VocabularyItem>(
    `SELECT v.* FROM vocabulary v
     LEFT JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
     WHERE v.category = ? AND uv.id IS NULL
     ORDER BY v.frequency_rank ASC
     LIMIT ?`,
    [category, limit]
  );
}

export async function getDueVocabulary(limit: number = 20): Promise<VocabularyItem[]> {
  const now = Date.now();
  return runQuery<VocabularyItem>(
    `SELECT v.*, uv.ease_factor, uv.interval_days as interval, uv.repetitions
     FROM vocabulary v
     INNER JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
     WHERE uv.next_review_at <= ?
     ORDER BY uv.next_review_at ASC
     LIMIT ?`,
    [now, limit]
  );
}

export async function getVocabularyStats(): Promise<{
  total: number;
  byCategory: { category: string; count: number }[];
  byLevel: { level: string; count: number }[];
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
  
  return {
    total: totalResult?.count ?? 0,
    byCategory,
    byLevel,
  };
}
