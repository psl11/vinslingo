import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useUserStore } from '../../stores/useUserStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';

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
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Cerrar Sesión', 
          style: 'destructive',
          onPress: signOut,
        },
      ]
    );
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
    backgroundColor: '#F9FAFB',
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  userCard: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 40,
  },
  userName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  levelBadge: {
    backgroundColor: '#F59E0B',
    color: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '600',
    overflow: 'hidden',
  },
  levelTitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  xpContainer: {
    width: '100%',
  },
  xpText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  statsCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  settingsCard: {
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  settingLabel: {
    fontSize: 16,
    color: '#1F2937',
  },
  settingValue: {
    fontSize: 16,
    color: '#6B7280',
  },
  settingToggle: {
    fontSize: 20,
  },
  signOutButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  signOutText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  appInfo: {
    alignItems: 'center',
  },
  appVersion: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  appTagline: {
    fontSize: 12,
    color: '#D1D5DB',
    marginTop: 4,
  },
  cefrContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  cefrButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  cefrButtonSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  cefrButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  cefrButtonTextSelected: {
    color: '#4F46E5',
  },
  cefrHint: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});
