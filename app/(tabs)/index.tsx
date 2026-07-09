import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useUserStore } from '../../stores/useUserStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Button } from '../../components/ui/Button';
import { colors, radius, spacing, fontSize, fontWeight } from '../../constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { todayXp, todayMinutes, todayCardsStudied, profile, resetIfNewDay } = useUserStore();
  const { dailyGoalMinutes } = useSettingsStore();
  const { getCurrentLevel } = useUserStore();
  const levelInfo = getCurrentLevel();

  useFocusEffect(
    useCallback(() => {
      resetIfNewDay();
    }, [resetIfNewDay])
  );

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
    backgroundColor: colors.screen,
  },
  content: {
    padding: spacing.xl,
    paddingTop: 60,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  greeting: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  streakCard: {
    backgroundColor: colors.warningSurface,
    marginBottom: spacing.lg,
  },
  streakContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  streakEmoji: {
    fontSize: 48,
  },
  streakNumber: {
    fontSize: fontSize.displayLg,
    fontWeight: fontWeight.bold,
    color: colors.warningText,
  },
  streakLabel: {
    fontSize: fontSize.base,
    color: colors.warningTextSoft,
  },
  progressCard: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
  progressValue: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceSubtle,
  },
  stat: {
    alignItems: 'center',
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
  levelCard: {
    marginBottom: spacing.xxl,
  },
  levelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  levelBadge: {
    backgroundColor: colors.warning,
    color: colors.onPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    overflow: 'hidden',
  },
  levelTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  actions: {
    gap: spacing.md,
  },
});
