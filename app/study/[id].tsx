import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView } from 'react-native';
import { confirmAction } from '../../lib/utils/confirm';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlashCard } from '../../components/cards/FlashCard';
import { AnswerButtons } from '../../components/cards/AnswerButtons';
import { TypingCard } from '../../components/cards/TypingCard';
import type { MatchResult } from '../../lib/utils/fuzzyMatch';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useStudyStore } from '../../stores/useStudyStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useUserStore } from '../../stores/useUserStore';
import { SimpleQuality, getEstimatedIntervals, cardFromRow } from '../../lib/srs/fsrs';

export default function StudyScreen() {
  const { id, categories, mode, limit, particle } = useLocalSearchParams<{ id: string; categories?: string; mode?: string; limit?: string; particle?: string }>();
  // Memoizado: sin useMemo, `categories.split(',')` crea un array NUEVO en cada
  // render, y como está en las deps del useEffect de carga, éste se re-dispara
  // sin parar → "Maximum update depth exceeded" y la app se cuelga al repasar
  // por categoría.
  const selectedReviewCategories = useMemo(
    () => (categories ? categories.split(',') : undefined),
    [categories]
  );
  const isTypingMode = mode === 'typing';
  const cardLimit = limit ? parseInt(limit, 10) : 20;
  const router = useRouter();
  const [isFlipped, setIsFlipped] = useState(false);
  const [responseStart, setResponseStart] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [noCards, setNoCards] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [cardKey, setCardKey] = useState(0);

  const {
    currentSession,
    startSession,
    answerCard,
    nextCard,
    endSession,
    getCurrentCard,
    getSessionStats,
    isCurrentCardRetry,
  } = useStudyStore();
  
  const { selectedCEFRLevels } = useSettingsStore();
  const { addXp, addStudyTime, addCardsStudied, checkAndUpdateStreak } = useUserStore();

  const currentCard = getCurrentCard();
  const stats = getSessionStats();
  const currentIndex = currentSession?.currentIndex ?? 0;
  const isRetry = isCurrentCardRetry();

  // Reset flip state and force FlashCard remount when card changes
  useEffect(() => {
    setIsFlipped(false);
    setCardKey(prev => prev + 1);
  }, [currentIndex]);

  // Debug: log current card data
  useEffect(() => {
    if (currentCard) {
      console.log('📇 Current card:', { 
        word: currentCard.word, 
        translation: currentCard.translation 
      });
    }
  }, [currentCard]);

  useEffect(() => {
    async function loadCards() {
      try {
        setIsLoading(true);
        setNoCards(false);
        
        const { getVocabularyForLesson, getDueVocabulary, getVocabularyByParticle } = await import('../../lib/services/vocabularyService');

        let cards;
        if (id === 'review') {
          cards = await getDueVocabulary(cardLimit, selectedCEFRLevels, selectedReviewCategories);
        } else if (particle) {
          cards = await getVocabularyByParticle(particle, cardLimit, selectedCEFRLevels);
        } else {
          cards = await getVocabularyForLesson(id || 'ngsl', cardLimit, selectedCEFRLevels);
        }
        
        if (cards.length > 0) {
          startSession(id === 'review' ? 'review' : 'lesson', cards);
        } else {
          setNoCards(true);
        }
      } catch (error) {
        console.error('Error loading cards:', error);
        setNoCards(true);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadCards();
    
    return () => {
      endSession();
    };
  }, [id, particle, selectedCEFRLevels, selectedReviewCategories]);

  const handleFlip = (flipped: boolean) => {
    setIsFlipped(flipped);
    if (flipped) {
      setResponseStart(Date.now());
    }
  };

  // Handler for typing mode results — hints degrade SM2 quality
  const handleTypingResult = async (result: MatchResult, _userInput: string, hintsUsed: number) => {
    if (result === 'wrong') {
      await handleAnswer('again');
      return;
    }
    // Base quality for correct/close answers, then degrade by hints
    // exact + 0 hints = easy, exact + 1 hint = good, exact + 2+ hints = hard
    // close + 0 hints = good, close + 1+ hints = hard
    const baseMap: Record<string, SimpleQuality> = {
      'exact': 'easy',
      'close': 'good',
    };
    let quality = baseMap[result] ?? 'good';
    if (hintsUsed >= 2) {
      quality = 'hard';
    } else if (hintsUsed === 1) {
      quality = quality === 'easy' ? 'good' : 'hard';
    }
    await handleAnswer(quality);
  };

  const handleAnswer = async (quality: SimpleQuality) => {
    const responseTimeMs = Date.now() - responseStart;
    
    // Penalize retried cards: cap at 'good' and downgrade 'good' to 'hard'
    const effectiveQuality: SimpleQuality = isRetry && quality === 'good' ? 'hard' : quality;

    // Save progress for this card to database
    await saveCardProgress(effectiveQuality, responseTimeMs);
    
    // Update session state
    answerCard(effectiveQuality, responseTimeMs);
    setIsFlipped(false);
    
    // Check if session is complete
    const hasMore = nextCard();
    if (!hasMore) {
      setShowSummary(true);
    }
  };

  const saveCardProgress = async (quality: SimpleQuality, responseTimeMs: number) => {
    if (!currentCard) {
      console.log('⚠️ No current card to save');
      return;
    }

    try {
      console.log('💾 Saving progress for:', currentCard.word, '(ID:', currentCard.id, ')');

      const { updateUserVocabularyAfterReview } = await import('../../lib/database/queries');
      const { syncVocabularyProgress, syncPendingReviewLogs } = await import('../../lib/services/progressService');
      const { schedule, cardFromRow, cardToState, logToRow } = await import('../../lib/srs/fsrs');

      // Programa con FSRS a partir del estado actual de la tarjeta (o nueva).
      const now = new Date();
      const { card: nextCard, log } = schedule(cardFromRow(currentCard, now), quality, now);
      const state = cardToState(nextCard);
      // isCorrect se deriva de la etiqueta, NO del número de grado (en FSRS
      // Hard=2; usar `>= 3` marcaría "Difícil" como fallo). Ver docs.
      const isCorrect = quality !== 'again';

      // Guardar en SQLite local (incluye el registro en review_log)
      await updateUserVocabularyAfterReview(currentCard.id, {
        state,
        isCorrect,
        log: logToRow(log, responseTimeMs),
      });
      console.log('✅ Saved to local DB');

      // Sincronizar user_vocabulary y review_log a Supabase (el segundo
      // arrastra también el backlog offline pendiente, si lo hay)
      await syncVocabularyProgress(currentCard.id, { state, isCorrect });
      await syncPendingReviewLogs();
      console.log('✅ Synced to Supabase');
    } catch (error) {
      console.error('❌ Error saving progress:', error);
    }
  };

  const saveAllProgress = async () => {
    console.log('💾 Session progress saved');
  };

  const handleClose = () => {
    confirmAction({
      title: 'Abandonar Lección',
      message: '¿Estás seguro de que quieres salir? Tu progreso hasta ahora se guardará.',
      confirmText: 'Abandonar',
      cancelText: 'Continuar',
      destructive: true,
      onConfirm: async () => {
        await saveAllProgress();
        endSession();
        router.back();
      },
    });
  };

  const handleFinish = async () => {
    const sessionDuration = Math.round((Date.now() - (currentSession?.startedAt || Date.now())) / 1000);
    const xpEarned = stats.correct * 10;
    const studyMinutes = Math.max(1, Math.round(sessionDuration / 60));

    // Update streak BEFORE addXp (which sets lastStudyDate = today)
    checkAndUpdateStreak();
    addXp(xpEarned);
    addStudyTime(studyMinutes);
    addCardsStudied(stats.completed);

    // Save study session to Supabase
    try {
      const { saveStudySession } = await import('../../lib/services/progressService');
      
      await saveStudySession(
        currentSession?.type || 'lesson',
        stats.completed,
        stats.correct,
        sessionDuration,
        xpEarned
      );
      console.log('✅ Session saved to Supabase');
    } catch (error) {
      console.error('❌ Error saving session:', error);
    }
    
    setShowSummary(false);
    endSession();
    router.back();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Cargando tarjetas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (noCards) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={styles.emptyTitle}>
            {id === 'review' ? '¡Sin repasos pendientes!' : '¡Felicidades!'}
          </Text>
          <Text style={styles.emptyText}>
            {id === 'review' 
              ? 'No tienes tarjetas para repasar ahora. Estudia nuevas palabras para generar repasos.'
              : 'Has completado todas las tarjetas de esta categoría.'}
          </Text>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Volver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Show summary modal when session is complete
  if (showSummary && currentSession) {
    const uniqueCardIds = new Set(currentSession.results.map(r => r.cardId));
    const uniqueCards = uniqueCardIds.size;
    const totalAnswers = currentSession.results.length;
    const retriedCards = totalAnswers - uniqueCards;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalEmoji}>🎉</Text>
            <Text style={styles.modalTitle}>¡Sesión Completada!</Text>
            
            <View style={styles.summaryStats}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tarjetas estudiadas:</Text>
                <Text style={styles.summaryValue}>{uniqueCards}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>✅ Correctas:</Text>
                <Text style={[styles.summaryValue, styles.correctValue]}>{stats.correct}</Text>
              </View>
              {stats.incorrect > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>❌ Aún difíciles:</Text>
                  <Text style={[styles.summaryValue, styles.incorrectValue]}>{stats.incorrect}</Text>
                </View>
              )}
              {retriedCards > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>🔁 Repetidas:</Text>
                  <Text style={styles.summaryValue}>{retriedCards}</Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>⭐ XP ganado:</Text>
                <Text style={[styles.summaryValue, styles.xpValue]}>{stats.correct * 10}</Text>
              </View>
            </View>

            <Pressable style={styles.finishButton} onPress={handleFinish}>
              <Text style={styles.finishButtonText}>Continuar</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentSession || !currentCard) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Preparando sesión...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalCards = currentSession.cards.length;
  const intervals = getEstimatedIntervals(cardFromRow(currentCard));

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleClose} style={styles.closeButton}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <View style={styles.progressContainer}>
          <ProgressBar
            current={currentIndex + 1}
            total={totalCards}
            showLabel={true}
          />
        </View>
      </View>

      {/* Card Area */}
      <View style={styles.cardContainer}>
        {isTypingMode ? (
          <TypingCard
            key={cardKey}
            word={currentCard.word}
            translation={currentCard.translation}
            pronunciation={currentCard.pronunciation}
            category={currentCard.category}
            partOfSpeech={currentCard.part_of_speech}
            cefrLevel={currentCard.cefr_level}
            onResult={handleTypingResult}
          />
        ) : (
          <FlashCard
            key={cardKey}
            word={currentCard.word}
            translation={currentCard.translation}
            pronunciation={currentCard.pronunciation}
            example={currentCard.example_sentence}
            exampleTranslation={currentCard.example_translation}
            example2={currentCard.example_sentence_2}
            exampleTranslation2={currentCard.example_translation_2}
            songLyric={currentCard.song_lyric}
            songLyricTranslation={currentCard.song_lyric_translation}
            songTitle={currentCard.song_title}
            songArtist={currentCard.song_artist}
            anchorType={currentCard.anchor_type}
            anchorYear={currentCard.anchor_year}
            formalSynonym={currentCard.formal_synonym}
            separability={currentCard.separability}
            cefrLevel={currentCard.cefr_level}
            category={currentCard.category}
            onFlip={handleFlip}
          />
        )}
      </View>

      {/* Answer Buttons - Only show for flashcard mode when flipped */}
      {!isTypingMode && (
        <View style={styles.answersContainer}>
          {isFlipped ? (
            <AnswerButtons
              intervals={intervals}
              onAnswer={handleAnswer}
              isRetry={isRetry}
            />
          ) : (
            <Text style={styles.flipHint}>
              Toca la tarjeta para ver la respuesta
            </Text>
          )}
        </View>
      )}

      {/* Session Stats */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.correct}</Text>
          <Text style={styles.statLabel}>✓ Bien</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stats.incorrect}</Text>
          <Text style={styles.statLabel}>✗ Mal</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalCards - currentIndex - 1}</Text>
          <Text style={styles.statLabel}>Restantes</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#6B7280',
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  closeText: {
    fontSize: 20,
    color: '#6B7280',
  },
  progressContainer: {
    flex: 1,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    // En pantallas anchas (desktop) la tarjeta se centra y se limita a un ancho
    // cómodo de lectura en vez de estirarse a toda la banda. Los botones de
    // respuesta comparten el mismo tope para quedar alineados con la tarjeta.
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  answersContainer: {
    paddingVertical: 24,
    minHeight: 100,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  flipHint: {
    textAlign: 'center',
    fontSize: 16,
    color: '#9CA3AF',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 24,
  },
  summaryStats: {
    width: '100%',
    marginBottom: 24,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryLabel: {
    fontSize: 16,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  correctValue: {
    color: '#10B981',
  },
  incorrectValue: {
    color: '#EF4444',
  },
  xpValue: {
    color: '#F59E0B',
  },
  finishButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
