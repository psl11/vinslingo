import { updateUserVocabularyAfterReview, getStudyStats } from '../database/queries';
import { SM2Result } from '../srs/sm2';

export async function saveStudyResult(
  vocabularyId: string,
  sm2Result: SM2Result,
  isCorrect: boolean
): Promise<void> {
  await updateUserVocabularyAfterReview(vocabularyId, {
    easeFactor: sm2Result.easeFactor,
    interval: sm2Result.interval,
    repetitions: sm2Result.repetitions,
    nextReviewAt: sm2Result.nextReviewAt.getTime(),
    isCorrect,
  });
}

export async function getStudyProgress() {
  return getStudyStats();
}

export interface StudySessionResult {
  totalCards: number;
  correctCards: number;
  incorrectCards: number;
  accuracy: number;
  xpEarned: number;
  streakBonus: number;
}

export function calculateSessionXP(
  correctCards: number,
  totalCards: number,
  currentStreak: number
): StudySessionResult {
  const baseXP = correctCards * 10;
  const accuracyBonus = Math.round((correctCards / totalCards) * 20);
  const streakMultiplier = Math.min(1 + currentStreak * 0.1, 2); // Max 2x
  const streakBonus = Math.round(baseXP * (streakMultiplier - 1));
  
  return {
    totalCards,
    correctCards,
    incorrectCards: totalCards - correctCards,
    accuracy: Math.round((correctCards / totalCards) * 100),
    xpEarned: baseXP + accuracyBonus,
    streakBonus,
  };
}
