import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSyncStore } from '../../stores/useSyncStore';
import { colors, spacing, fontSize, fontWeight } from '../../constants/theme';

// Banner fino de "sin conexión". Da visibilidad del estado del sistema (Nielsen
// #1): el usuario sabe que sus repasos se guardan en local y se sincronizarán al
// reconectar, en vez de un fallo silencioso. Solo aparece si está offline.
export function SyncStatusBanner() {
  const isOnline = useSyncStore((s) => s.isOnline);
  const insets = useSafeAreaInsets();

  if (isOnline) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + spacing.xs }]}>
      <Text style={styles.text}>
        📡 Sin conexión · tu progreso se guarda y se sincroniza al reconectar
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warningSurface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  text: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.warningText,
    textAlign: 'center',
  },
});
