import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { PressableScale } from '../components/ui/PressableScale';
import { useSettingsStore } from '../stores/useSettingsStore';
import { colors, radius, spacing, fontSize, fontWeight } from '../constants/theme';

// Pantalla de artista: se entra AQUÍ desde el hub (no a un listado plano de todas
// las canciones, que con ~300 sería un scroll enorme). Ofrece repasar todo el
// contenido del artista, o elegir una de sus canciones enriquecidas.
type Song = { id: string; title: string; artist: string | null; wordCount: number; noteCount: number };

export default function ArtistScreen() {
  const router = useRouter();
  const { artistId, name, wordCount } = useLocalSearchParams<{ artistId: string; name?: string; wordCount?: string }>();
  const { selectedCEFRLevels } = useSettingsStore();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          setLoading(true);
          const { getMusicSongs } = await import('../lib/services/musicService');
          const s = await getMusicSongs({ artistId, cefrLevels: selectedCEFRLevels });
          if (active) setSongs(s);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [artistId, selectedCEFRLevels])
  );

  const total = wordCount ? parseInt(wordCount, 10) : 0;
  const reviewAll = (typing: boolean) =>
    router.push({
      pathname: '/study/music',
      params: { artistId, limit: String(Math.max(total, 1)), ...(typing ? { mode: 'typing' } : {}) },
    });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </Pressable>
        <Text style={styles.title}>🎤 {name ?? 'Artista'}</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.ctaRow}>
            <PressableScale style={[styles.cta, styles.ctaPrimary]} onPress={() => reviewAll(false)}>
              <Text style={styles.ctaPrimaryText}>🎧 Repasar todo{total ? ` (${total})` : ''}</Text>
            </PressableScale>
            <PressableScale style={[styles.cta, styles.ctaSecondary]} onPress={() => reviewAll(true)}>
              <Text style={styles.ctaSecondaryText}>⌨️ Escribir</Text>
            </PressableScale>
          </View>

          {songs.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Canciones</Text>
              {songs.map((s) => (
                <PressableScale
                  key={s.id}
                  style={styles.row}
                  onPress={() => router.push({ pathname: '/song', params: { songId: s.id, title: s.title, artist: s.artist ?? name ?? '' } })}
                >
                  <Text style={styles.rowEmoji}>🎵</Text>
                  <Text style={styles.rowLabel} numberOfLines={1}>{s.title}</Text>
                  {s.noteCount > 0 ? <Text style={styles.noteDot}>📓 {s.noteCount}</Text> : null}
                  <View style={styles.countBadge}><Text style={styles.countText}>{s.wordCount}</Text></View>
                  <Text style={styles.rowChevron}>›</Text>
                </PressableScale>
              ))}
            </>
          ) : (
            <Text style={styles.emptyHint}>
              Este artista aún no tiene canciones con contenido detallado. Puedes repasar todo su vocabulario con el botón de arriba.
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screen },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  backBtn: { marginBottom: spacing.md },
  backBtnText: { fontSize: fontSize.md, color: colors.primary, fontWeight: fontWeight.medium },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  ctaRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  cta: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  ctaPrimary: { backgroundColor: colors.primary },
  ctaPrimaryText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  ctaSecondary: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  ctaSecondaryText: { color: colors.textSecondary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.sm,
  },
  rowEmoji: { fontSize: 22 },
  rowLabel: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  noteDot: { fontSize: fontSize.xs, color: colors.warningText },
  countBadge: { backgroundColor: colors.primarySurface, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.sm, minWidth: 34, alignItems: 'center' },
  countText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  rowChevron: { fontSize: 24, color: colors.textTertiary, fontWeight: fontWeight.regular },
  emptyHint: { fontSize: fontSize.base, color: colors.textSecondary, lineHeight: 22, textAlign: 'center', marginTop: spacing.xl },
});
