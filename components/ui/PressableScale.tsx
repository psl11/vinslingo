import React, { useRef } from 'react';
import { Pressable, Animated, StyleProp, ViewStyle } from 'react-native';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableScaleProps {
  onPress?: () => void;
  disabled?: boolean;
  // Estilo del botón (mismo que pondrías en un <Pressable>): la escala se aplica
  // sobre el propio botón, sin envoltorios, así es un drop-in sin tocar layout.
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children: React.ReactNode;
}

// Feedback táctil sutil: el botón se encoge levemente al pulsar y vuelve.
// Animated + native driver (60fps, hilo de UI); funciona en nativo y en web.
// Drop-in de <Pressable>: <Pressable style={s}> → <PressableScale style={s}>.
export function PressableScale({
  onPress,
  disabled,
  style,
  scaleTo = 0.96,
  children,
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReduceMotion();

  const animateTo = (toValue: number) => {
    if (reduceMotion) return; // sin feedback de escala si se pide menos movimiento
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => !disabled && animateTo(scaleTo)}
      onPressOut={() => animateTo(1)}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}
