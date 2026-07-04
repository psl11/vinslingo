import { supabase } from '../supabase';
import { runQuery, runStatement } from '../database/client';
import { getStudyStats, StudyStats, addToSyncQueue } from '../database/queries';
import * as Network from 'expo-network';

async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return !!(state.isConnected && state.isInternetReachable);
  } catch {
    return false;
  }
}

export interface UserProgress {
  totalXp: number;
  wordsStudied: number;
  wordsLearning: number;
  wordsMastered: number;
  currentStreak: number;
  longestStreak: number;
  accuracy: number;
  todayXp: number;
  todayCards: number;
}

// Sync a single vocabulary progress to Supabase
export async function syncVocabularyProgress(
  vocabularyId: string,
  data: {
    easeFactor: number;
    interval: number;
    repetitions: number;
    nextReviewAt: number;
    isCorrect: boolean;
  }
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('⚠️ No authenticated user, skipping Supabase sync');
      return;
    }

    // Check if record exists in Supabase
    const { data: existing } = await supabase
      .from('user_vocabulary')
      .select('id, times_correct, times_incorrect')
      .eq('user_id', user.id)
      .eq('vocabulary_id', vocabularyId)
      .single();

    const now = new Date().toISOString();

    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from('user_vocabulary')
        .update({
          ease_factor: data.easeFactor,
          interval_days: data.interval,
          repetitions: data.repetitions,
          next_review_at: new Date(data.nextReviewAt).toISOString(),
          last_reviewed_at: now,
          times_correct: existing.times_correct + (data.isCorrect ? 1 : 0),
          times_incorrect: existing.times_incorrect + (data.isCorrect ? 0 : 1),
          mastery_level: calculateMasteryLevel(data.repetitions, data.interval),
          updated_at: now,
        })
        .eq('id', existing.id);

      if (error) throw error;
      console.log('☁️ Updated vocabulary progress in Supabase');
    } else {
      // Insert new record
      const { error } = await supabase
        .from('user_vocabulary')
        .insert({
          user_id: user.id,
          vocabulary_id: vocabularyId,
          ease_factor: data.easeFactor,
          interval_days: data.interval,
          repetitions: data.repetitions,
          next_review_at: new Date(data.nextReviewAt).toISOString(),
          last_reviewed_at: now,
          times_correct: data.isCorrect ? 1 : 0,
          times_incorrect: data.isCorrect ? 0 : 1,
          mastery_level: calculateMasteryLevel(data.repetitions, data.interval),
        });

      if (error) throw error;
      console.log('☁️ Inserted vocabulary progress in Supabase');
    }
  } catch (error) {
    console.error('❌ Error syncing to Supabase, queuing for later:', error);
    // Queue for later sync
    try {
      await addToSyncQueue('user_vocabulary', vocabularyId, 'UPDATE', {
        vocabulary_id: vocabularyId,
        ease_factor: data.easeFactor,
        interval_days: data.interval,
        repetitions: data.repetitions,
        next_review_at: new Date(data.nextReviewAt).toISOString(),
        last_reviewed_at: new Date().toISOString(),
        times_correct_delta: data.isCorrect ? 1 : 0,
        times_incorrect_delta: data.isCorrect ? 0 : 1,
        mastery_level: calculateMasteryLevel(data.repetitions, data.interval),
      });
      console.log('📥 Queued vocabulary progress for later sync');
    } catch (queueError) {
      console.error('❌ Failed to queue sync:', queueError);
    }
  }
}

// Update user XP in Supabase profiles
export async function addUserXp(xpAmount: number): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Intento 1: RPC atómico (ver supabase/migrations/001_increment_xp.sql).
    // Evita la carrera del patrón leer-luego-escribir si hay dos sesiones a la vez.
    const { error: rpcError } = await supabase.rpc('increment_xp', { amount: xpAmount });
    if (!rpcError) {
      console.log(`☁️ Updated XP atomically (+${xpAmount})`);
      return;
    }

    // Fallback si el RPC no está desplegado aún: leer-luego-escribir.
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_xp')
      .eq('id', user.id)
      .single();

    const currentXp = profile?.total_xp || 0;
    const newXp = currentXp + xpAmount;

    // Update XP
    const { error } = await supabase
      .from('profiles')
      .update({
        total_xp: newXp,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) throw error;
    console.log(`☁️ Updated XP: ${currentXp} → ${newXp} (+${xpAmount})`);
  } catch (error) {
    console.error('❌ Error updating XP:', error);
  }
}

