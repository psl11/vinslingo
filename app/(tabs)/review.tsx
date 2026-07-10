import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { PressableScale } from '../../components/ui/PressableScale';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { colors, radius, spacing, fontSize, fontWeight } from '../../constants/theme';

interface ReviewStats {
  dueToday: number;
  overdue: number;
  newToday: number;
  learned: number;
}

interface CambridgeMistakeStats {
  count: number;
}

const CATEGORIES = [
  { id: 'all', label: 'Todo', emoji: '📚' },
  { id: 'ngsl', label: 'NGSL', emoji: '🔤' },
  { id: 'phave', label: 'Phrasal Verbs', emoji: '🔀' },
  { id: 'idiom', label: 'Idioms', emoji: '💬' },
  { id: 'connector', label: 'Conectores', emoji: '🔗' },
  { id: 'false_friend', label: 'False Friends', emoji: '🚨' },
  { id: 'expression', label: 'Expresiones', emoji: '💬' },
  { id: 'confusing_pair', label: 'Confusing Pairs', emoji: '🔀' },
  { id: 'collocation', label: 'Collocations', emoji: '🧩' },
  { id: 'british_slang', label: 'Slang UK', emoji: '🇬🇧' },
  { id: 'american_slang', label: 'Slang US', emoji: '🇺🇸' },
];

