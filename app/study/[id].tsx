import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, Alert, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlashCard } from '../../components/cards/FlashCard';
import { AnswerButtons } from '../../components/cards/AnswerButtons';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useStudyStore } from '../../stores/useStudyStore';
import { SimpleQuality, getEstimatedIntervals } from '../../lib/srs/sm2';

export default function StudyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
  } = useStudyStore();

  const currentCard = getCurrentCard();
  const stats = getSessionStats();
  const currentIndex = currentSession?.currentIndex ?? 0;

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
        
        const { getVocabularyForLesson, getDueVocabulary } = await import('../../lib/services/vocabularyService');
        
        let cards;
        if (id === 'review') {
          cards = await getDueVocabulary(20);
        } else {
          cards = await getVocabularyForLesson(id || 'ngsl', 20);
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
  }, [id]);

  const handleFlip = (flipped: boolean) => {
    setIsFlipped(flipped);
    if (flipped) {
      setResponseStart(Date.now());
    }
  };

  const handleAnswer = async (quality: SimpleQuality) => {
    const responseTimeMs = Date.now() - responseStart;
    
    // Save progress for this card to database
    await saveCardProgress(quality);
    
    // Update session state
    answerCard(quality, responseTimeMs);
    setIsFlipped(false);
    
    // Check if session is complete
    const hasMore = nextCard();
    if (!hasMore) {
      setShowSummary(true);
    }
  };

  const saveCardProgress = async (quality: SimpleQuality) => {
    if (!currentCard) return;
    try {
      const { updateUserVocabularyAfterReview, createUserVocabulary, getUserVocabulary } = await import('../../lib/database/queries');
      const { calculateSM2 } = await import('../../lib/srs/sm2');
      
      // Convert SimpleQuality to number for SM2
      const qualityMap: Record<SimpleQuality, number> = {
        'again': 0,
        'hard': 2,
        'good': 3,
        'easy': 5,
      };
      const qualityNum = qualityMap[quality];
      
      const sm2Result = calculateSM2({
        easeFactor: currentCard.easeFactor ?? 2.5,
        interval: currentCard.interval ?? 0,
        repetitions: currentCard.repetitions ?? 0,
      }, qualityNum as 0 | 1 | 2 | 3 | 4 | 5);
      
      // Check if user_vocabulary exists, create if not
      const existing = await getUserVocabulary(currentCard.id);
      if (!existing) {
        await createUserVocabulary(currentCard.id);
      }
      
      await updateUserVocabularyAfterReview(currentCard.id, {
        easeFactor: sm2Result.easeFactor,
        interval: sm2Result.interval,
        repetitions: sm2Result.repetitions,
        nextReviewAt: sm2Result.nextReviewAt.getTime(),
        isCorrect: qualityNum >= 3,
      });
      
      console.log('💾 Saved progress for:', currentCard.word, '- Quality:', quality);
    } catch (error) {
      console.error('Error saving progress:', error);
    }
  };

  const saveAllProgress = async () => {
    console.log('💾 Session progress saved');
  };

  const handleClose = () => {
    Alert.alert(
      'Abandonar Lección',
      '¿Estás seguro de que quieres salir? Tu progreso hasta ahora se guardará.',
      [
        { text: 'Continuar', style: 'cancel' },
        {
          text: 'Abandonar',
          style: 'destructive',
          onPress: async () => {
            await saveAllProgress();
            endSession();
            router.back();
          },
        },
      ]
    );
  };

  const handleFinish = () => {
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
  const intervals = getEstimatedIntervals({
    easeFactor: currentCard.easeFactor ?? 2.5,
    interval: currentCard.interval ?? 0,
    repetitions: currentCard.repetitions ?? 0,
  });

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
        <FlashCard
          key={cardKey}
          word={currentCard.word}
          translation={currentCard.translation}
          pronunciation={currentCard.pronunciation}
          example={currentCard.example_sentence}
          exampleTranslation={currentCard.example_translation}
          onFlip={handleFlip}
        />
      </View>

      {/* Summary Modal */}
      <Modal
        visible={showSummary}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalEmoji}>🎉</Text>
            <Text style={styles.modalTitle}>¡Sesión Completada!</Text>
            
            <View style={styles.summaryStats}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total de tarjetas:</Text>
                <Text style={styles.summaryValue}>{totalCards}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>✅ Correctas:</Text>
                <Text style={[styles.summaryValue, styles.correctValue]}>{stats.correct}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>❌ Incorrectas:</Text>
                <Text style={[styles.summaryValue, styles.incorrectValue]}>{stats.incorrect}</Text>
              </View>
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
      </Modal>

      {/* Answer Buttons - Only show when flipped */}
      <View style={styles.answersContainer}>
        {isFlipped ? (
          <AnswerButtons
            intervals={intervals}
            onAnswer={handleAnswer}
          />
        ) : (
          <Text style={styles.flipHint}>
            Toca la tarjeta para ver la respuesta
          </Text>
        )}
      </View>

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
  },
  answersContainer: {
    paddingVertical: 24,
    minHeight: 100,
    justifyContent: 'center',
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
