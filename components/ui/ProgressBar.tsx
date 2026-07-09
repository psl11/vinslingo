import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, spacing, fontSize, fontWeight } from '../../constants/theme';

interface ProgressBarProps {
  current: number;
  total: number;
  showLabel?: boolean;
  color?: string;
  backgroundColor?: string;
  height?: number;
}

export function ProgressBar({
  current,
  total,
  showLabel = true,
  color = colors.primary,
  backgroundColor = colors.border,
  height = spacing.sm,
}: ProgressBarProps) {
  const progress = total > 0 ? (current / total) * 100 : 0;

  // Relleno animado: al avanzar de tarjeta, la barra crece con suavidad en vez
  // de saltar. width no admite native driver, pero animar una barra fina es
  // despreciable en rendimiento. Arranca en el valor actual (sin animar el 1er
  // render).
  const anim = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, anim]);

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {showLabel && (
        <Text style={styles.label}>
          {current}/{total}
        </Text>
      )}
      <View style={[styles.track, { backgroundColor, height }]}>
        <Animated.View
          style={[styles.fill, { backgroundColor: color, height, width }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    minWidth: 50,
  },
  track: {
    flex: 1,
    borderRadius: spacing.xs,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: spacing.xs,
  },
});
