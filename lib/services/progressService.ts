import { supabase } from '../supabase';
import { runQuery, runStatement } from '../database/client';
import { getStudyStats, StudyStats } from '../database/queries';

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
    console.error('❌ Error syncing to Supabase:', error);
  }
}

// Update user XP in Supabase profiles
export async function addUserXp(xpAmount: number): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get current XP
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

// Get complete user progress from Supabase
export async function getUserProgress(): Promise<UserProgress | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_xp, current_streak, longest_streak')
      .eq('id', user.id)
      .single();

    // Get vocabulary stats from Supabase
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

    // Get today's stats
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
      todayXp: 0, // TODO: Track daily XP
      todayCards: todayStats?.length || 0,
    };
  } catch (error) {
    console.error('❌ Error getting user progress:', error);
    return null;
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

    // Also update user's total XP
    await addUserXp(xpEarned);
  } catch (error) {
    console.error('❌ Error saving study session:', error);
  }
}

// Helper function
function calculateMasteryLevel(repetitions: number, interval: number): number {
  if (repetitions === 0) return 0;
  if (interval < 7) return 1;
  if (interval < 30) return 2;
  return 3;
}
