import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView } from 'react-native';
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

  useEffect(() => {
    async function loadCards() {
      try {
        const { getVocabularyForLesson, getDueVocabulary } = await import('../../lib/services/vocabularyService');
        
        let cards;
        if (id === 'review') {
          cards = await getDueVocabulary(20);
        } else {
          // Usar la categoría como id de lección
          cards = await getVocabularyForLesson(id || 'ngsl', 20);
        }
        
        if (cards.length > 0) {
          startSession(id === 'review' ? 'review' : 'lesson', cards);
        }
      } catch (error) {
        console.error('Error loading cards:', error);
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

  const handleAnswer = (quality: SimpleQuality) => {
    const responseTimeMs = Date.now() - responseStart;
    answerCard(quality, responseTimeMs);
    setIsFlipped(false);
    
    // Check if session is complete
    const hasMore = nextCard();
    if (!hasMore) {
      router.back();
    }
  };

  const handleClose = () => {
    endSession();
    router.back();
  };

  if (!currentSession || !currentCard) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Cargando...</Text>
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
          word={currentCard.word}
          translation={currentCard.translation}
          pronunciation={currentCard.pronunciation}
          example={currentCard.example_sentence}
          exampleTranslation={currentCard.example_translation}
          onFlip={handleFlip}
        />
      </View>

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
});
