import React, { useRef, useEffect } from 'react';
import { Text, StyleSheet, Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PressableScale } from '../ui/PressableScale';
import { SimpleQuality, formatInterval } from '../../lib/srs/fsrs';
import { useSettingsStore } from '../../stores/useSettingsStore';

interface AnswerButtonsProps {
  intervals: Record<SimpleQuality, number>;
  onAnswer: (quality: SimpleQuality) => void;
  disabled?: boolean;
  isRetry?: boolean;
}

const BUTTON_CONFIG: { quality: SimpleQuality; label: string; color: string }[] = [
  { quality: 'again', label: 'Otra vez', color: '#EF4444' },
  { quality: 'hard', label: 'Difícil', color: '#F59E0B' },
  { quality: 'good', label: 'Bien', color: '#22C55E' },
  { quality: 'easy', label: 'Fácil', color: '#3B82F6' },
];

export function AnswerButtons({ intervals, onAnswer, disabled, isRetry }: AnswerButtonsProps) {
  const { hapticsEnabled } = useSettingsStore();

  // Entrada sutil (fade + leve subida) al aparecer tras voltear la ficha.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [enter]);

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
    <Animated.View
      style={[
        styles.container,
        { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
      ]}
    >
      {BUTTON_CONFIG
        .filter(({ quality }) => !(isRetry && (quality === 'easy' || quality === 'hard')))
        .map(({ quality, label, color }) => (
        <PressableScale
          key={quality}
          style={[styles.button, { backgroundColor: color, opacity: disabled ? 0.7 : 1 }]}
          onPress={() => handlePress(quality)}
          disabled={disabled}
        >
          <Text style={styles.buttonLabel}>{label}</Text>
          <Text style={styles.intervalText}>{formatInterval(intervals[quality])}</Text>
        </PressableScale>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    // 20 para coincidir con el paddingHorizontal de cardContainer y que los
    // botones queden alineados exactamente con los bordes de la tarjeta.
    paddingHorizontal: 20,
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
