import { useCallback } from 'react';
import { useStudyStore } from '../stores/useStudyStore';
import { useUserStore } from '../stores/useUserStore';
import { saveStudyResult, calculateSessionXP } from '../lib/services/studyService';
import { SimpleQuality } from '../lib/srs/sm2';

export function useStudySession() {
  const {
    currentSession,
    getCurrentCard,
    getSessionStats,
    answerCard,
    nextCard,
    endSession,
  } = useStudyStore();
  
  const { addXp, addCardsStudied, checkAndUpdateStreak, profile } = useUserStore();
  
  const handleAnswer = useCallback(async (quality: SimpleQuality, responseTimeMs: number) => {
    const card = getCurrentCard();
    if (!card) return null;
    
    const sm2Result = answerCard(quality, responseTimeMs);
    
    if (sm2Result && card.id) {
      // Guardar resultado en la base de datos local
      await saveStudyResult(card.id, sm2Result, quality !== 'again');
    }
    
    return sm2Result;
  }, [getCurrentCard, answerCard]);
  
  const finishSession = useCallback(() => {
    const session = endSession();
    if (!session) return null;
    
    const stats = getSessionStats();
    const result = calculateSessionXP(
      stats.correct,
      stats.total,
      profile?.currentStreak ?? 0
    );
    
    // Actualizar XP y estadísticas del usuario
    addXp(result.xpEarned + result.streakBonus);
    addCardsStudied(stats.total);
    checkAndUpdateStreak();
    
    return result;
  }, [endSession, getSessionStats, profile, addXp, addCardsStudied, checkAndUpdateStreak]);
  
  return {
    currentSession,
    currentCard: getCurrentCard(),
    stats: getSessionStats(),
    handleAnswer,
    nextCard,
    finishSession,
  };
}
