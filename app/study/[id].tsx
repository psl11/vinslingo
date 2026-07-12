import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, Platform } from 'react-native';
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
import { colors, radius, spacing, fontSize, fontWeight } from '../../constants/theme';

export default function StudyScreen() {
  const { id, categories, mode, limit, particle, scope, artistId, songId, musicCategory, top } = useLocalSearchParams<{ id: string; categories?: string; mode?: string; limit?: string; particle?: string; scope?: string; artistId?: string; songId?: string; musicCategory?: string; top?: string }>();
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
        
        const { getVocabularyForLesson, getDueVocabulary, getVocabularyByParticle, getMostFailedVocabulary } = await import('../../lib/services/vocabularyService');

        let cards;
        if (id === 'review') {
          cards = await getDueVocabulary(cardLimit, selectedCEFRLevels, selectedReviewCategories);
        } else if (id === 'failed') {
          // Cuestionario de "palabras más falladas". El scope refleja el toggle
          // de la pantalla de listado (todas / solo no dominadas).
          cards = await getMostFailedVocabulary({
            limit: cardLimit,
            cefrLevels: selectedCEFRLevels,
            onlyNotMastered: scope === 'notmastered',
          });
        } else if (particle) {
          cards = await getVocabularyByParticle(particle, cardLimit, selectedCEFRLevels);
        } else if (id === 'music') {
          // "Aprende con tu música": vocabulario que aparece en tus canciones,
          // filtrado por artista / categoría / canción, o top recurrentes.
          const { getMusicVocabulary } = await import('../../lib/services/musicService');
          cards = await getMusicVocabulary({
            artistId, songId, category: musicCategory, top: top === '1',
            cefrLevels: selectedCEFRLevels, limit: cardLimit,
          });
        } else {
          cards = await getVocabularyForLesson(id || 'ngsl', cardLimit, selectedCEFRLevels);
        }

        if (cards.length > 0) {
          startSession(id === 'review' || id === 'failed' ? 'review' : 'lesson', cards);
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
  }, [id, particle, scope, artistId, songId, musicCategory, top, selectedCEFRLevels, selectedReviewCategories]);

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

  // Atajos de teclado (solo web/desktop): valorar la tarjeta ya volteada.
  // 1/2/3/4 = Otra vez/Difícil/Bien/Fácil; Espacio o Enter = Bien (respuesta
  // más común). El volteo (Espacio con la tarjeta sin girar) lo maneja FlashCard.
  // Refs para no re-suscribir el listener en cada render y evitar closures viejas.
  const handleAnswerRef = useRef(handleAnswer);
  handleAnswerRef.current = handleAnswer;
  const isFlippedRef = useRef(isFlipped);
  isFlippedRef.current = isFlipped;
  const isRetryRef = useRef(isRetry);
  isRetryRef.current = isRetry;

  useEffect(() => {
    if (Platform.OS !== 'web' || isTypingMode) return;
    const KEY_QUALITY: Record<string, SimpleQuality> = {
      '1': 'again',
      '2': 'hard',
      '3': 'good',
      '4': 'easy',
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isFlippedRef.current) return; // sin girar: el flip lo maneja FlashCard
      let quality: SimpleQuality | undefined = KEY_QUALITY[e.key];
      if (!quality && (e.code === 'Space' || e.key === 'Enter')) quality = 'good';
      if (!quality) return;
      // En retry solo se muestran Otra vez/Bien: ignorar Difícil/Fácil.
      if (isRetryRef.current && (quality === 'hard' || quality === 'easy')) return;
      e.preventDefault();
      handleAnswerRef.current(quality);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isTypingMode]);

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
        <Pressable onPress={handleClose} style={styles.closeButton} hitSlop={12}>
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
    backgroundColor: colors.screen,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xxxl,
    marginBottom: spacing.xxl,
  },
  backButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  backButtonText: {
    color: colors.onPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  closeText: {
    fontSize: fontSize.xl,
    color: colors.textSecondary,
  },
  progressContainer: {
    flex: 1,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    // En pantallas anchas (desktop) la tarjeta se centra y se limita a un ancho
    // cómodo de lectura en vez de estirarse a toda la banda. Los botones de
    // respuesta comparten el mismo tope para quedar alineados con la tarjeta.
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  answersContainer: {
    paddingVertical: spacing.xxl,
    minHeight: 100,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  flipHint: {
    textAlign: 'center',
    fontSize: fontSize.md,
    color: colors.textTertiary,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxxl,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xxl,
  },
  summaryStats: {
    width: '100%',
    marginBottom: spacing.xxl,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  summaryLabel: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  correctValue: {
    color: '#10B981',
  },
  incorrectValue: {
    color: '#EF4444',
  },
  xpValue: {
    color: colors.warning,
  },
  finishButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    width: '100%',
    alignItems: 'center',
  },
  finishButtonText: {
    color: colors.onPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
