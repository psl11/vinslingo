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
    if (!user) {
      console.log('📊 getUserProgress: No authenticated user');
      return null;
    }
    
    console.log('📊 Loading progress for user:', user.id);

    // Get profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('total_xp, current_streak, longest_streak')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.log('📊 Profile error:', profileError.message);
    }
    console.log('📊 Profile data:', profile);

    // Get vocabulary stats from Supabase
    const { data: vocabStats, error: vocabError } = await supabase
      .from('user_vocabulary')
      .select('mastery_level, times_correct, times_incorrect')
      .eq('user_id', user.id);

    if (vocabError) {
      console.log('📊 Vocab error:', vocabError.message);
    }
    
    const stats = vocabStats || [];
    console.log('📊 Vocab stats count:', stats.length);
    
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

    const result = {
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
    
    console.log('📊 User progress result:', result);
    return result;
  } catch (error) {
    console.error('❌ Error getting user progress:', error);
    return null;
  }
}

// Update user streak when they study
export async function updateStreak(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get current profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_streak, longest_streak, updated_at')
      .eq('id', user.id)
      .single();

    if (!profile) return;

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastUpdate = profile.updated_at ? new Date(profile.updated_at) : null;
    const lastUpdateDay = lastUpdate ? new Date(lastUpdate) : null;
    if (lastUpdateDay) lastUpdateDay.setHours(0, 0, 0, 0);

    let newStreak = profile.current_streak;
    
    if (!lastUpdateDay || lastUpdateDay < yesterday) {
      // More than 1 day since last study - reset streak
      newStreak = 1;
    } else if (lastUpdateDay.getTime() === yesterday.getTime()) {
      // Studied yesterday - increment streak
      newStreak = profile.current_streak + 1;
    } else if (lastUpdateDay.getTime() === today.getTime()) {
      // Already studied today - keep streak
      newStreak = Math.max(1, profile.current_streak);
    } else {
      newStreak = 1;
    }

    const newLongest = Math.max(newStreak, profile.longest_streak);

    await supabase
      .from('profiles')
      .update({
        current_streak: newStreak,
        longest_streak: newLongest,
        updated_at: now.toISOString(),
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

    // Update user's total XP
    await addUserXp(xpEarned);
    
    // Update streak
    await updateStreak();
  } catch (error) {
    console.error('❌ Error saving study session:', error);
  }
}

// Get review stats for Review screen
export async function getReviewStats(): Promise<{
  dueToday: number;
  overdue: number;
  newToday: number;
  learned: number;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { dueToday: 0, overdue: 0, newToday: 0, learned: 0 };
    }

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Get all user vocabulary
    const { data: allVocab } = await supabase
      .from('user_vocabulary')
      .select('id, next_review_at, last_reviewed_at, mastery_level')
      .eq('user_id', user.id);

    const vocab = allVocab || [];
    
    // Calculate stats
    const learned = vocab.length;
    
    const dueToday = vocab.filter(v => {
      if (!v.next_review_at) return false;
      const reviewDate = new Date(v.next_review_at);
      return reviewDate <= todayEnd;
    }).length;
    
    const overdue = vocab.filter(v => {
      if (!v.next_review_at) return false;
      const reviewDate = new Date(v.next_review_at);
      return reviewDate < todayStart;
    }).length;

    // New today = studied for first time today
    const newToday = vocab.filter(v => {
      if (!v.last_reviewed_at) return false;
      const reviewDate = new Date(v.last_reviewed_at);
      return reviewDate >= todayStart && v.mastery_level <= 1;
    }).length;

    return { dueToday, overdue, newToday, learned };
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
