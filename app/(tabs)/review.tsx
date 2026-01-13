import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

interface ReviewStats {
  dueToday: number;
  overdue: number;
  newToday: number;
  learned: number;
}

export default function ReviewScreen() {
  const router = useRouter();
  const [reviewStats, setReviewStats] = useState<ReviewStats>({
    dueToday: 0,
    overdue: 0,
    newToday: 0,
    learned: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReviewStats();
  }, []);

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

  const handleStartReview = () => {
    router.push('/study/review');
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

            <Button onPress={handleStartReview} fullWidth size="lg">
              🔄  Comenzar Repaso
            </Button>
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
});
