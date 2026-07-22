import React, { useRef, useEffect, useState } from 'react';
import { Text, StyleSheet, Animated, Easing, ActivityIndicator, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PressableScale } from '../ui/PressableScale';
import { SimpleQuality, formatInterval } from '../../lib/srs/fsrs';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { colors, radius, spacing, fontSize, fontWeight } from '../../constants/theme';
import { useReduceMotion } from '../../hooks/useReduceMotion';

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
  const reduceMotion = useReduceMotion();

  // Entrada sutil (fade + leve subida) al aparecer tras voltear la ficha.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1); // aparece sin animar
      return;
    }
    Animated.timing(enter, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [enter, reduceMotion]);

  // Botón pulsado: muestra un spinner mientras se procesa (guardado local + carga
  // de la siguiente ficha). Da feedback inmediato aunque tarde un instante. El
  // estado se limpia solo: este componente se remonta por ficha (solo se muestra
  // con la tarjeta volteada).
  const [pending, setPending] = useState<SimpleQuality | null>(null);
  const isPending = pending !== null;

  const handlePress = (quality: SimpleQuality) => {
    if (disabled || isPending) return;

    if (hapticsEnabled) {
      if (quality === 'again') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }

    setPending(quality);
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
          style={[
            styles.button,
            { backgroundColor: color },
            disabled && !isPending ? styles.dim : null,
            isPending && pending !== quality ? styles.dim : null,
          ]}
          onPress={() => handlePress(quality)}
          disabled={disabled || isPending}
        >
          {pending === quality ? (
            <View style={styles.spinnerWrap}>
              <ActivityIndicator color={colors.onPrimary} />
            </View>
          ) : (
            <>
              <Text style={styles.buttonLabel}>{label}</Text>
              <Text style={styles.intervalText}>{formatInterval(intervals[quality])}</Text>
            </>
          )}
        </PressableScale>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    // 20 para coincidir con el paddingHorizontal de cardContainer y que los
    // botones queden alineados exactamente con los bordes de la tarjeta.
    paddingHorizontal: spacing.xl,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  dim: { opacity: 0.4 },
  // Misma altura que label + intervalo para que el botón no cambie de tamaño al
  // mostrar el spinner.
  spinnerWrap: { height: 32, justifyContent: 'center' },
  buttonLabel: {
    color: colors.onPrimary,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  intervalText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
});
