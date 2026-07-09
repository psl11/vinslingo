import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { confirmAction } from '../../lib/utils/confirm';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUserStore } from '../../stores/useUserStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { colors, radius, spacing, fontSize, fontWeight } from '../../constants/theme';

interface UserProgress {
  totalXp: number;
  wordsStudied: number;
  wordsLearning: number;
  wordsMastered: number;
  currentStreak: number;
  longestStreak: number;
  accuracy: number;
  todayCards: number;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, getCurrentLevel, setProfile } = useUserStore();
  const { user, signOut } = useAuth();
  const {
    dailyGoalMinutes,
    soundEnabled,
    hapticsEnabled,
    selectedCEFRLevels,
    setDailyGoal,
    toggleSound,
    toggleHaptics,
    toggleCEFRLevel,
  } = useSettingsStore();

  const DAILY_GOAL_OPTIONS = [5, 10, 15, 20, 30];
  const cycleDailyGoal = () => {
    const idx = DAILY_GOAL_OPTIONS.indexOf(dailyGoalMinutes);
    setDailyGoal(DAILY_GOAL_OPTIONS[(idx + 1) % DAILY_GOAL_OPTIONS.length]);
  };

  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadProgress();
    }, [])
  );

  const loadProgress = async () => {
    try {
      setIsLoading(true);
      const { getUserProgress } = await import('../../lib/services/progressService');
      const data = await getUserProgress();
      
      if (data) {
        setProgress(data);
        // Update local store with Supabase data
        if (profile) {
          setProfile({
            ...profile,
            totalXp: data.totalXp,
            currentStreak: data.currentStreak,
            longestStreak: data.longestStreak,
          });
        }
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const levelInfo = getCurrentLevel();

  const handleSignOut = () => {
    confirmAction({
      title: 'Cerrar Sesión',
      message: '¿Estás seguro de que quieres cerrar sesión?',
      confirmText: 'Cerrar Sesión',
      destructive: true,
      onConfirm: signOut,
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Perfil</Text>
      </View>

      {/* User Info */}
      <Card style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>👤</Text>
        </View>
        <Text style={styles.userName}>
          {profile?.displayName || user?.email?.split('@')[0] || 'Usuario'}
        </Text>
        {user?.email && (
          <Text style={styles.userEmail}>{user.email}</Text>
        )}
        <View style={styles.levelContainer}>
          <Text style={styles.levelBadge}>Nivel {levelInfo.level}</Text>
          <Text style={styles.levelTitle}>{levelInfo.title}</Text>
        </View>
        <View style={styles.xpContainer}>
          <Text style={styles.xpText}>{progress?.totalXp ?? profile?.totalXp ?? 0} XP total</Text>
          <ProgressBar 
            current={levelInfo.progress} 
            total={100} 
            showLabel={false}
            color="#F59E0B"
          />
        </View>
      </Card>

      {/* Stats */}
      <Card style={styles.statsCard}>
        <Text style={styles.sectionTitle}>Estadísticas</Text>
        {isLoading ? (
          <ActivityIndicator size="small" color="#4F46E5" style={{ marginVertical: 20 }} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{progress?.currentStreak ?? 0}</Text>
                <Text style={styles.statLabel}>🔥 Racha</Text>
              </View>
              {/* Hueco central: alinea esta fila (2 stats) con la rejilla de
                  3 columnas de la fila inferior. Racha↔Palabras, Mejor↔Precisión. */}
              <View style={styles.stat} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{progress?.longestStreak ?? 0}</Text>
                <Text style={styles.statLabel}>🏆 Mejor</Text>
              </View>
            </View>
            <View style={[styles.statsRow, { marginTop: 16 }]}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{progress?.wordsStudied ?? 0}</Text>
                <Text style={styles.statLabel}>📚 Palabras</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{progress?.wordsMastered ?? 0}</Text>
                <Text style={styles.statLabel}>⭐ Dominadas</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{progress?.accuracy ?? 0}%</Text>
                <Text style={styles.statLabel}>🎯 Precisión</Text>
              </View>
            </View>
          </>
        )}
      </Card>

      {/* Settings */}
      <Card style={styles.settingsCard}>
        <Text style={styles.sectionTitle}>Configuración</Text>
        
        <Pressable style={styles.settingRow} onPress={cycleDailyGoal}>
          <Text style={styles.settingLabel}>Meta diaria</Text>
          <Text style={styles.settingValue}>{dailyGoalMinutes} min ›</Text>
        </Pressable>

        <Pressable style={styles.settingRow} onPress={toggleSound}>
          <Text style={styles.settingLabel}>Sonido</Text>
          <Text style={styles.settingToggle}>
            {soundEnabled ? '🔊' : '🔇'}
          </Text>
        </Pressable>

        <Pressable style={styles.settingRow} onPress={toggleHaptics}>
          <Text style={styles.settingLabel}>Vibración</Text>
          <Text style={styles.settingToggle}>
            {hapticsEnabled ? '📳' : '📴'}
          </Text>
        </Pressable>

        <View style={[styles.settingRow, styles.lastRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
          <Text style={[styles.settingLabel, { marginBottom: 12 }]}>📊 Niveles de vocabulario</Text>
          <View style={styles.cefrContainer}>
            {(['A1', 'A2', 'B1', 'B2', 'C1'] as const).map((level) => (
              <Pressable
                key={level}
                style={[
                  styles.cefrButton,
                  selectedCEFRLevels.includes(level) && styles.cefrButtonSelected,
                ]}
                onPress={() => toggleCEFRLevel(level)}
              >
                <Text style={[
                  styles.cefrButtonText,
                  selectedCEFRLevels.includes(level) && styles.cefrButtonTextSelected,
                ]}>
                  {level}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.cefrHint}>
            Solo verás palabras y ejercicios de los niveles seleccionados
            (el vocabulario llega hasta B2; C1 aplica a ejercicios Cambridge)
          </Text>
        </View>
      </Card>

      {/* Sign Out */}
      <Pressable style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>🚪 Cerrar Sesión</Text>
      </Pressable>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appVersion}>VinsLingo v1.0.0</Text>
        <Text style={styles.appTagline}>Aprende inglés con repetición espaciada</Text>
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
    paddingBottom: spacing.huge,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  userCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 40,
  },
  userName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  userEmail: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  levelBadge: {
    backgroundColor: colors.warning,
    color: colors.onPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    overflow: 'hidden',
  },
  levelTitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  xpContainer: {
    width: '100%',
  },
  xpText: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  statsCard: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.displayLg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  settingsCard: {
    marginBottom: spacing.xxl,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  settingLabel: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  settingValue: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  settingToggle: {
    fontSize: fontSize.xl,
  },
  signOutButton: {
    backgroundColor: colors.dangerSurface,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  signOutText: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  appInfo: {
    alignItems: 'center',
  },
  appVersion: {
    fontSize: fontSize.base,
    color: colors.textTertiary,
  },
  appTagline: {
    fontSize: fontSize.xs,
    color: colors.borderStrong,
    marginTop: spacing.xs,
  },
  cefrContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  cefrButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  cefrButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  cefrButtonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  cefrButtonTextSelected: {
    color: colors.primary,
  },
  cefrHint: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
});
