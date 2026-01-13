import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserStore } from '../../stores/useUserStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Button } from '../../components/ui/Button';

export default function HomeScreen() {
  const router = useRouter();
  const { todayXp, todayMinutes, todayCardsStudied, profile } = useUserStore();
  const { dailyGoalMinutes } = useSettingsStore();
  const { getCurrentLevel } = useUserStore();
  const levelInfo = getCurrentLevel();

  const streak = profile?.currentStreak ?? 0;
  const goalProgress = Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.greeting}>¡Hola! 👋</Text>
        <Text style={styles.subtitle}>Continúa tu aprendizaje</Text>
      </View>

      {/* Streak Card */}
      <Card style={styles.streakCard}>
        <View style={styles.streakContent}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <View>
            <Text style={styles.streakNumber}>{streak}</Text>
            <Text style={styles.streakLabel}>días de racha</Text>
          </View>
        </View>
      </Card>

      {/* Daily Progress */}
      <Card style={styles.progressCard}>
        <Text style={styles.cardTitle}>Progreso de hoy</Text>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Meta diaria</Text>
          <Text style={styles.progressValue}>{goalProgress}%</Text>
        </View>
        <ProgressBar 
          current={todayMinutes} 
          total={dailyGoalMinutes} 
          showLabel={false}
        />
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{todayXp}</Text>
            <Text style={styles.statLabel}>XP</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{todayMinutes}</Text>
            <Text style={styles.statLabel}>minutos</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{todayCardsStudied}</Text>
            <Text style={styles.statLabel}>tarjetas</Text>
          </View>
        </View>
      </Card>

      {/* Level Card */}
      <Card style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <Text style={styles.levelBadge}>Nivel {levelInfo.level}</Text>
          <Text style={styles.levelTitle}>{levelInfo.title}</Text>
        </View>
        <ProgressBar 
          current={levelInfo.progress} 
          total={100} 
          showLabel={false}
          color="#F59E0B"
        />
      </Card>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button onPress={() => router.push('/learn')} fullWidth size="lg">
          📚  Empezar Lección
        </Button>
        <Button 
          onPress={() => router.push('/review')} 
          variant="secondary" 
          fullWidth 
          size="lg"
        >
          🔄  Repasar Vocabulario
        </Button>
      </View>
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
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  streakCard: {
    backgroundColor: '#FEF3C7',
    marginBottom: 16,
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  streakEmoji: {
    fontSize: 48,
  },
  streakNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#92400E',
  },
  streakLabel: {
    fontSize: 14,
    color: '#B45309',
  },
  progressCard: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4F46E5',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  stat: {
    alignItems: 'center',
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
  levelCard: {
    marginBottom: 24,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  levelBadge: {
    backgroundColor: '#F59E0B',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: '600',
    overflow: 'hidden',
  },
  levelTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  actions: {
    gap: 12,
  },
});
