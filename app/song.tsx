import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { PressableScale } from '../components/ui/PressableScale';
import { SongNotes, type Note } from '../components/music/SongNotes';
import { useSettingsStore } from '../stores/useSettingsStore';
import { analyzeTranslation } from '../lib/vocabulary/translationParser';
import { highlightRange } from '../lib/utils/highlight';
import { openSpotifySearch } from '../lib/utils/spotify';
import { colors, radius, spacing, fontSize, fontWeight } from '../constants/theme';

// Modo por canción (ver docs/song-expressions.md). Orden deliberado de la
// pantalla: primero QUÉ tiene de interesante la canción (las notas: trivia y
// referencias, el gancho que da ganas de estudiarla) y después el vocabulario,
// en filas que se despliegan para enseñar EL VERSO donde aparece cada palabra
// —que es el valor real— en vez de una lista plana de palabra + traducción.
type Word = {
  id: string;
  word: string;
  translation: string;
  part_of_speech?: string;
  example_sentence?: string;
  example_translation?: string;
  music_line?: string | null;
  music_highlight?: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  idiom: 'idiom',
  slang: 'slang',
  contraction: 'contracción',
  aave: 'gramática',
};
// Orden de lectura: lo más "aprendible" primero.
const TYPE_ORDER: Record<string, number> = { idiom: 0, slang: 1, contraction: 2, aave: 3 };

/** Verso con la palabra resaltada (mismo criterio que la ficha: límite de palabra). */
function Verse({ line, highlight }: { line: string; highlight?: string | null }) {
  const range = highlightRange(line, highlight);
  if (!range) return <Text style={styles.verse}>“{line}”</Text>;
  return (
    <Text style={styles.verse}>
      “{line.slice(0, range[0])}
      <Text style={styles.verseBold}>{line.slice(range[0], range[1])}</Text>
      {line.slice(range[1])}”
    </Text>
  );
}

