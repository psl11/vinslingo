import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { PressableScale } from '../../components/ui/PressableScale';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { useVocabularyStats } from '../../hooks/useVocabulary';

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
  ];

  const handleStartLesson = (categoryId: string, typingMode = false) => {
    const params: Record<string, string> = { limit: String(cardsPerRound) };
    if (typingMode) params.mode = 'typing';
    router.push({
      pathname: `/study/${categoryId}`,
      params,
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
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 22,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  categories: {
    gap: 16,
  },
  categoryCard: {
    padding: 16,
    marginBottom: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryEmoji: {
    fontSize: 40,
    marginRight: 12,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  categoryDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  levelBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    // Ancho fijo suficiente para el peor caso ("2235/2235" ≈ 72px): así la
    // columna del contador no crece al avanzar el progreso y todas las barras
    // (flex:1) terminan en la misma x. Con 70px, "2235/2235" desbordaba y
    // desalineaba la barra de NGSL en cuanto había progreso real.
    minWidth: 80,
    textAlign: 'right',
  },
  cardCountSection: {
    marginBottom: 20,
  },
  cardCountLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 10,
  },
  cardCountRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cardCountChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cardCountChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  cardCountText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
  },
  cardCountTextSelected: {
    color: '#FFFFFF',
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
  },
  modeButtonTyping: {
    backgroundColor: '#FEF3C7',
  },
  modeButtonGapFill: {
    backgroundColor: '#DBEAFE',
  },
  sourceFilterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  sourceFilterChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  sourceFilterChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  sourceFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  sourceFilterTextSelected: {
    color: '#FFFFFF',
  },
  gapFillSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  gapFillTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 2,
  },
  gapFillSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 14,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
});
