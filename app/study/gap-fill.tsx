import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { GapFillCard } from '../../components/cards/GapFillCard';
import { WordFormationCard } from '../../components/cards/WordFormationCard';
import { KeyWordTransformCard } from '../../components/cards/KeyWordTransformCard';
import { ErrorCorrectionCard } from '../../components/cards/ErrorCorrectionCard';
import { getGapFillExercises, getGapFillMistakes, updateGapFillProgress, GapFillExercise } from '../../lib/database/queries';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useUserStore } from '../../stores/useUserStore';
import { colors, radius, spacing, fontSize, fontWeight } from '../../constants/theme';
import { ProgressBar } from '../../components/ui/ProgressBar';

type GapFillMode = 'choose' | 'type' | null;

const CATEGORY_CONFIG: Record<string, { emoji: string; title: string; subtitle: string; description: string; hasModeSelect: boolean }> = {
  connector: {
    emoji: '🧩', title: 'Rellenar Huecos', subtitle: 'Conectores — Estilo Cambridge',
    description: 'Completa las frases con el conector correcto.\n¿Cómo quieres practicar?',
    hasModeSelect: true,
  },
  word_formation: {
    emoji: '🔤', title: 'Word Formation', subtitle: 'Part 3 — Estilo Cambridge',
    description: 'Transforma la palabra base para que encaje en la frase.\n¿Cómo quieres practicar?',
    hasModeSelect: true,
  },
  key_word_transformation: {
    emoji: '🔑', title: 'Key Word Transformation', subtitle: 'Part 4 — Estilo Cambridge',
    description: 'Reescribe la frase usando la palabra clave dada.',
    hasModeSelect: false,
  },
  error_correction: {
    emoji: '🔍', title: 'Error Correction', subtitle: 'Errores comunes — Estilo Cambridge',
    description: 'Encuentra y corrige el error en cada frase.',
    hasModeSelect: false,
  },
  open_cloze: {
    emoji: '📝', title: 'Open Cloze', subtitle: 'Part 2 — Estilo Cambridge',
    description: 'Escribe la palabra que falta. Sin opciones, solo gramática pura.',
    hasModeSelect: false,
  },
  phrasal_particle: {
    emoji: '🚀', title: 'Rellena la partícula', subtitle: 'Phrasal Verbs',
    description: 'El verbo está; elige la partícula correcta (up, off, on...).\nEs la que cambia el significado. ¿Cómo quieres practicar?',
    hasModeSelect: true,
  },
};

