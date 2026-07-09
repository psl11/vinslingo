import { runQuery, runStatement, getOne, withTransaction } from './client';
import { generateUUID } from '../utils/uuid';
import { calculateMasteryLevel } from '../services/progressLogic';
import type { PersistedFsrsState, ReviewLogRow } from '../srs/fsrs';

export { calculateMasteryLevel };

// ============================================
// VOCABULARY QUERIES
// ============================================

export interface VocabularyItem {
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
  formal_synonym?: string;
  separability?: string;
}

export async function getVocabularyByLevel(cefrLevel: string): Promise<VocabularyItem[]> {
  return runQuery<VocabularyItem>(
    'SELECT * FROM vocabulary WHERE cefr_level = ? ORDER BY frequency_rank',
    [cefrLevel]
  );
}

export async function getVocabularyByCategory(category: string, cefrLevels?: string[]): Promise<VocabularyItem[]> {
  if (cefrLevels && cefrLevels.length > 0) {
    const placeholders = cefrLevels.map(() => '?').join(', ');
    return runQuery<VocabularyItem>(
      `SELECT * FROM vocabulary WHERE category = ? AND cefr_level IN (${placeholders}) ORDER BY frequency_rank`,
      [category, ...cefrLevels]
    );
  }
  return runQuery<VocabularyItem>(
    'SELECT * FROM vocabulary WHERE category = ? ORDER BY frequency_rank',
    [category]
  );
}

export async function getVocabularyForReview(limit: number = 20, cefrLevels?: string[]): Promise<VocabularyItem[]> {
  const now = Date.now();
  if (cefrLevels && cefrLevels.length > 0) {
    const placeholders = cefrLevels.map(() => '?').join(', ');
    return runQuery<VocabularyItem>(
      `SELECT v.* FROM vocabulary v
       INNER JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
       WHERE (uv.next_review_at <= ? OR uv.next_review_at IS NULL)
       AND v.cefr_level IN (${placeholders})
       ORDER BY uv.next_review_at ASC
       LIMIT ?`,
      [now, ...cefrLevels, limit]
    );
  }
  return runQuery<VocabularyItem>(
    `SELECT v.* FROM vocabulary v
     INNER JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
     WHERE uv.next_review_at <= ? OR uv.next_review_at IS NULL
     ORDER BY uv.next_review_at ASC
     LIMIT ?`,
    [now, limit]
  );
}

export async function getNewVocabulary(limit: number = 10, cefrLevels?: string[]): Promise<VocabularyItem[]> {
  if (cefrLevels && cefrLevels.length > 0) {
    const placeholders = cefrLevels.map(() => '?').join(', ');
    return runQuery<VocabularyItem>(
      `SELECT v.* FROM vocabulary v
       WHERE v.id NOT IN (SELECT vocabulary_id FROM user_vocabulary)
       AND v.cefr_level IN (${placeholders})
       ORDER BY v.frequency_rank ASC
       LIMIT ?`,
      [...cefrLevels, limit]
    );
  }
  return runQuery<VocabularyItem>(
    `SELECT v.* FROM vocabulary v
     WHERE v.id NOT IN (SELECT vocabulary_id FROM user_vocabulary)
     ORDER BY v.frequency_rank ASC
     LIMIT ?`,
    [limit]
  );
}

// ============================================
// USER VOCABULARY QUERIES
// ============================================

export interface UserVocabulary {
  id: string;
  vocabulary_id: string;
  // Columnas SM-2 (vestigiales durante la migración; ver docs/fsrs-migration.md)
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at?: number;
  last_reviewed_at?: number;
  times_correct: number;
  times_incorrect: number;
  mastery_level: number;
  needs_sync: number;
  // Estado FSRS
  stability?: number;
  difficulty?: number;
  elapsed_days?: number;
  scheduled_days?: number;
  learning_steps?: number;
  reps?: number;
  lapses?: number;
  fsrs_state?: number;
  due?: number;
  last_review?: number;
}

export async function getUserVocabulary(vocabularyId: string): Promise<UserVocabulary | null> {
  return getOne<UserVocabulary>(
    'SELECT * FROM user_vocabulary WHERE vocabulary_id = ?',
    [vocabularyId]
  );
}

export async function createUserVocabulary(vocabularyId: string): Promise<string> {
  const id = generateUUID();
  await runStatement(
    `INSERT INTO user_vocabulary (id, vocabulary_id, needs_sync) VALUES (?, ?, 1)`,
    [id, vocabularyId]
  );
  return id;
}

