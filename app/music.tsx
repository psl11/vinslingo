import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { PressableScale } from '../components/ui/PressableScale';
import { useSettingsStore } from '../stores/useSettingsStore';
import { colors, radius, spacing, fontSize, fontWeight } from '../constants/theme';

const CARD_COUNT_OPTIONS = [5, 10, 15, 20];

// Nombre e icono legible por categoría de vocabulario.
const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  phave: { label: 'Phrasal verbs', emoji: '🚀' },
  american_slang: { label: 'Slang americano', emoji: '🇺🇸' },
  british_slang: { label: 'Slang británico', emoji: '🇬🇧' },
  idiom: { label: 'Idioms', emoji: '💬' },
  expression: { label: 'Expresiones', emoji: '🗯️' },
  collocation: { label: 'Colocaciones', emoji: '🔗' },
  false_friend: { label: 'Falsos amigos', emoji: '🎭' },
  confusing_pair: { label: 'Pares confusos', emoji: '🔀' },
  connector: { label: 'Conectores', emoji: '🧩' },
  ngsl: { label: 'Vocabulario', emoji: '📖' },
  colloquial: { label: 'Coloquial', emoji: '🗣️' },
};
const catMeta = (c: string) => CATEGORY_META[c] ?? { label: c, emoji: '📖' };

type Cat = { category: string; wordCount: number };
type Artist = { id: string; name: string; wordCount: number; songCount: number };
type Song = { id: string; title: string; artist: string | null; wordCount: number; noteCount: number };

export default function MusicScreen() {
  const router = useRouter();
  const { selectedCEFRLevels } = useSettingsStore();
  const [cardsPerRound, setCardsPerRound] = useState(10);
  const [typing, setTyping] = useState(false);
  const [totals, setTotals] = useState({ words: 0, songs: 0 });
  const [categories, setCategories] = useState<Cat[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          setIsLoading(true);
          const { getMusicWordCount, getMusicCategories, getMusicArtists, getMusicSongs } = await import('../lib/services/musicService');
          const [t, c, a, s] = await Promise.all([
            getMusicWordCount(),
            getMusicCategories(selectedCEFRLevels),
            getMusicArtists(selectedCEFRLevels),
            getMusicSongs(selectedCEFRLevels),
          ]);
          if (active) { setTotals(t); setCategories(c); setArtists(a); setSongs(s); }
        } catch (e) {
          console.error('Error loading music hub:', e);
        } finally {
          if (active) setIsLoading(false);
        }
      })();
      return () => { active = false; };
    }, [selectedCEFRLevels])
  );

  const go = (params: Record<string, string>) => {
    router.push({
      pathname: '/study/music',
      params: { limit: String(cardsPerRound), ...(typing ? { mode: 'typing' } : {}), ...params },
    });
  };

  const Row = ({ emoji, label, count, onPress }: { emoji: string; label: string; count: number; onPress: () => void }) => (
    <PressableScale style={styles.row} onPress={onPress}>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.countBadge}><Text style={styles.countText}>{count}</Text></View>
      <Text style={styles.rowChevron}>›</Text>
    </PressableScale>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </Pressable>
        <Text style={styles.title}>🎵 Aprende con tu música</Text>
        <Text style={styles.subtitle}>
          {totals.words} palabras de tu vocabulario aparecen en {totals.songs} de tus canciones.
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : totals.words === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyEmoji}>🎧</Text>
          <Text style={styles.emptyText}>
            Aún no hay coincidencias entre tu música y tu vocabulario. Vuelve a intentarlo en un momento.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Controles */}
          <Text style={styles.cardCountLabel}>Tarjetas por ronda</Text>
          <View style={styles.cardCountRow}>
            {CARD_COUNT_OPTIONS.map((n) => (
              <PressableScale
                key={n}
                style={[styles.cardCountChip, cardsPerRound === n && styles.cardCountChipSelected]}
                onPress={() => setCardsPerRound(n)}
              >
                <Text style={[styles.cardCountText, cardsPerRound === n && styles.cardCountTextSelected]}>{n}</Text>
              </PressableScale>
            ))}
          </View>

          <View style={styles.modeRow}>
            {([[false, '🃏 Tarjetas'], [true, '⌨️ Escribir']] as [boolean, string][]).map(([val, label]) => (
              <PressableScale
                key={label}
                style={[styles.modeChip, typing === val && styles.modeChipSelected]}
                onPress={() => setTyping(val)}
              >
                <Text style={[styles.modeText, typing === val && styles.modeTextSelected]}>{label}</Text>
              </PressableScale>
            ))}
          </View>

          {/* Top recurrentes */}
          <PressableScale style={styles.topCard} onPress={() => go({ top: '1' })}>
            <Text style={styles.rowEmoji}>🔥</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.topTitle}>Top recurrentes</Text>
              <Text style={styles.topDesc}>Las palabras que salen en más de tus canciones</Text>
            </View>
            <Text style={styles.rowChevron}>›</Text>
          </PressableScale>

          {/* Por canción */}
          {songs.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Por canción</Text>
              {songs.map((s) => (
                <PressableScale
                  key={s.id}
                  style={styles.row}
                  onPress={() => router.push({ pathname: '/song', params: { songId: s.id, title: s.title, artist: s.artist ?? '' } })}
                >
                  <Text style={styles.rowEmoji}>🎵</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel} numberOfLines={1}>{s.title}</Text>
                    {s.artist ? <Text style={styles.rowSub} numberOfLines={1}>{s.artist}</Text> : null}
                  </View>
                  {s.noteCount > 0 ? <Text style={styles.noteDot}>📓 {s.noteCount}</Text> : null}
                  <View style={styles.countBadge}><Text style={styles.countText}>{s.wordCount}</Text></View>
                  <Text style={styles.rowChevron}>›</Text>
                </PressableScale>
              ))}
            </>
          )}

          {/* Por tipo */}
          <Text style={styles.sectionTitle}>Por tipo</Text>
          {categories.map((c) => {
            const m = catMeta(c.category);
            return <Row key={c.category} emoji={m.emoji} label={m.label} count={c.wordCount} onPress={() => go({ musicCategory: c.category })} />;
          })}

          {/* Por artista */}
          <Text style={styles.sectionTitle}>Por artista</Text>
          {artists.map((a) => (
            <Row key={a.id} emoji="🎤" label={a.name} count={a.wordCount} onPress={() => go({ artistId: a.id })} />
          ))}
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
  subtitle: { fontSize: fontSize.base, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 20 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  cardCountLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginBottom: spacing.md },
  cardCountRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  cardCountChip: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  cardCountChipSelected: { backgroundColor: colors.primarySurface, borderColor: colors.primary },
  cardCountText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textSecondary },
  cardCountTextSelected: { color: colors.primary },
  modeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xxl },
  modeChip: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  modeChipSelected: { backgroundColor: colors.accentPurpleSurface, borderColor: colors.accentPurple },
  modeText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  modeTextSelected: { color: colors.accentPurple },
  topCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.accentPurpleSurface, borderWidth: 1.5, borderColor: colors.accentPurpleBorder,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl,
  },
  topTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  topDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xxs },
  sectionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.sm,
  },
  rowEmoji: { fontSize: 22 },
  rowLabel: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  rowSub: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 1 },
  noteDot: { fontSize: fontSize.xs, color: colors.warningText },
  countBadge: { backgroundColor: colors.primarySurface, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.sm, minWidth: 34, alignItems: 'center' },
  countText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
  rowChevron: { fontSize: 24, color: colors.textTertiary, fontWeight: fontWeight.regular },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.huge },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
