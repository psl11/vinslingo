import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSyncStore } from '../../stores/useSyncStore';
import { colors, spacing, fontSize, fontWeight } from '../../constants/theme';

// Banner fino de estado. Da visibilidad del estado del sistema (Nielsen #1): el
// usuario sabe que sus repasos se guardan en local y se sincronizarán al
// reconectar, en vez de un fallo silencioso.
//
// Tres estados, de menos a más accionable:
//   1. Todo bien             → no se pinta nada.
//   2. Sin conexión          → aviso informativo.
//   3. Sesión caducada       → sigues estudiando en local, pero NADA se sincroniza.
//                              Si además hay red, el banner lleva al login.
export function SyncStatusBanner({ sessionExpired = false }: { sessionExpired?: boolean }) {
  const isOnline = useSyncStore((s) => s.isOnline);
  const insets = useSafeAreaInsets();
  const router = useRouter();

  if (isOnline && !sessionExpired) return null;

  const padding = { paddingTop: insets.top + spacing.xs };

  // Sesión caducada CON red: es lo único que el usuario puede arreglar ahora
  // mismo, así que el banner es pulsable y va al login.
  if (sessionExpired && isOnline) {
    return (
      <Pressable
        style={[styles.banner, styles.actionable, padding]}
        onPress={() => router.push('/(auth)/sign-in')}
        accessibilityRole="button"
        accessibilityLabel="Iniciar sesión para sincronizar tu progreso"
      >
        <Text style={[styles.text, styles.actionableText]}>
          🔑 Sesión caducada · tu progreso se guarda aquí. Toca para iniciar sesión y sincronizar
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.banner, padding]}>
      <Text style={styles.text}>
        {sessionExpired
          ? '📡 Modo sin conexión · tu progreso se guarda; al recuperar la red tendrás que iniciar sesión para sincronizar'
          : '📡 Sin conexión · tu progreso se guarda y se sincroniza al reconectar'}
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
  actionable: {
    backgroundColor: colors.primarySurface,
  },
  text: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.warningText,
    textAlign: 'center',
  },
  actionableText: {
    color: colors.primary,
  },
});