export default function ReviewScreen() {
  const router = useRouter();
  const [reviewStats, setReviewStats] = useState<ReviewStats>({
    dueToday: 0,
    overdue: 0,
    newToday: 0,
    learned: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [mistakeCount, setMistakeCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadReviewStats();
      loadMistakeCount();
    }, [])
  );

  const loadReviewStats = async () => {
    try {
      setIsLoading(true);
      const { getReviewStats } = await import('../../lib/services/progressService');
      const stats = await getReviewStats();
      setReviewStats(stats);
    } catch (error) {
      console.error('Error loading review stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMistakeCount = async () => {
    try {
      const { getGapFillMistakeCount } = await import('../../lib/database/queries');
      const count = await getGapFillMistakeCount();
      setMistakeCount(count);
    } catch (error) {
      console.error('Error loading mistake count:', error);
    }
  };

  const handleReviewMistakes = () => {
    router.push({
      pathname: '/study/gap-fill',
      params: { reviewMistakes: '1', limit: '20' },
    });
  };

  const toggleCategory = (categoryId: string) => {
    if (categoryId === 'all') {
      setSelectedCategories(['all']);
    } else {
      setSelectedCategories(prev => {
        const withoutAll = prev.filter(c => c !== 'all');
        if (withoutAll.includes(categoryId)) {
          const newCategories = withoutAll.filter(c => c !== categoryId);
          return newCategories.length === 0 ? ['all'] : newCategories;
        } else {
          return [...withoutAll, categoryId];
        }
      });
    }
  };

  const handleStartReview = (typingMode = false) => {
    const cats = selectedCategories.includes('all') 
      ? undefined 
      : selectedCategories;
    const params: Record<string, string> = {};
    if (cats) params.categories = cats.join(',');
    if (typingMode) params.mode = 'typing';
    router.push({
      pathname: '/study/review',
      params,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Repasar</Text>
        <Text style={styles.subtitle}>Refuerza tu vocabulario</Text>
      </View>

      {/* Due Cards Summary */}
      <Card style={styles.summaryCard}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#4F46E5" style={{ marginVertical: 40 }} />
        ) : (
          <>
            <View style={styles.dueContainer}>
              <View style={styles.dueMain}>
                <Text style={styles.dueNumber}>{reviewStats.dueToday}</Text>
                <Text style={styles.dueLabel}>tarjetas para hoy</Text>
              </View>
              {reviewStats.overdue > 0 && (
                <View style={styles.overdueTag}>
                  <Text style={styles.overdueText}>
                    +{reviewStats.overdue} atrasadas
                  </Text>
                </View>
              )}
            </View>

            {/* Category Selector */}
            <View style={styles.categorySection}>
              <Text style={styles.categoryTitle}>¿Qué quieres repasar?</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <PressableScale
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      selectedCategories.includes(cat.id) && styles.categoryChipSelected,
                    ]}
                    onPress={() => toggleCategory(cat.id)}
                  >
                    <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                    <Text style={[
                      styles.categoryLabel,
                      selectedCategories.includes(cat.id) && styles.categoryLabelSelected,
                    ]}>
                      {cat.label}
                    </Text>
                  </PressableScale>
                ))}
              </View>
            </View>

            <View style={styles.reviewModeButtons}>
              <PressableScale
                style={styles.reviewModeButton}
                onPress={() => handleStartReview(false)}
              >
                <Text style={styles.reviewModeEmoji}>🃏</Text>
                <Text style={styles.reviewModeText}>Tarjetas</Text>
              </PressableScale>
              <PressableScale
                style={[styles.reviewModeButton, styles.reviewModeButtonTyping]}
                onPress={() => handleStartReview(true)}
              >
                <Text style={styles.reviewModeEmoji}>✏️</Text>
                <Text style={styles.reviewModeText}>Escribir</Text>
              </PressableScale>
            </View>
          </>
        )}
      </Card>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Text style={styles.statEmoji}>📚</Text>
          <Text style={styles.statValue}>{reviewStats.learned}</Text>
          <Text style={styles.statLabel}>Aprendidas</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statEmoji}>🆕</Text>
          <Text style={styles.statValue}>{reviewStats.newToday}</Text>
          <Text style={styles.statLabel}>Nuevas hoy</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statEmoji}>⏰</Text>
          <Text style={styles.statValue}>{reviewStats.overdue}</Text>
          <Text style={styles.statLabel}>Atrasadas</Text>
        </Card>

        <Card style={styles.statCard}>
          <Text style={styles.statEmoji}>✅</Text>
          <Text style={styles.statValue}>{reviewStats.dueToday}</Text>
          <Text style={styles.statLabel}>Pendientes</Text>
        </Card>
      </View>

      {/* Cambridge Mistakes */}
      <Card style={styles.mistakesCard}>
        <View style={styles.mistakesHeader}>
          <Text style={styles.mistakesTitle}>Errores Cambridge</Text>
          {mistakeCount > 0 && (
            <View style={styles.mistakesBadge}>
              <Text style={styles.mistakesBadgeText}>{mistakeCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.mistakesDescription}>
          Repasa los ejercicios tipo Cambridge que has fallado para reforzar tus puntos débiles.
        </Text>
        <PressableScale
          style={[
            styles.mistakesButton,
            mistakeCount === 0 && styles.mistakesButtonDisabled,
          ]}
          onPress={handleReviewMistakes}
          disabled={mistakeCount === 0}
        >
          <Text style={[
            styles.mistakesButtonText,
            mistakeCount === 0 && styles.mistakesButtonTextDisabled,
          ]}>
            {mistakeCount > 0 ? `Repasar ${mistakeCount} errores` : 'Sin errores pendientes'}
          </Text>
        </PressableScale>
      </Card>

      {/* SRS Info */}
      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>📈 Repaso Espaciado</Text>
        <Text style={styles.infoText}>
          El algoritmo FSRS programa tus repasos en el momento óptimo para
          maximizar la retención. Las tarjetas que dominas aparecerán menos
          frecuentemente, mientras que las difíciles se repiten más seguido.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  summaryCard: {
    marginBottom: spacing.xxl,
    backgroundColor: colors.primarySurface,
  },
  dueContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  dueMain: {
    alignItems: 'center',
  },
  dueNumber: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  dueLabel: {
    fontSize: fontSize.md,
    color: colors.primaryLight,
    marginTop: spacing.xs,
  },
  overdueTag: {
    backgroundColor: colors.dangerSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  overdueText: {
    fontSize: fontSize.base,
    color: colors.danger,
    fontWeight: fontWeight.medium,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  statCard: {
    width: '47%',
    alignItems: 'center',
    padding: spacing.lg,
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  infoCard: {
    backgroundColor: colors.successSurface,
  },
  infoTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#166534',
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: fontSize.base,
    color: '#15803D',
    lineHeight: 20,
  },
  categorySection: {
    marginBottom: spacing.xl,
  },
  categoryTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryEmoji: {
    fontSize: fontSize.base,
    marginRight: spacing.xs,
  },
  categoryLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  categoryLabelSelected: {
    color: colors.onPrimary,
  },
  reviewModeButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  reviewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  reviewModeButtonTyping: {
    backgroundColor: colors.warning,
  },
  reviewModeEmoji: {
    fontSize: fontSize.lg,
  },
  reviewModeText: {
    color: colors.onPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  mistakesCard: {
    marginBottom: spacing.xxl,
    backgroundColor: colors.dangerSurfaceSoft,
  },
  mistakesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  mistakesTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#991B1B',
  },
  mistakesBadge: {
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    marginLeft: spacing.sm,
  },
  mistakesBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.onPrimary,
  },
  mistakesDescription: {
    fontSize: fontSize.sm,
    color: '#7F1D1D',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  mistakesButton: {
    backgroundColor: colors.danger,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  mistakesButtonDisabled: {
    backgroundColor: colors.dangerBorder,
  },
  mistakesButtonText: {
    color: colors.onPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  mistakesButtonTextDisabled: {
    color: '#F87171',
  },
});
