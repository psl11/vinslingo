import React, { useState } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { PressableScale } from '../ui/PressableScale';
import { highlightRanges } from '../../lib/utils/highlight';
import { colors, radius, spacing, fontSize, fontWeight } from '../../constants/theme';

// Letra de la canción, debajo de la historia. Dos modos, y cuál sale depende de
// lo que la cuenta tenga permiso para ver:
//
//   1. LETRA COMPLETA — solo si Supabase devuelve fila de `song_lyrics`, que
//      está protegida con RLS. Ver docs/song-lyrics-privadas.md.
//   2. VERSOS GUARDADOS — el modo por defecto: los fragmentos de contexto que
//      ya guardamos al anclar cada palabra, en orden de aparición. No es la
//      letra, y es lo único que la política del proyecto permite empaquetar.
//
// En los dos casos se ofrece el enlace a Genius, que es la fuente.

export type Verse = { line_index: number; line_text: string; highlighted: string[] };

/** Una línea con sus palabras ancladas en negrita. */
function Line({ text, highlighted }: { text: string; highlighted: string[] }) {
  const ranges = highlightRanges(text, highlighted);
  if (!ranges.length) return <Text style={styles.line}>{text}</Text>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <Text key={i} style={styles.lineBold}>
        {text.slice(start, end)}
      </Text>
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <Text style={styles.line}>{parts}</Text>;
}

export function SongLyrics({
  verses,
  fullLyrics,
  title,
  artist,
}: {
  verses: Verse[];
  fullLyrics: string | null;
  title?: string;
  artist?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!verses.length && !fullLyrics) return null;

  const geniusUrl = `https://genius.com/search?q=${encodeURIComponent(`${title ?? ''} ${artist ?? ''}`.trim())}`;
  const total = fullLyrics ? fullLyrics.split('\n').filter((l) => l.trim()).length : verses.length;

  return (
    <View style={styles.container}>
      <View style={styles.head}>
        <Text style={styles.sectionTitle}>📄 Letra</Text>
        {!fullLyrics && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>fragmentos</Text>
          </View>
        )}
      </View>
      <Text style={styles.hint}>
        {fullLyrics
          ? 'Letra completa. Solo visible desde tu cuenta.'
          : `Los ${total} ${total === 1 ? 'verso' : 'versos'} de esta canción que tenemos guardados, en orden. Las palabras en negrita son las que puedes estudiar.`}
      </Text>

      <PressableScale style={styles.card} onPress={() => setOpen((v) => !v)}>
        {!open ? (
          <>
            {fullLyrics ? (
              <Text style={styles.line} numberOfLines={4}>{fullLyrics}</Text>
            ) : (
              <Line text={verses[0].line_text} highlighted={verses[0].highlighted} />
            )}
            <Text style={styles.more}>Ver la letra ↓</Text>
          </>
        ) : (
          <>
            {fullLyrics ? (
              <Text style={styles.line}>{fullLyrics}</Text>
            ) : (
              verses.map((v, i) => (
                <View key={v.line_index} style={i > 0 && styles.verseGap}>
                  <Line text={v.line_text} highlighted={v.highlighted} />
                </View>
              ))
            )}
            <Text style={styles.more}>Plegar ↑</Text>
          </>
        )}
      </PressableScale>

      <PressableScale style={styles.geniusBtn} onPress={() => Linking.openURL(geniusUrl)}>
        <Text style={styles.geniusText}>Ver la letra completa en Genius ↗</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  badge: {
    backgroundColor: colors.warningSurface, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  badgeText: { fontSize: fontSize.xs, color: colors.warningText, fontWeight: fontWeight.semibold },
  hint: {
    fontSize: fontSize.sm, color: colors.textSecondary,
    marginTop: spacing.xs, marginBottom: spacing.md, lineHeight: 18,
  },
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg,
  },
  line: { fontSize: fontSize.base, color: colors.textStrong, lineHeight: 23, fontStyle: 'italic' },
  lineBold: { fontWeight: fontWeight.bold, color: colors.accentPurple, fontStyle: 'italic' },
  verseGap: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  more: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.semibold, marginTop: spacing.md },
  geniusBtn: { alignItems: 'center', paddingVertical: spacing.md },
  geniusText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
});
