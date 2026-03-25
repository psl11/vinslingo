import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

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
                  <Pressable
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
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.reviewModeButtons}>
              <Pressable
                style={styles.reviewModeButton}
                onPress={() => handleStartReview(false)}
              >
                <Text style={styles.reviewModeEmoji}>🃏</Text>
                <Text style={styles.reviewModeText}>Tarjetas</Text>
              </Pressable>
              <Pressable
                style={[styles.reviewModeButton, styles.reviewModeButtonTyping]}
                onPress={() => handleStartReview(true)}
              >
                <Text style={styles.reviewModeEmoji}>✏️</Text>
                <Text style={styles.reviewModeText}>Escribir</Text>
              </Pressable>
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
        <Pressable
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
        </Pressable>
      </Card>

      {/* SRS Info */}
      <Card style={styles.infoCard}>
        <Text style={styles.infoTitle}>📈 Repaso Espaciado</Text>
        <Text style={styles.infoText}>
          El sistema SM-2 programa tus repasos en el momento óptimo para 
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
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
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
  summaryCard: {
    marginBottom: 24,
    backgroundColor: '#EEF2FF',
  },
  dueContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  dueMain: {
    alignItems: 'center',
  },
  dueNumber: {
    fontSize: 56,
    fontWeight: '700',
    color: '#4F46E5',
  },
  dueLabel: {
    fontSize: 16,
    color: '#6366F1',
    marginTop: 4,
  },
  overdueTag: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  overdueText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    alignItems: 'center',
    padding: 16,
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#F0FDF4',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#15803D',
    lineHeight: 20,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: 12,
    textAlign: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  categoryEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  categoryLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  categoryLabelSelected: {
    color: '#FFFFFF',
  },
  reviewModeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  reviewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
  },
  reviewModeButtonTyping: {
    backgroundColor: '#F59E0B',
  },
  reviewModeEmoji: {
    fontSize: 18,
  },
  reviewModeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  mistakesCard: {
    marginBottom: 24,
    backgroundColor: '#FEF2F2',
  },
  mistakesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mistakesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
  },
  mistakesBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  mistakesBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mistakesDescription: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 18,
    marginBottom: 14,
  },
  mistakesButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  mistakesButtonDisabled: {
    backgroundColor: '#FECACA',
  },
  mistakesButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  mistakesButtonTextDisabled: {
    color: '#F87171',
  },
});
