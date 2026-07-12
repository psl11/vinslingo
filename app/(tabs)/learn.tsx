import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { PressableScale } from '../../components/ui/PressableScale';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { useVocabularyStats } from '../../hooks/useVocabulary';
import { KNOWN_PARTICLES } from '../../lib/vocabulary/particleHints';
import { colors, radius, spacing, fontSize, fontWeight } from '../../constants/theme';

// Partículas con suficientes phrasal verbs para una sesión útil.
const PARTICLE_CHIPS = KNOWN_PARTICLES.slice(0, 9); // up, out, on, off, down, in, back, over, away

interface LessonCategory {
  id: string;
  title: string;
  emoji: string;
  description: string;
  totalWords: number;
  completedWords: number;
  cefrLevel: string;
}

const CARD_COUNT_OPTIONS = [5, 10, 15, 20];

type SourceFilter = 'all' | 'official' | 'custom';
const SOURCE_FILTERS: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'official', label: 'Cambridge' },
  { key: 'custom', label: 'Inventados' },
];

export default function LearnScreen() {
  const router = useRouter();
  const { stats, isLoading, refresh } = useVocabularyStats();
  const [cardsPerRound, setCardsPerRound] = useState(10);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );
  
  const categories: LessonCategory[] = [
    {
      id: 'ngsl',
      title: 'Vocabulario NGSL',
      emoji: '📖',
      description: 'Palabras más frecuentes del inglés',
      totalWords: stats?.byCategory.find(c => c.category === 'ngsl')?.count ?? 0,
      completedWords: stats?.learnedByCategory?.find(c => c.category === 'ngsl')?.count ?? 0,
      cefrLevel: 'A1-B1',
    },
    {
      id: 'phave',
      title: 'Phrasal Verbs',
      emoji: '🚀',
      description: 'Verbos compuestos esenciales',
      totalWords: stats?.byCategory.find(c => c.category === 'phave')?.count ?? 0,
      completedWords: stats?.learnedByCategory?.find(c => c.category === 'phave')?.count ?? 0,
      cefrLevel: 'A1-B2',
    },
    {
      id: 'idiom',
      title: 'Idioms',
      emoji: '💬',
      description: 'Expresiones idiomáticas más usadas',
      totalWords: stats?.byCategory.find(c => c.category === 'idiom')?.count ?? 0,
      completedWords: stats?.learnedByCategory?.find(c => c.category === 'idiom')?.count ?? 0,
      cefrLevel: 'B1-B2',
    },
    {
      id: 'connector',
      title: 'Connectors',
      emoji: '🔗',
      description: 'Conectores y palabras de enlace',
      totalWords: stats?.byCategory.find(c => c.category === 'connector')?.count ?? 0,
      completedWords: stats?.learnedByCategory?.find(c => c.category === 'connector')?.count ?? 0,
      cefrLevel: 'A1-B2',
    },
    {
      id: 'false_friend',
      title: 'False Friends',
      emoji: '🚨',
      description: 'Falsos amigos español-inglés',
      totalWords: stats?.byCategory.find(c => c.category === 'false_friend')?.count ?? 0,
      completedWords: stats?.learnedByCategory?.find(c => c.category === 'false_friend')?.count ?? 0,
      cefrLevel: 'A1-B2',
    },
    {
      id: 'expression',
      title: 'Everyday Expressions',
      emoji: '💬',
      description: 'Frases cotidianas imprescindibles',
      totalWords: stats?.byCategory.find(c => c.category === 'expression')?.count ?? 0,
      completedWords: stats?.learnedByCategory?.find(c => c.category === 'expression')?.count ?? 0,
      cefrLevel: 'A1-B1',
    },
    {
      id: 'confusing_pair',
      title: 'Confusing Pairs',
      emoji: '🔀',
      description: 'Pares de palabras que se confunden',
      totalWords: stats?.byCategory.find(c => c.category === 'confusing_pair')?.count ?? 0,
      completedWords: stats?.learnedByCategory?.find(c => c.category === 'confusing_pair')?.count ?? 0,
      cefrLevel: 'A1-B1',
    },
    {
      id: 'collocation',
      title: 'Collocations',
      emoji: '🧩',
      description: 'Combinaciones naturales de palabras',
      totalWords: stats?.byCategory.find(c => c.category === 'collocation')?.count ?? 0,
      completedWords: stats?.learnedByCategory?.find(c => c.category === 'collocation')?.count ?? 0,
      cefrLevel: 'A1-B2',
    },
    {
      id: 'british_slang',
      title: 'Slang británico',
      emoji: '🇬🇧',
      description: 'Jerga del día a día en UK',
      totalWords: stats?.byCategory.find(c => c.category === 'british_slang')?.count ?? 0,
      completedWords: stats?.learnedByCategory?.find(c => c.category === 'british_slang')?.count ?? 0,
      cefrLevel: 'B2',
    },
    {
      id: 'american_slang',
      title: 'Slang americano',
      emoji: '🇺🇸',
      description: 'Jerga del día a día en EE. UU.',
      totalWords: stats?.byCategory.find(c => c.category === 'american_slang')?.count ?? 0,
      completedWords: stats?.learnedByCategory?.find(c => c.category === 'american_slang')?.count ?? 0,
      cefrLevel: 'B2',
    },
  ];

  const handleStartLesson = (categoryId: string, typingMode = false) => {
    const params: Record<string, string> = { limit: String(cardsPerRound) };
    if (typingMode) params.mode = 'typing';
    router.push({
      pathname: `/study/${categoryId}`,
      params,
    });
  };

  const handleStartByParticle = (particle: string) => {
    router.push({
      pathname: '/study/phave',
      params: { particle, limit: String(cardsPerRound) },
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Cargando categorías...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Aprender</Text>
            <Text style={styles.subtitle}>
              {stats?.total ?? 0} palabras disponibles
            </Text>
          </View>
          <PressableScale 
            onPress={() => router.push('/search')} 
            style={styles.searchButton}
          >
            <Text style={styles.searchButtonText}>🔍</Text>
          </PressableScale>
        </View>
      </View>

      {/* Card count selector */}
      <View style={styles.cardCountSection}>
        <Text style={styles.cardCountLabel}>Tarjetas por ronda</Text>
        <View style={styles.cardCountRow}>
          {CARD_COUNT_OPTIONS.map((count) => (
            <PressableScale
              key={count}
              style={[
                styles.cardCountChip,
                cardsPerRound === count && styles.cardCountChipSelected,
              ]}
              onPress={() => setCardsPerRound(count)}
            >
              <Text style={[
                styles.cardCountText,
                cardsPerRound === count && styles.cardCountTextSelected,
              ]}>
                {count}
              </Text>
            </PressableScale>
          ))}
        </View>
      </View>

      {/* Acceso a "palabras más falladas": repaso de lo que más te cuesta. */}
      <PressableScale
        style={styles.failedCard}
        onPress={() => router.push('/failed-words')}
      >
        <Text style={styles.failedEmoji}>🔥</Text>
        <View style={styles.failedInfo}>
          <Text style={styles.failedTitle}>Palabras más falladas</Text>
          <Text style={styles.failedDescription}>
            Las que más se te resisten, ordenadas por fallos
          </Text>
        </View>
        <Text style={styles.failedChevron}>›</Text>
      </PressableScale>

      {/* Aprende con tu música: vocabulario que aparece en tus canciones. */}
      <PressableScale
        style={styles.musicCard}
        onPress={() => router.push('/music')}
      >
        <Text style={styles.failedEmoji}>🎵</Text>
        <View style={styles.failedInfo}>
          <Text style={styles.failedTitle}>Aprende con tu música</Text>
          <Text style={styles.failedDescription}>
            El vocabulario que aparece en tus canciones
          </Text>
        </View>
        <Text style={styles.musicChevron}>›</Text>
      </PressableScale>

      <View style={styles.categories}>
        {categories.map((category) => {
          const progress = category.totalWords > 0 
            ? Math.round((category.completedWords / category.totalWords) * 100) 
            : 0;

          return (
            <Card key={category.id} style={styles.categoryCard}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryEmoji}>{category.emoji}</Text>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryTitle}>{category.title}</Text>
                  <Text style={styles.categoryDescription}>
                    {category.description}
                  </Text>
                </View>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelText}>{category.cefrLevel}</Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View 
                    style={[styles.progressFill, { width: `${progress}%` }]} 
                  />
                </View>
                <Text style={styles.progressText}>
                  {category.completedWords}/{category.totalWords}
                </Text>
              </View>

              <View style={styles.modeButtons}>
                <PressableScale
                  style={styles.modeButton}
                  onPress={() => handleStartLesson(category.id)}
                >
                  <Text style={styles.modeButtonText}>Tarjetas</Text>
                </PressableScale>
                <PressableScale
                  style={[styles.modeButton, styles.modeButtonTyping]}
                  onPress={() => handleStartLesson(category.id, true)}
                >
                  <Text style={styles.modeButtonText}>Escribir</Text>
                </PressableScale>
              </View>

              {/* Estudiar por partícula: solo para phrasal verbs. Agrupa todos
                  los "up", "out", etc. para reforzar el patrón de la partícula. */}
              {category.id === 'phave' && (
                <View style={styles.particleSection}>
                  <Text style={styles.particleLabel}>🧲 Estudiar por partícula</Text>
                  <View style={styles.particleRow}>
                    {PARTICLE_CHIPS.map((p) => (
                      <PressableScale
                        key={p}
                        style={styles.particleChip}
                        onPress={() => handleStartByParticle(p)}
                      >
                        <Text style={styles.particleChipText}>{p}</Text>
                      </PressableScale>
                    ))}
                  </View>
                </View>
              )}
            </Card>
          );
        })}
      </View>

      {/* Gap-fill section */}
      <View style={styles.gapFillSection}>
        <Text style={styles.gapFillTitle}>🧩 Rellenar Huecos</Text>
        <Text style={styles.gapFillSubtitle}>Ejercicios estilo Cambridge</Text>

        {/* Source filter */}
        <View style={styles.sourceFilterRow}>
          {SOURCE_FILTERS.map((f) => (
            <PressableScale
              key={f.key}
              style={[
                styles.sourceFilterChip,
                sourceFilter === f.key && styles.sourceFilterChipSelected,
              ]}
              onPress={() => setSourceFilter(f.key)}
            >
              <Text style={[
                styles.sourceFilterText,
                sourceFilter === f.key && styles.sourceFilterTextSelected,
              ]}>
                {f.key === 'official' ? '🎓 ' : f.key === 'custom' ? '✏️ ' : ''}{f.label}
              </Text>
            </PressableScale>
          ))}
        </View>

        <Card style={styles.categoryCard}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryEmoji}>🚀</Text>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryTitle}>Rellena la partícula</Text>
              <Text style={styles.categoryDescription}>
                Phrasal verbs: elige up, off, on...
              </Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>A2-B2</Text>
            </View>
          </View>
          <View style={styles.modeButtons}>
            <PressableScale
              style={[styles.modeButton, styles.modeButtonGapFill]}
              onPress={() => router.push({
                pathname: '/study/gap-fill',
                params: { category: 'phrasal_particle', limit: String(cardsPerRound), source: 'all' },
              })}
            >
              <Text style={styles.modeButtonText}>Practicar</Text>
            </PressableScale>
          </View>
        </Card>

        <Card style={styles.categoryCard}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryEmoji}>🔗</Text>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryTitle}>Multiple Choice</Text>
              <Text style={styles.categoryDescription}>
                Conectores y vocabulario (Part 1)
              </Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>B1-C1</Text>
            </View>
          </View>
          <View style={styles.modeButtons}>
            <PressableScale
              style={[styles.modeButton, styles.modeButtonGapFill]}
              onPress={() => router.push({
                pathname: '/study/gap-fill',
                params: { category: 'connector', limit: String(cardsPerRound), source: sourceFilter },
              })}
            >
              <Text style={styles.modeButtonText}>Practicar</Text>
            </PressableScale>
          </View>
        </Card>

        <Card style={styles.categoryCard}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryEmoji}>🔤</Text>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryTitle}>Word Formation</Text>
              <Text style={styles.categoryDescription}>
                Transforma la palabra base (Part 3)
              </Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>B1-C1</Text>
            </View>
          </View>
          <View style={styles.modeButtons}>
            <PressableScale
              style={[styles.modeButton, styles.modeButtonGapFill]}
              onPress={() => router.push({
                pathname: '/study/gap-fill',
                params: { category: 'word_formation', limit: String(cardsPerRound), source: sourceFilter },
              })}
            >
              <Text style={styles.modeButtonText}>Practicar</Text>
            </PressableScale>
          </View>
        </Card>

        <Card style={styles.categoryCard}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryEmoji}>🔑</Text>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryTitle}>Key Word Transformation</Text>
              <Text style={styles.categoryDescription}>
                Reescribe usando una palabra clave (Part 4)
              </Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>B1-C1</Text>
            </View>
          </View>
          <View style={styles.modeButtons}>
            <PressableScale
              style={[styles.modeButton, styles.modeButtonGapFill]}
              onPress={() => router.push({
                pathname: '/study/gap-fill',
                params: { category: 'key_word_transformation', limit: String(cardsPerRound), source: sourceFilter },
              })}
            >
              <Text style={styles.modeButtonText}>Practicar</Text>
            </PressableScale>
          </View>
        </Card>

        <Card style={styles.categoryCard}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryEmoji}>🔍</Text>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryTitle}>Error Correction</Text>
              <Text style={styles.categoryDescription}>
                Encuentra y corrige el error
              </Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>B1-C1</Text>
            </View>
          </View>
          <View style={styles.modeButtons}>
            <PressableScale
              style={[styles.modeButton, styles.modeButtonGapFill]}
              onPress={() => router.push({
                pathname: '/study/gap-fill',
                params: { category: 'error_correction', limit: String(cardsPerRound), source: sourceFilter },
              })}
            >
              <Text style={styles.modeButtonText}>Practicar</Text>
            </PressableScale>
          </View>
        </Card>

        <Card style={styles.categoryCard}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryEmoji}>📝</Text>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryTitle}>Open Cloze</Text>
              <Text style={styles.categoryDescription}>
                Escribe la palabra que falta (Part 2)
              </Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>B1-C1</Text>
            </View>
          </View>
          <View style={styles.modeButtons}>
            <PressableScale
              style={[styles.modeButton, styles.modeButtonGapFill]}
              onPress={() => router.push({
                pathname: '/study/gap-fill',
                params: { category: 'open_cloze', limit: String(cardsPerRound), source: sourceFilter },
              })}
            >
              <Text style={styles.modeButtonText}>Practicar</Text>
            </PressableScale>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  container: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  content: {
    padding: spacing.xl,
    paddingTop: 60,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primarySurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: fontSize.xxl,
  },
  title: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  categories: {
    gap: spacing.lg,
  },
  categoryCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  categoryEmoji: {
    fontSize: 40,
    marginRight: spacing.md,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  categoryDescription: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  levelBadge: {
    backgroundColor: colors.primarySurface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  levelText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressBar: {
    flex: 1,
    height: spacing.sm,
    backgroundColor: colors.border,
    borderRadius: spacing.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: spacing.xs,
  },
  progressText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    // Ancho fijo suficiente para el peor caso ("2235/2235" ≈ 72px): así la
    // columna del contador no crece al avanzar el progreso y todas las barras
    // (flex:1) terminan en la misma x. Con 70px, "2235/2235" desbordaba y
    // desalineaba la barra de NGSL en cuanto había progreso real.
    minWidth: 80,
    textAlign: 'right',
  },
  cardCountSection: {
    marginBottom: spacing.xl,
  },
  cardCountLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  cardCountRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cardCountChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cardCountChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  cardCountText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  cardCountTextSelected: {
    color: colors.onPrimary,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySurface,
  },
  modeButtonTyping: {
    backgroundColor: colors.warningSurface,
  },
  modeButtonGapFill: {
    backgroundColor: colors.infoSurface,
  },
  sourceFilterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sourceFilterChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  sourceFilterChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sourceFilterText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  sourceFilterTextSelected: {
    color: colors.onPrimary,
  },
  gapFillSection: {
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  gapFillTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
  },
  gapFillSubtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  modeButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  failedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dangerSurfaceSoft,
    borderWidth: 1.5,
    borderColor: colors.dangerBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  failedEmoji: {
    fontSize: 28,
    marginRight: spacing.lg,
  },
  failedInfo: {
    flex: 1,
  },
  failedTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  failedDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  musicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentPurpleSurface,
    borderWidth: 1.5,
    borderColor: colors.accentPurpleBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  musicChevron: {
    fontSize: 26,
    color: colors.accentPurple,
    fontWeight: fontWeight.regular,
    marginLeft: spacing.sm,
  },
  failedChevron: {
    fontSize: 26,
    color: colors.danger,
    fontWeight: fontWeight.regular,
    marginLeft: spacing.sm,
  },
  particleSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
  },
  particleLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  particleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  particleChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.accentPurpleSurface,
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
  },
  particleChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.accentPurple,
    textTransform: 'uppercase',
  },
});
