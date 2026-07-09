import React, { useRef } from 'react';
import { Pressable, Animated, StyleProp, ViewStyle } from 'react-native';

interface PressableScaleProps {
  onPress?: () => void;
  disabled?: boolean;
  // Estilo del área táctil (p.ej. { flex: 1 } en una fila de botones).
  containerStyle?: StyleProp<ViewStyle>;
  // Estilo visual del botón (fondo, padding, radio…): va en la vista animada.
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children: React.ReactNode;
}

// Feedback táctil sutil: el botón se encoge levemente al pulsar y vuelve.
// Animated + native driver (60fps, hilo de UI), funciona en nativo y en web.
export function PressableScale({
  onPress,
  disabled,
  containerStyle,
  style,
  scaleTo = 0.96,
  children,
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => !disabled && animateTo(scaleTo)}
      onPressOut={() => animateTo(1)}
      style={containerStyle}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
