import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { PressableScale } from '../components/ui/PressableScale';
import { SongNotes, type Note } from '../components/music/SongNotes';
import { useSettingsStore } from '../stores/useSettingsStore';
import { analyzeTranslation } from '../lib/vocabulary/translationParser';
import { openSpotifySearch } from '../lib/utils/spotify';
import { colors, radius, spacing, fontSize, fontWeight } from '../constants/theme';

// Modo por canción: reúne el vocabulario y las notas de UNA canción (ver
// docs/song-expressions.md). El estudio reutiliza el flujo /study/music?songId.
export default function SongScreen() {
  const router = useRouter();
  const { songId, title, artist } = useLocalSearchParams<{ songId: string; title?: string; artist?: string }>();
  const { selectedCEFRLevels } = useSettingsStore();
  const [words, setWords] = useState<any[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          setLoading(true);
          const { getMusicVocabulary, getSongNotes } = await import('../lib/services/musicService');
          const [w, n] = await Promise.all([
            getMusicVocabulary({ songId, cefrLevels: selectedCEFRLevels, limit: 100 }),
            getSongNotes(songId),
          ]);
          if (active) { setWords(w); setNotes(n as Note[]); }
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [songId, selectedCEFRLevels])
  );

  const study = (typing: boolean) =>
    router.push({
      pathname: '/study/music',
      params: { songId, limit: String(Math.max(words.length, 1)), ...(typing ? { mode: 'typing' } : {}) },
    });

  const openSpotify = () => openSpotifySearch(title, artist);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </Pressable>
        <Text style={styles.title}>{title ?? 'Canción'}</Text>
        {artist ? <Text style={styles.artist}>{artist}</Text> : null}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {words.length > 0 && (
            <>
              <View style={styles.ctaRow}>
                <PressableScale style={[styles.cta, styles.ctaPrimary]} onPress={() => study(false)}>
                  <Text style={styles.ctaPrimaryText}>🃏 Estudiar ({words.length})</Text>
                </PressableScale>
                <PressableScale style={[styles.cta, styles.ctaSecondary]} onPress={() => study(true)}>
                  <Text style={styles.ctaSecondaryText}>⌨️ Escribir</Text>
                </PressableScale>
              </View>

              <Text style={styles.sectionTitle}>🗣️ Vocabulario</Text>
              {words.map((w) => {
                const a: any = analyzeTranslation(w.translation);
                const gloss =
                  a.kind === 'term' ? a.term
                  : a.kind === 'senses' ? (a.header ?? '')
                  : a.kind === 'raw' ? a.text
                  : w.translation;
                return (
                  <View key={w.id} style={styles.wordRow}>
                    <Text style={styles.word} numberOfLines={1}>{w.word}</Text>
                    <Text style={styles.gloss} numberOfLines={1}>{gloss}</Text>
                  </View>
                );
              })}
            </>
          )}

          <SongNotes notes={notes} />

          <PressableScale style={styles.spotify} onPress={openSpotify}>
            <Text style={styles.spotifyText}>▶  Escuchar en Spotify</Text>
          </PressableScale>
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
  artist: { fontSize: fontSize.base, color: colors.textSecondary, marginTop: spacing.xs },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  ctaRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  cta: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  ctaPrimary: { backgroundColor: colors.primary },
  ctaPrimaryText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  ctaSecondary: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  ctaSecondaryText: { color: colors.textSecondary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.md },
  wordRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  word: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary, maxWidth: '45%' },
  gloss: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1, textAlign: 'right' },
  spotify: {
    marginTop: spacing.xl, backgroundColor: colors.successSurface, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  spotifyText: { color: colors.successText, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
