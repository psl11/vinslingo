import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SimpleQuality, formatInterval } from '../../lib/srs/sm2';
import { useSettingsStore } from '../../stores/useSettingsStore';

interface AnswerButtonsProps {
  intervals: Record<SimpleQuality, number>;
  onAnswer: (quality: SimpleQuality) => void;
  disabled?: boolean;
}

const BUTTON_CONFIG: { quality: SimpleQuality; label: string; color: string }[] = [
  { quality: 'again', label: 'Otra vez', color: '#EF4444' },
  { quality: 'hard', label: 'Difícil', color: '#F59E0B' },
  { quality: 'good', label: 'Bien', color: '#22C55E' },
  { quality: 'easy', label: 'Fácil', color: '#3B82F6' },
];

export function AnswerButtons({ intervals, onAnswer, disabled }: AnswerButtonsProps) {
  const { hapticsEnabled } = useSettingsStore();

  const handlePress = (quality: SimpleQuality) => {
    if (disabled) return;
    
    if (hapticsEnabled) {
      if (quality === 'again') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
    
    onAnswer(quality);
  };

  return (
    <View style={styles.container}>
      {BUTTON_CONFIG.map(({ quality, label, color }) => (
        <Pressable
          key={quality}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: color, opacity: pressed || disabled ? 0.7 : 1 },
          ]}
          onPress={() => handlePress(quality)}
          disabled={disabled}
        >
          <Text style={styles.buttonLabel}>{label}</Text>
          <Text style={styles.intervalText}>{formatInterval(intervals[quality])}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  intervalText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
  },
});