// Get complete user progress (offline-first: tries Supabase, falls back to local SQLite)
export async function getUserProgress(): Promise<UserProgress | null> {
  try {
    const online = await isOnline();

    if (online) {
      try {
        return await getUserProgressFromSupabase();
      } catch (err) {
        console.log('📊 Supabase failed, falling back to local:', err);
      }
    }

    // Offline or Supabase failed — read from local SQLite
    return await getUserProgressFromLocal();
  } catch (error) {
    console.error('❌ Error getting user progress:', error);
    return null;
  }
}

async function getUserProgressFromSupabase(): Promise<UserProgress | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('total_xp, current_streak, longest_streak')
    .eq('id', user.id)
    .single();

  const { data: vocabStats } = await supabase
    .from('user_vocabulary')
    .select('mastery_level, times_correct, times_incorrect')
    .eq('user_id', user.id);

  const stats = vocabStats || [];
  const totalWords = stats.length;
  const wordsLearning = stats.filter(v => v.mastery_level === 1).length;
  const wordsMastered = stats.filter(v => v.mastery_level >= 3).length;

  const totalCorrect = stats.reduce((sum, v) => sum + (v.times_correct || 0), 0);
  const totalAttempts = stats.reduce((sum, v) => sum + (v.times_correct || 0) + (v.times_incorrect || 0), 0);
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: todayStats } = await supabase
    .from('user_vocabulary')
    .select('id')
    .eq('user_id', user.id)
    .gte('last_reviewed_at', today.toISOString());

  return {
    totalXp: profile?.total_xp || 0,
    wordsStudied: totalWords,
    wordsLearning,
    wordsMastered,
    currentStreak: profile?.current_streak || 0,
    longestStreak: profile?.longest_streak || 0,
    accuracy,
    todayXp: 0,
    todayCards: todayStats?.length || 0,
  };
}

async function getUserProgressFromLocal(): Promise<UserProgress> {
  const [totalResult] = await runQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM user_vocabulary'
  );
  const [learningResult] = await runQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM user_vocabulary WHERE mastery_level = 1'
  );
  const [masteredResult] = await runQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM user_vocabulary WHERE mastery_level >= 3'
  );
  const [accuracyResult] = await runQuery<{ total_correct: number; total_attempts: number }>(
    `SELECT 
      COALESCE(SUM(times_correct), 0) as total_correct, 
      COALESCE(SUM(times_correct + times_incorrect), 0) as total_attempts 
     FROM user_vocabulary`
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [todayResult] = await runQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM user_vocabulary WHERE last_reviewed_at >= ?',
    [todayStart.getTime()]
  );

  const totalAttempts = accuracyResult?.total_attempts ?? 0;
  const totalCorrect = accuracyResult?.total_correct ?? 0;

  return {
    totalXp: 0,
    wordsStudied: totalResult?.count ?? 0,
    wordsLearning: learningResult?.count ?? 0,
    wordsMastered: masteredResult?.count ?? 0,
    currentStreak: 0,
    longestStreak: 0,
    accuracy: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
    todayXp: 0,
    todayCards: todayResult?.count ?? 0,
  };
}