export async function updateUserVocabularyAfterReview(
  vocabularyId: string,
  data: {
    state: PersistedFsrsState; // nuevo estado FSRS de la tarjeta
    isCorrect: boolean; // derivado de la etiqueta (quality !== 'again'), no del número
    log: ReviewLogRow; // repaso a registrar en review_log
  }
): Promise<void> {
  const now = Date.now();
  const { state, isCorrect, log } = data;
  const masteryLevel = calculateMasteryLevel(state.reps, state.stability);
  const userVocab = await getUserVocabulary(vocabularyId);

  // next_review_at = due y repetitions = reps se mantienen sincronizados para
  // que el filtro/orden de getDueVocabulary (por next_review_at) siga
  // funcionando hasta el paso 6. Ver docs/fsrs-migration.md.
  if (!userVocab) {
    const id = generateUUID();
    await runStatement(
      `INSERT INTO user_vocabulary (
        id, vocabulary_id,
        stability, difficulty, elapsed_days, scheduled_days, learning_steps,
        reps, lapses, fsrs_state, due, last_review,
        repetitions, next_review_at, last_reviewed_at,
        times_correct, times_incorrect, mastery_level, updated_at, needs_sync
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id, vocabularyId,
        state.stability, state.difficulty, state.elapsed_days, state.scheduled_days, state.learning_steps,
        state.reps, state.lapses, state.state, state.due, state.last_review,
        state.reps, state.due, state.last_review,
        isCorrect ? 1 : 0, isCorrect ? 0 : 1, masteryLevel, now,
      ]
    );
  } else {
    const timesCorrect = userVocab.times_correct + (isCorrect ? 1 : 0);
    const timesIncorrect = userVocab.times_incorrect + (isCorrect ? 0 : 1);
    await runStatement(
      `UPDATE user_vocabulary SET
        stability = ?, difficulty = ?, elapsed_days = ?, scheduled_days = ?, learning_steps = ?,
        reps = ?, lapses = ?, fsrs_state = ?, due = ?, last_review = ?,
        repetitions = ?, next_review_at = ?, last_reviewed_at = ?,
        times_correct = ?, times_incorrect = ?, mastery_level = ?, updated_at = ?, needs_sync = 1
      WHERE vocabulary_id = ?`,
      [
        state.stability, state.difficulty, state.elapsed_days, state.scheduled_days, state.learning_steps,
        state.reps, state.lapses, state.state, state.due, state.last_review,
        state.reps, state.due, state.last_review,
        timesCorrect, timesIncorrect, masteryLevel, now, vocabularyId,
      ]
    );
  }

  // Log del repaso (append-only), base para optimizar parámetros FSRS a futuro.
  await runStatement(
    `INSERT INTO review_log (
      id, vocabulary_id, rating, state, due, stability, difficulty,
      elapsed_days, scheduled_days, review, review_duration_ms, needs_sync
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      generateUUID(), vocabularyId, log.rating, log.state, log.due, log.stability, log.difficulty,
      log.elapsed_days, log.scheduled_days, log.review, log.review_duration_ms,
    ]
  );
}

// ============================================
// STATS QUERIES
// ============================================

export interface StudyStats {
  totalWords: number;
  wordsLearning: number;
  wordsReviewing: number;
  wordsMastered: number;
  wordsForReviewToday: number;
  accuracy: number;
}

export async function getLearnedCountByCategory(): Promise<{ category: string; count: number }[]> {
  return runQuery<{ category: string; count: number }>(`
    SELECT v.category, COUNT(*) as count
    FROM user_vocabulary uv
    INNER JOIN vocabulary v ON uv.vocabulary_id = v.id
    WHERE uv.mastery_level >= 1
    GROUP BY v.category
  `, []);
}

export async function getStudyStats(): Promise<StudyStats> {
  const [counts] = await runQuery<{
    total: number;
    learning: number;
    reviewing: number;
    mastered: number;
  }>(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN mastery_level = 1 THEN 1 ELSE 0 END) as learning,
      SUM(CASE WHEN mastery_level = 2 THEN 1 ELSE 0 END) as reviewing,
      SUM(CASE WHEN mastery_level = 3 THEN 1 ELSE 0 END) as mastered
    FROM user_vocabulary
  `);
  
  const [reviewCount] = await runQuery<{ count: number }>(
    // COALESCE: filas de la era SM-2 (soft-reset) tienen due NULL; ver
    // getDueVocabulary en vocabularyService.ts.
    'SELECT COUNT(*) as count FROM user_vocabulary WHERE COALESCE(due, next_review_at) <= ?',
    [Date.now()]
  );
  
  const [accuracyResult] = await runQuery<{ correct: number; total: number }>(`
    SELECT 
      SUM(times_correct) as correct,
      SUM(times_correct + times_incorrect) as total
    FROM user_vocabulary
  `);
  
  const accuracy = accuracyResult?.total > 0 
    ? Math.round((accuracyResult.correct / accuracyResult.total) * 100) 
    : 0;
  
  return {
    totalWords: counts?.total || 0,
    wordsLearning: counts?.learning || 0,
    wordsReviewing: counts?.reviewing || 0,
    wordsMastered: counts?.mastered || 0,
    wordsForReviewToday: reviewCount?.count || 0,
    accuracy,
  };
}

// ============================================
// SYNC QUERIES
// ============================================

export async function getUnsyncedRecords(tableName: string): Promise<any[]> {
  return runQuery(
    `SELECT * FROM ${tableName} WHERE needs_sync = 1`,
    []
  );
}

export async function markAsSynced(tableName: string, id: string): Promise<void> {
  await runStatement(
    `UPDATE ${tableName} SET needs_sync = 0 WHERE id = ?`,
    [id]
  );
}

export async function addToSyncQueue(
  tableName: string,
  recordId: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  payload?: object
): Promise<void> {
  await runStatement(
    `INSERT INTO sync_queue (table_name, record_id, action, payload) VALUES (?, ?, ?, ?)`,
    [tableName, recordId, action, payload ? JSON.stringify(payload) : null]
  );
}

// ============================================
// GAP-FILL EXERCISE QUERIES
// ============================================

export interface GapFillExercise {
  id: string;
  sentence: string;
  answer: string;
  options: string; // JSON array
  explanation: string;
  explanation_es: string;
  cefr_level: string;
  category: string;
  difficulty: number;
  source: string;
  base_word?: string;
  context_sentence?: string;
  is_official?: number;
  answer_es?: string;
}

export async function getGapFillExercises(
  category: string,
  limit: number = 15,
  cefrLevels?: string[],
  sourceFilter: 'all' | 'official' | 'custom' = 'all'
): Promise<GapFillExercise[]> {
  // Build source condition
  const sourceCondition =
    sourceFilter === 'official' ? ' AND g.is_official = 1' :
    sourceFilter === 'custom'   ? ' AND (g.is_official = 0 OR g.is_official IS NULL)' :
    '';

  if (cefrLevels && cefrLevels.length > 0) {
    const placeholders = cefrLevels.map(() => '?').join(', ');
    return runQuery<GapFillExercise>(
      `SELECT g.* FROM gap_fill_exercises g
       LEFT JOIN user_gap_fill ug ON g.id = ug.exercise_id
       WHERE g.category = ? AND g.cefr_level IN (${placeholders})${sourceCondition}
       ORDER BY COALESCE(ug.times_correct, 0) ASC, RANDOM()
       LIMIT ?`,
      [category, ...cefrLevels, limit]
    );
  }
  return runQuery<GapFillExercise>(
    `SELECT g.* FROM gap_fill_exercises g
     LEFT JOIN user_gap_fill ug ON g.id = ug.exercise_id
     WHERE g.category = ?${sourceCondition}
     ORDER BY COALESCE(ug.times_correct, 0) ASC, RANDOM()
     LIMIT ?`,
    [category, limit]
  );
}

export async function updateGapFillProgress(
  exerciseId: string,
  isCorrect: boolean
): Promise<void> {
  const now = Date.now();
  const existing = await getOne<{ id: string }>(
    'SELECT id FROM user_gap_fill WHERE exercise_id = ?',
    [exerciseId]
  );
  if (existing) {
    const field = isCorrect ? 'times_correct' : 'times_incorrect';
    await runStatement(
      `UPDATE user_gap_fill SET ${field} = ${field} + 1, last_attempted_at = ? WHERE exercise_id = ?`,
      [now, exerciseId]
    );
  } else {
    const id = generateUUID();
    await runStatement(
      `INSERT INTO user_gap_fill (id, exercise_id, times_correct, times_incorrect, last_attempted_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, exerciseId, isCorrect ? 1 : 0, isCorrect ? 0 : 1, now]
    );
  }
}

