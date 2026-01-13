import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

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

  const animatedStyle = useAnimatedStyle(() => ({
    width: withTiming(`${progress}%`, { duration: 300 }),
  }));

  return (
    <View style={styles.container}>
      {showLabel && (
        <Text style={styles.label}>
          {current}/{total}
        </Text>
      )}
      <View style={[styles.track, { backgroundColor, height }]}>
        <Animated.View
          style={[
            styles.fill,
            { backgroundColor: color, height },
            animatedStyle,
          ]}
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
