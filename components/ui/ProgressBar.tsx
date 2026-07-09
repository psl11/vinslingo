import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

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
  color = '#4F46E5',
  backgroundColor = '#E5E7EB',
  height = 8,
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
    gap: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    minWidth: 50,
  },
  track: {
    flex: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 4,
  },
});
