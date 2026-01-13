import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useUserStore } from '../../stores/useUserStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, getCurrentLevel } = useUserStore();
  const { 
    dailyGoalMinutes, 
    notificationsEnabled, 
    soundEnabled, 
    hapticsEnabled,
    themeMode,
    toggleNotifications,
    toggleSound,
    toggleHaptics,
  } = useSettingsStore();

  const levelInfo = getCurrentLevel();

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
          {profile?.displayName || 'Usuario'}
        </Text>
        <View style={styles.levelContainer}>
          <Text style={styles.levelBadge}>Nivel {levelInfo.level}</Text>
          <Text style={styles.levelTitle}>{levelInfo.title}</Text>
        </View>
        <View style={styles.xpContainer}>
          <Text style={styles.xpText}>{profile?.totalXp ?? 0} XP total</Text>
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
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile?.currentStreak ?? 0}</Text>
            <Text style={styles.statLabel}>🔥 Racha</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile?.longestStreak ?? 0}</Text>
            <Text style={styles.statLabel}>🏆 Mejor racha</Text>
          </View>
        </View>
      </Card>

      {/* Settings */}
      <Card style={styles.settingsCard}>
        <Text style={styles.sectionTitle}>Configuración</Text>
        
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Meta diaria</Text>
          <Text style={styles.settingValue}>{dailyGoalMinutes} min</Text>
        </View>

        <Pressable style={styles.settingRow} onPress={toggleNotifications}>
          <Text style={styles.settingLabel}>Notificaciones</Text>
          <Text style={styles.settingToggle}>
            {notificationsEnabled ? '✅' : '❌'}
          </Text>
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

        <View style={[styles.settingRow, styles.lastRow]}>
          <Text style={styles.settingLabel}>Tema</Text>
          <Text style={styles.settingValue}>
            {themeMode === 'light' ? '☀️ Claro' : 
             themeMode === 'dark' ? '🌙 Oscuro' : '⚙️ Sistema'}
          </Text>
        </View>
      </Card>

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
    marginBottom: 8,
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
    justifyContent: 'space-around',
  },
  stat: {
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
});