export default function GapFillScreen() {
  const router = useRouter();
  const { category, limit, source, reviewMistakes } = useLocalSearchParams<{ category?: string; limit?: string; source?: string; reviewMistakes?: string }>();
  const { selectedCEFRLevels } = useSettingsStore();
  const { addXp, addCardsStudied, checkAndUpdateStreak } = useUserStore();

  const [mode, setMode] = useState<GapFillMode>(null);
  const [exercises, setExercises] = useState<GapFillExercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [cardKey, setCardKey] = useState(0);

  const cardLimit = limit ? parseInt(limit, 10) : 15;
  const categoryId = category || 'connector';

  const sourceFilter = (source as 'all' | 'official' | 'custom') || 'all';
  const isMistakesMode = reviewMistakes === '1';

  const loadExercises = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = isMistakesMode
        ? await getGapFillMistakes(cardLimit)
        : await getGapFillExercises(categoryId, cardLimit, selectedCEFRLevels, sourceFilter);
      setExercises(data);
    } catch (error) {
      console.error('Error loading gap-fill exercises:', error);
    } finally {
      setIsLoading(false);
    }
  }, [categoryId, cardLimit, selectedCEFRLevels, sourceFilter, isMistakesMode]);

  const config = CATEGORY_CONFIG[categoryId] || CATEGORY_CONFIG.connector;

  useEffect(() => {
    // In mistakes mode, load immediately. Otherwise respect mode select.
    if (isMistakesMode || mode || !config.hasModeSelect) {
      loadExercises();
    }
  }, [mode, config.hasModeSelect, loadExercises, isMistakesMode]);

  const handleResult = async (isCorrect: boolean) => {
    const exercise = exercises[currentIndex];
    if (!exercise) return;

    await updateGapFillProgress(exercise.id, isCorrect);
    setResults(prev => [...prev, isCorrect]);

    // Update streak BEFORE addXp (which sets lastStudyDate = today)
    checkAndUpdateStreak();
    if (isCorrect) {
      addXp(10);
    }
    addCardsStudied(1);

    const nextIndex = currentIndex + 1;
    if (nextIndex >= exercises.length) {
      setShowSummary(true);
    } else {
      setCurrentIndex(nextIndex);
      setCardKey(prev => prev + 1);
    }
  };

  // Mode selection screen (only for categories that have it, skip in mistakes mode)
  if (!isMistakesMode && !mode && config.hasModeSelect) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.modeSelectContainer}>
          <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backButtonText}>← Volver</Text>
          </Pressable>

          <Text style={styles.modeTitle}>{config.emoji} {config.title}</Text>
          <Text style={styles.modeSubtitle}>{config.subtitle}</Text>
          <Text style={styles.modeDescription}>{config.description}</Text>

          <View style={styles.modeCards}>
            <Pressable
              style={styles.modeCard}
              onPress={() => setMode('choose')}
            >
              <Text style={styles.modeCardEmoji}>🔘</Text>
              <Text style={styles.modeCardTitle}>Elegir opción</Text>
              <Text style={styles.modeCardDesc}>
                Elige entre 4 opciones
              </Text>
            </Pressable>

            <Pressable
              style={[styles.modeCard, styles.modeCardTyping]}
              onPress={() => setMode('type')}
            >
              <Text style={styles.modeCardEmoji}>✏️</Text>
              <Text style={styles.modeCardTitle}>Escribir</Text>
              <Text style={styles.modeCardDesc}>
                Escribe tú la respuesta
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Cargando ejercicios...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // No exercises
  if (exercises.length === 0 && !isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyEmoji}>{isMistakesMode ? '✅' : '📭'}</Text>
          <Text style={styles.emptyText}>
            {isMistakesMode
              ? '¡No tienes errores pendientes! Sigue practicando.'
              : 'No hay ejercicios disponibles para esta categoría.'}
          </Text>
          <Pressable style={styles.backButtonLarge} onPress={() => router.back()}>
            <Text style={styles.backButtonLargeText}>Volver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Summary screen
  if (showSummary) {
    const correct = results.filter(Boolean).length;
    const total = results.length;
    const percentage = Math.round((correct / total) * 100);

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryEmoji}>
            {percentage >= 80 ? '🎉' : percentage >= 50 ? '👍' : '💪'}
          </Text>
          <Text style={styles.summaryTitle}>¡Sesión completada!</Text>
          <Text style={styles.summaryScore}>{correct}/{total} correctas</Text>
          <Text style={styles.summaryPercent}>{percentage}%</Text>

          <View style={styles.summaryBar}>
            <View style={[styles.summaryBarFill, { width: `${percentage}%` }]} />
          </View>

          <Pressable
            style={styles.summaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.summaryButtonText}>Finalizar</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Exercise screen
  const currentExercise = exercises[currentIndex];
  // In mistakes mode, use exercise's own category; otherwise use URL param
  const exerciseCategory = isMistakesMode ? currentExercise.category : categoryId;
  // For mode-select categories, use chosen mode; for others, determine automatically
  const effectiveMode = mode || (exerciseCategory === 'error_correction' ? 'choose' : 'type');
  const options = effectiveMode === 'choose'
    ? JSON.parse(currentExercise.options || '[]') as string[]
    : undefined;

  const renderCard = () => {
    switch (exerciseCategory) {
      case 'word_formation':
        return (
          <WordFormationCard
            key={cardKey}
            sentence={currentExercise.sentence}
            answer={currentExercise.answer}
            baseWord={currentExercise.base_word || ''}
            options={options}
            explanation={currentExercise.explanation}
            explanationEs={currentExercise.explanation_es}
            cefrLevel={currentExercise.cefr_level}
            answerEs={currentExercise.answer_es}
            onResult={handleResult}
          />
        );
      case 'key_word_transformation':
        return (
          <KeyWordTransformCard
            key={cardKey}
            originalSentence={currentExercise.context_sentence || ''}
            targetSentence={currentExercise.sentence}
            keyword={currentExercise.base_word || ''}
            answer={currentExercise.answer}
            explanation={currentExercise.explanation}
            explanationEs={currentExercise.explanation_es}
            cefrLevel={currentExercise.cefr_level}
            answerEs={currentExercise.answer_es}
            onResult={handleResult}
          />
        );
      case 'error_correction':
        return (
          <ErrorCorrectionCard
            key={cardKey}
            sentence={currentExercise.sentence}
            correctedSentence={currentExercise.answer}
            errorPhrase={currentExercise.base_word || ''}
            correction={currentExercise.context_sentence || ''}
            options={options}
            explanation={currentExercise.explanation}
            explanationEs={currentExercise.explanation_es}
            cefrLevel={currentExercise.cefr_level}
            answerEs={currentExercise.answer_es}
            onResult={handleResult}
          />
        );
      default: // connector
        return (
          <GapFillCard
            key={cardKey}
            sentence={currentExercise.sentence}
            answer={currentExercise.answer}
            options={options}
            explanation={currentExercise.explanation}
            explanationEs={currentExercise.explanation_es}
            cefrLevel={currentExercise.cefr_level}
            answerEs={currentExercise.answer_es}
            baseWord={currentExercise.base_word || undefined}
            onResult={handleResult}
          />
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.studyContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.closeButton}>✕</Text>
          </Pressable>
          <View style={styles.progressWrapper}>
            <ProgressBar
              current={currentIndex}
              total={exercises.length}
            />
          </View>
          <Text style={styles.counter}>
            {currentIndex + 1}/{exercises.length}
          </Text>
        </View>

        {/* Card */}
        <View style={styles.cardContainer}>
          {renderCard()}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  // Mode selection
  modeSelectContainer: {
    flex: 1,
    padding: spacing.xxl,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.xxl,
  },
  backButtonText: {
    fontSize: fontSize.md,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  modeTitle: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.extrabold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  modeSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  modeDescription: {
    fontSize: fontSize.md,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xxxl,
  },
  modeCards: {
    gap: spacing.lg,
  },
  modeCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 2,
    borderColor: colors.border,
  },
  modeCardTyping: {
    borderColor: '#C7D2FE',
    backgroundColor: '#FAFBFF',
  },
  modeCardEmoji: {
    fontSize: 36,
    marginBottom: spacing.md,
  },
  modeCardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  modeCardDesc: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  backButtonLarge: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  backButtonLargeText: {
    color: colors.onPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  // Study
  studyContainer: {
    flex: 1,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  closeButton: {
    fontSize: fontSize.xxl,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
  progressWrapper: {
    flex: 1,
  },
  counter: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  // Summary
  summaryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
  },
  summaryEmoji: {
    fontSize: 56,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  summaryScore: {
    fontSize: fontSize.lg,
    color: '#4B5563',
    marginBottom: spacing.xs,
  },
  summaryPercent: {
    fontSize: 36,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
    marginBottom: spacing.xl,
  },
  summaryBar: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
    marginBottom: spacing.xxxl,
    overflow: 'hidden',
  },
  summaryBarFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  summaryButton: {
    paddingVertical: spacing.lg,
    paddingHorizontal: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  summaryButtonText: {
    color: colors.onPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