export default function SongScreen() {
  const router = useRouter();
  const { songId, title, artist } = useLocalSearchParams<{ songId: string; title?: string; artist?: string }>();
  const { selectedCEFRLevels } = useSettingsStore();
  const [words, setWords] = useState<Word[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
          if (active) { setWords(w as Word[]); setNotes(n as Note[]); }
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }, [songId, selectedCEFRLevels])
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const study = (typing: boolean) =>
    router.push({
      pathname: '/study/music',
      params: { songId, limit: String(Math.max(words.length, 1)), ...(typing ? { mode: 'typing' } : {}) },
    });

  const sorted = [...words].sort(
    (a, b) => (TYPE_ORDER[a.part_of_speech ?? ''] ?? 9) - (TYPE_ORDER[b.part_of_speech ?? ''] ?? 9)
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Identidad de la canción: título, artista y Spotify juntos (el botón
          pertenece aquí, no perdido al final del scroll). */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </Pressable>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title ?? 'Canción'}</Text>
            {artist ? <Text style={styles.artist}>{artist}</Text> : null}
          </View>
          <PressableScale style={styles.spotifyBtn} onPress={() => openSpotifySearch(title, artist)}>
            <Text style={styles.spotifyBtnText}>▶</Text>
          </PressableScale>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Qué te llevas de esta canción + acción */}
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {words.length > 0 ? `🗣️ ${words.length} ${words.length === 1 ? 'palabra' : 'palabras'}` : ''}
              {words.length > 0 && notes.length > 0 ? '   ·   ' : ''}
              {notes.length > 0 ? `📓 ${notes.length} ${notes.length === 1 ? 'nota' : 'notas'}` : ''}
            </Text>
          </View>

          {words.length > 0 && (
            <View style={styles.ctaRow}>
              <PressableScale style={[styles.cta, styles.ctaPrimary]} onPress={() => study(false)}>
                <Text style={styles.ctaPrimaryText}>🃏 Estudiar</Text>
              </PressableScale>
              <PressableScale style={[styles.cta, styles.ctaSecondary]} onPress={() => study(true)}>
                <Text style={styles.ctaSecondaryText}>⌨️ Escribir</Text>
              </PressableScale>
            </View>
          )}

          {/* NOTAS PRIMERO: son el gancho, lo que da ganas de estudiar la canción */}
          <SongNotes notes={notes} />

          {/* Vocabulario: filas desplegables que enseñan el verso */}
          {sorted.length > 0 && (
            <View style={styles.vocabBlock}>
              <Text style={styles.sectionTitle}>🗣️ Vocabulario</Text>
              <Text style={styles.sectionHint}>Toca una palabra para ver el verso donde aparece.</Text>
              {sorted.map((w) => {
                const a: any = analyzeTranslation(w.translation);
                const gloss =
                  a.kind === 'term' ? a.term
                  : a.kind === 'senses' ? (a.header ?? '')
                  : a.kind === 'raw' ? a.text
                  : w.translation;
                const isOpen = expanded.has(w.id);
                const typeLabel = TYPE_LABEL[w.part_of_speech ?? ''];
                return (
                  <PressableScale key={w.id} style={styles.wordCard} onPress={() => toggle(w.id)}>
                    <View style={styles.wordHeader}>
                      <Text style={styles.word} numberOfLines={isOpen ? undefined : 1}>{w.word}</Text>
                      {typeLabel ? (
                        <View style={styles.typeBadge}><Text style={styles.typeBadgeText}>{typeLabel}</Text></View>
                      ) : null}
                      <Text style={styles.chevron}>{isOpen ? '⌃' : '⌄'}</Text>
                    </View>
                    <Text style={styles.gloss} numberOfLines={isOpen ? undefined : 1}>{gloss}</Text>

                    {isOpen && (
                      <View style={styles.wordDetail}>
                        {w.music_line ? <Verse line={w.music_line} highlight={w.music_highlight} /> : null}
                        {a.kind === 'term' && a.explanation ? (
                          <Text style={styles.explanation}>{a.explanation}</Text>
                        ) : null}
                        {w.example_sentence ? (
                          <View style={styles.example}>
                            <Text style={styles.exampleEn}>{w.example_sentence}</Text>
                            {w.example_translation ? (
                              <Text style={styles.exampleEs}>{w.example_translation}</Text>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    )}
                  </PressableScale>
                );
              })}
            </View>
          )}

          {words.length === 0 && notes.length === 0 && (
            <Text style={styles.emptyHint}>
              Esta canción aún no tiene contenido detallado.
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  artist: { fontSize: fontSize.base, color: colors.textSecondary, marginTop: spacing.xs },
  spotifyBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.successSurface, alignItems: 'center', justifyContent: 'center',
  },
  spotifyBtnText: { color: colors.successText, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  summary: { marginBottom: spacing.md },
  summaryText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  ctaRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  cta: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  ctaPrimary: { backgroundColor: colors.primary },
  ctaPrimaryText: { color: colors.onPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  ctaSecondary: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  ctaSecondaryText: { color: colors.textSecondary, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  vocabBlock: { marginTop: spacing.xl },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  sectionHint: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md },
  wordCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm,
  },
  wordHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  word: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  typeBadge: { backgroundColor: colors.primarySurface, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  typeBadgeText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: fontWeight.semibold },
  chevron: { fontSize: fontSize.md, color: colors.textTertiary },
  gloss: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  wordDetail: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.sm },
  verse: { fontStyle: 'italic', color: colors.accentPurple, fontSize: fontSize.sm, lineHeight: 20 },
  verseBold: { fontWeight: fontWeight.bold, fontStyle: 'italic' },
  explanation: { fontSize: fontSize.base, color: colors.textStrong, lineHeight: 21 },
  example: { gap: 2 },
  exampleEn: { fontSize: fontSize.sm, color: colors.textPrimary, fontStyle: 'italic' },
  exampleEs: { fontSize: fontSize.sm, color: colors.textSecondary },
  emptyHint: { fontSize: fontSize.base, color: colors.textSecondary, lineHeight: 22, textAlign: 'center', marginTop: spacing.xl },
});
