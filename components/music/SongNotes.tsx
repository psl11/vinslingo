import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AcronymText } from './AcronymText';
import { colors, radius, spacing, fontSize, fontWeight } from '../../constants/theme';

// Notas de una canción (capa 2): referencias culturales y juegos de palabras.
// No son fichas de repaso; son contexto para entender la letra. Cada una lleva
// su verso (con el término resaltado) + la explicación con tooltips de siglas.
export type Note = { id: string; kind: string; term: string; explanation: string; line_text: string | null };

const KIND_LABEL: Record<string, string> = { reference: 'Referencia', wordplay: 'Juego de palabras' };

// Resalta `term` dentro del verso (primera aparición, case-insensitive).
function Verse({ line, term }: { line: string; term: string }) {
  const idx = line.toLowerCase().indexOf(term.toLowerCase());
  return (
    <Text style={styles.verse}>
      {idx < 0 ? (
        `“${line}”`
      ) : (
        <>
          “{line.slice(0, idx)}
          <Text style={styles.verseBold}>{line.slice(idx, idx + term.length)}</Text>
          {line.slice(idx + term.length)}”
        </>
      )}
    </Text>
  );
}

export function SongNotes({ notes }: { notes: Note[] }) {
  if (!notes.length) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>📓 Notas de la canción</Text>
      <Text style={styles.sectionHint}>Referencias y juegos de palabras para entender la letra (no se repasan).</Text>
      {notes.map((n) => (
        <View key={n.id} style={styles.note}>
          <View style={styles.noteHeader}>
            <Text style={styles.term}>{n.term}</Text>
            <View style={styles.kindBadge}>
              <Text style={styles.kindText}>{KIND_LABEL[n.kind] ?? n.kind}</Text>
            </View>
          </View>
          {n.line_text ? <Verse line={n.line_text} term={n.term} /> : null}
          <AcronymText text={n.explanation} style={styles.explanation} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.xl },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  sectionHint: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md, lineHeight: 18 },
  note: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  term: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary, flexShrink: 1 },
  kindBadge: { backgroundColor: colors.warningSurface, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  kindText: { fontSize: fontSize.xs, color: colors.warningText, fontWeight: fontWeight.semibold },
  verse: {
    fontStyle: 'italic',
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  verseBold: { fontWeight: fontWeight.bold, color: colors.textPrimary, fontStyle: 'italic' },
  explanation: { fontSize: fontSize.base, color: colors.textStrong, lineHeight: 22 },
});
