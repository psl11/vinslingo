import React from 'react';
import { Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
  primary: { bg: '#4F46E5', text: '#FFFFFF' },
  secondary: { bg: '#F3F4F6', text: '#1F2937' },
  outline: { bg: 'transparent', text: '#4F46E5', border: '#4F46E5' },
  ghost: { bg: 'transparent', text: '#6B7280' },
};

const SIZES: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { paddingVertical: 8, paddingHorizontal: 16, fontSize: 14 },
  md: { paddingVertical: 12, paddingHorizontal: 24, fontSize: 16 },
  lg: { paddingVertical: 16, paddingHorizontal: 32, fontSize: 18 },
};

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
}: ButtonProps) {
  const { hapticsEnabled } = useSettingsStore();
  const variantStyle = VARIANTS[variant];
  const sizeStyle = SIZES[size];

  const handlePress = () => {
    if (disabled || loading) return;
    if (hapticsEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: variantStyle.bg,
          borderColor: variantStyle.border || 'transparent',
          borderWidth: variantStyle.border ? 2 : 0,
          paddingVertical: sizeStyle.paddingVertical,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
        fullWidth && styles.fullWidth,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text} size="small" />
      ) : (
        <Text style={[styles.text, { color: variantStyle.text, fontSize: sizeStyle.fontSize }]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  text: {
    fontWeight: '600',
  },
});