export async function getGapFillStats(category: string): Promise<{ total: number; attempted: number; mastered: number }> {
  const total = await getOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM gap_fill_exercises WHERE category = ?',
    [category]
  );
  const attempted = await getOne<{ count: number }>(
    `SELECT COUNT(DISTINCT ug.exercise_id) as count
     FROM user_gap_fill ug
     INNER JOIN gap_fill_exercises g ON g.id = ug.exercise_id
     WHERE g.category = ?`,
    [category]
  );
  const mastered = await getOne<{ count: number }>(
    `SELECT COUNT(DISTINCT ug.exercise_id) as count
     FROM user_gap_fill ug
     INNER JOIN gap_fill_exercises g ON g.id = ug.exercise_id
     WHERE g.category = ? AND ug.times_correct >= 2`,
    [category]
  );
  return {
    total: total?.count ?? 0,
    attempted: attempted?.count ?? 0,
    mastered: mastered?.count ?? 0,
  };
}

export async function getGapFillMistakes(
  limit: number = 20
): Promise<GapFillExercise[]> {
  return runQuery<GapFillExercise>(
    `SELECT g.* FROM gap_fill_exercises g
     INNER JOIN user_gap_fill ug ON g.id = ug.exercise_id
     WHERE ug.times_incorrect > 0
     ORDER BY (ug.times_incorrect - ug.times_correct) DESC, ug.last_attempted_at DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getGapFillMistakeCount(): Promise<number> {
  const result = await getOne<{ count: number }>(
    `SELECT COUNT(DISTINCT ug.exercise_id) as count
     FROM user_gap_fill ug
     INNER JOIN gap_fill_exercises g ON g.id = ug.exercise_id
     WHERE ug.times_incorrect > 0`,
    []
  );
  return result?.count ?? 0;
}

export async function getPendingSyncItems(): Promise<any[]> {
  return runQuery(
    'SELECT * FROM sync_queue WHERE synced_at IS NULL ORDER BY created_at ASC',
    []
  );
}