// Update user streak when they study.
// El último día de estudio se deriva de study_sessions (fuente fiable) en vez
// de profiles.updated_at, que cualquier otra actualización del perfil pisa.
// Debe llamarse DESPUÉS de insertar la sesión de estudio actual.
export async function updateStreak(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get current profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_streak, longest_streak')
      .eq('id', user.id)
      .single();

    if (!profile) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // ¿Cuántas sesiones lleva hoy? (la actual ya está insertada)
    const { count: sessionsToday } = await supabase
      .from('study_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('ended_at', today.toISOString());

    // Última sesión ANTES de hoy
    const { data: lastBefore } = await supabase
      .from('study_sessions')
      .select('ended_at')
      .eq('user_id', user.id)
      .lt('ended_at', today.toISOString())
      .order('ended_at', { ascending: false })
      .limit(1);

    let newStreak: number;

    if ((sessionsToday ?? 0) > 1) {
      // Ya había estudiado hoy - mantener racha
      newStreak = Math.max(1, profile.current_streak);
    } else if (lastBefore?.[0] && new Date(lastBefore[0].ended_at) >= yesterday) {
      // Estudió ayer - incrementar racha
      newStreak = profile.current_streak + 1;
    } else {
      // Primera sesión, o más de un día sin estudiar - racha empieza en 1
      newStreak = 1;
    }

    const newLongest = Math.max(newStreak, profile.longest_streak);

    await supabase
      .from('profiles')
      .update({
        current_streak: newStreak,
        longest_streak: newLongest,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    console.log(`🔥 Streak updated: ${profile.current_streak} → ${newStreak}`);
  } catch (error) {
    console.error('❌ Error updating streak:', error);
  }
}

// Save study session to Supabase
export async function saveStudySession(
  sessionType: 'lesson' | 'review' | 'practice',
  cardsStudied: number,
  cardsCorrect: number,
  durationSeconds: number,
  xpEarned: number
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('study_sessions')
      .insert({
        user_id: user.id,
        session_type: sessionType,
        cards_studied: cardsStudied,
        cards_correct: cardsCorrect,
        duration_seconds: durationSeconds,
        xp_earned: xpEarned,
        ended_at: new Date().toISOString(),
      });

    if (error) throw error;
    console.log('☁️ Study session saved to Supabase');

    // updateStreak debe correr después del insert de la sesión (cuenta las
    // sesiones de hoy, incluida la actual, para decidir si incrementa).
    await updateStreak();

    // Update user's total XP
    await addUserXp(xpEarned);
  } catch (error) {
    console.error('❌ Error saving study session, queuing for later:', error);
    // Queue for later sync
    try {
      const sessionId = `offline_${Date.now()}`;
      await addToSyncQueue('study_sessions', sessionId, 'INSERT', {
        session_type: sessionType,
        cards_studied: cardsStudied,
        cards_correct: cardsCorrect,
        duration_seconds: durationSeconds,
        xp_earned: xpEarned,
        ended_at: new Date().toISOString(),
      });
      // Also queue XP update
      await addToSyncQueue('profiles', 'xp_update', 'UPDATE', {
        xp_delta: xpEarned,
      });
      console.log('📥 Queued study session for later sync');
    } catch (queueError) {
      console.error('❌ Failed to queue session sync:', queueError);
    }
  }
}

// Get review stats for Review screen (offline-first: reads from local SQLite)
export async function getReviewStats(): Promise<{
  dueToday: number;
  overdue: number;
  newToday: number;
  learned: number;
}> {
  try {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Read from local SQLite (works offline)
    const [learnedResult] = await runQuery<{ count: number }>(
      'SELECT COUNT(*) as count FROM user_vocabulary'
    );

    const [dueTodayResult] = await runQuery<{ count: number }>(
      'SELECT COUNT(*) as count FROM user_vocabulary WHERE next_review_at IS NOT NULL AND next_review_at <= ?',
      [todayEnd.getTime()]
    );

    const [overdueResult] = await runQuery<{ count: number }>(
      'SELECT COUNT(*) as count FROM user_vocabulary WHERE next_review_at IS NOT NULL AND next_review_at < ?',
      [todayStart.getTime()]
    );

    const [newTodayResult] = await runQuery<{ count: number }>(
      'SELECT COUNT(*) as count FROM user_vocabulary WHERE last_reviewed_at IS NOT NULL AND last_reviewed_at >= ? AND mastery_level <= 1',
      [todayStart.getTime()]
    );

    return {
      dueToday: dueTodayResult?.count ?? 0,
      overdue: overdueResult?.count ?? 0,
      newToday: newTodayResult?.count ?? 0,
      learned: learnedResult?.count ?? 0,
    };
  } catch (error) {
    console.error('Error getting review stats:', error);
    return { dueToday: 0, overdue: 0, newToday: 0, learned: 0 };
  }
}

// Helper function
function calculateMasteryLevel(repetitions: number, interval: number): number {
  if (repetitions === 0) return 0;
  if (interval < 7) return 1;
  if (interval < 30) return 2;
  return 3;
}
