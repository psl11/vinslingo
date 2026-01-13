import { runQuery, runStatement, getOne, withTransaction } from './client';
import { generateUUID } from '../utils/uuid';

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
}

export async function getVocabularyByLevel(cefrLevel: string): Promise<VocabularyItem[]> {
  return runQuery<VocabularyItem>(
    'SELECT * FROM vocabulary WHERE cefr_level = ? ORDER BY frequency_rank',
    [cefrLevel]
  );
}

export async function getVocabularyByCategory(category: string): Promise<VocabularyItem[]> {
  return runQuery<VocabularyItem>(
    'SELECT * FROM vocabulary WHERE category = ? ORDER BY frequency_rank',
    [category]
  );
}

export async function getVocabularyForReview(limit: number = 20): Promise<VocabularyItem[]> {
  const now = Date.now();
  return runQuery<VocabularyItem>(
    `SELECT v.* FROM vocabulary v
     INNER JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
     WHERE uv.next_review_at <= ? OR uv.next_review_at IS NULL
     ORDER BY uv.next_review_at ASC
     LIMIT ?`,
    [now, limit]
  );
}

export async function getNewVocabulary(limit: number = 10): Promise<VocabularyItem[]> {
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
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_at?: number;
  last_reviewed_at?: number;
  times_correct: number;
  times_incorrect: number;
  mastery_level: number;
  needs_sync: number;
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
    easeFactor: number;
    interval: number;
    repetitions: number;
    nextReviewAt: number;
    isCorrect: boolean;
  }
): Promise<void> {
  const now = Date.now();
  const userVocab = await getUserVocabulary(vocabularyId);
  
  if (!userVocab) {
    // Crear nuevo registro
    const id = generateUUID();
    await runStatement(
      `INSERT INTO user_vocabulary (
        id, vocabulary_id, ease_factor, interval_days, repetitions,
        next_review_at, last_reviewed_at, times_correct, times_incorrect,
        mastery_level, updated_at, needs_sync
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id, vocabularyId, data.easeFactor, data.interval, data.repetitions,
        data.nextReviewAt, now, data.isCorrect ? 1 : 0, data.isCorrect ? 0 : 1,
        calculateMasteryLevel(data.repetitions, data.interval), now
      ]
    );
  } else {
    // Actualizar registro existente
    const timesCorrect = userVocab.times_correct + (data.isCorrect ? 1 : 0);
    const timesIncorrect = userVocab.times_incorrect + (data.isCorrect ? 0 : 1);
    const masteryLevel = calculateMasteryLevel(data.repetitions, data.interval);
    
    await runStatement(
      `UPDATE user_vocabulary SET
        ease_factor = ?, interval_days = ?, repetitions = ?,
        next_review_at = ?, last_reviewed_at = ?,
        times_correct = ?, times_incorrect = ?,
        mastery_level = ?, updated_at = ?, needs_sync = 1
      WHERE vocabulary_id = ?`,
      [
        data.easeFactor, data.interval, data.repetitions,
        data.nextReviewAt, now, timesCorrect, timesIncorrect,
        masteryLevel, now, vocabularyId
      ]
    );
  }
}

function calculateMasteryLevel(repetitions: number, interval: number): number {
  // 0 = new, 1 = learning, 2 = reviewing, 3 = mastered
  if (repetitions === 0) return 0;
  if (interval < 7) return 1;
  if (interval < 30) return 2;
  return 3;
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
    'SELECT COUNT(*) as count FROM user_vocabulary WHERE next_review_at <= ?',
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

export async function getPendingSyncItems(): Promise<any[]> {
  return runQuery(
    'SELECT * FROM sync_queue WHERE synced_at IS NULL ORDER BY created_at ASC',
    []
  );
}
