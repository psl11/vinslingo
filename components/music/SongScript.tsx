import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { PressableScale } from '../ui/PressableScale';
import { parseInline, stripInline } from '../../lib/utils/inlineMarkdown';
import { loadArtistScripts } from '../../lib/data/scriptChunks';
import { colors, radius, spacing, fontSize, fontWeight } from '../../constants/theme';

// Guion de podcast de la canción (ver docs/podcast-scripts.md). Se escribe
// offline en ./guiones-podcast/*.md y se compila con
// scripts/build-podcast-scripts.mjs a lib/data/podcast/<artista>.json, que se
// carga en diferido y por artista (ver lib/data/scriptChunks.ts).
//
// Va ANTES de las notas porque es la capa de contexto más ancha: la historia de
// la canción. Las notas son el detalle fino, el vocabulario el ejercicio.
// Arranca plegado con un gancho: es mucho texto y no siempre se viene a leer.

type Part = { label: string; text: string };
type Block =
  | { t: 'p'; text: string }
  | { t: 'quote'; text: string }
  | { t: 'list'; items: string[] }
  | { t: 'verse'; verse: string; parts: Part[] };
type Section = { heading: string; blocks: Block[] };
export type Script = { title: string; artist: string; chapter: number | null; meta: string[]; sections: Section[] };

const norm = (s: string) => (s || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9]/g, '');

export function useSongScript(title?: string, artist?: string) {
  const [script, setScript] = useState<Script | null>(null);
  useEffect(() => {
    let active = true;
    if (!title || !artist) { setScript(null); return; }
    // El artista del catálogo puede venir como "Jay-Z, Kanye West"; el guion se
    // escribe para el principal, así que se compara contra el primero. Y solo se
    // descarga el fichero de ESE artista, no los de todos.
    const artistKey = norm(artist.split(',')[0]);
    loadArtistScripts(artistKey)
      .then((all) => {
        if (active) setScript(all[`${norm(title)}|${artistKey}`] ?? null);
      })
      .catch(() => { if (active) setScript(null); });
    return () => { active = false; };
  }, [title, artist]);
  return script;
}

/** Texto con `**negrita**` / `*cursiva*` resueltas. */
function Rich({ text, style }: { text: string; style?: any }) {
  return (
    <Text style={style}>
      {parseInline(text).map((s, i) => (
        <Text
          key={i}
          style={[s.bold && styles.bold, s.italic && styles.italic].filter(Boolean) as any}
        >
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

function BlockView({ block }: { block: Block }) {
  if (block.t === 'p') return <Rich text={block.text} style={styles.para} />;
  if (block.t === 'quote')
    return (
      <View style={styles.quote}>
        <Rich text={block.text} style={styles.quoteText} />
      </View>
    );
  if (block.t === 'list')
    return (
      <View style={styles.list}>
        {block.items.map((it, i) => (
          <View key={i} style={styles.listItem}>
            <Text style={styles.bullet}>·</Text>
            <Rich text={it} style={styles.listText} />
          </View>
        ))}
      </View>
    );
  // Verso comentado: el bloque con más valor de aprendizaje, así que se
  // destaca en tarjeta con el verso en grande y sus dos lecturas debajo.
  return (
    <View style={styles.verseCard}>
      <Text style={styles.verseText}>“{block.verse}”</Text>
      {block.parts.map((p, i) => (
        <View key={i} style={styles.versePart}>
          <Text style={styles.verseLabel}>{p.label}</Text>
          <Rich text={p.text} style={styles.versePartText} />
        </View>
      ))}
    </View>
  );
}

export function SongScript({ script }: { script: Script | null }) {
  const [open, setOpen] = useState(false);
  if (!script) return null;

  // Gancho: el primer párrafo del arranque en frío, que para eso está escrito.
  const teaser = stripInline(
    (script.sections[0]?.blocks.find((b) => b.t === 'p') as { text: string } | undefined)?.text ?? ''
  );

  return (
    <View style={styles.container}>
      <View style={styles.head}>
        <Text style={styles.sectionTitle}>🎙️ La historia de la canción</Text>
        {script.chapter ? (
          <View style={styles.chapterBadge}>
            <Text style={styles.chapterText}>cap. {script.chapter}</Text>
          </View>
        ) : null}
      </View>

      {!open ? (
        <PressableScale style={styles.card} onPress={() => setOpen(true)}>
          <Text style={styles.teaser} numberOfLines={4}>{teaser}</Text>
          <Text style={styles.more}>Leer la historia completa ↓</Text>
        </PressableScale>
      ) : (
        <View style={styles.card}>
          {script.meta.length > 0 && (
            <View style={styles.meta}>
              {script.meta.map((m, i) => (
                <Rich key={i} text={m} style={styles.metaText} />
              ))}
            </View>
          )}
          {script.sections.map((sec, i) => (
            <View key={i} style={styles.section}>
              <Text style={styles.heading}>{sec.heading}</Text>
              {sec.blocks.map((b, j) => (
                <BlockView key={j} block={b} />
              ))}
            </View>
          ))}
          <PressableScale style={styles.collapse} onPress={() => setOpen(false)}>
            <Text style={styles.more}>Plegar ↑</Text>
          </PressableScale>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  chapterBadge: {
    backgroundColor: colors.primarySurface, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  chapterText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: fontWeight.semibold },
  card: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg,
  },
  teaser: { fontSize: fontSize.base, color: colors.textStrong, lineHeight: 22 },
  more: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.semibold, marginTop: spacing.md },
  collapse: { alignItems: 'center', marginTop: spacing.sm },
  meta: {
    borderLeftWidth: 3, borderLeftColor: colors.primary,
    paddingLeft: spacing.md, marginBottom: spacing.lg, gap: 2,
  },
  metaText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 19 },
  section: { marginBottom: spacing.lg },
  heading: {
    fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  para: { fontSize: fontSize.base, color: colors.textStrong, lineHeight: 23, marginBottom: spacing.sm },
  bold: { fontWeight: fontWeight.bold, color: colors.textPrimary },
  italic: { fontStyle: 'italic' },
  quote: {
    backgroundColor: colors.warningSurface, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  quoteText: { fontSize: fontSize.sm, color: colors.warningText, lineHeight: 20 },
  list: { gap: spacing.xs, marginBottom: spacing.sm },
  listItem: { flexDirection: 'row', gap: spacing.sm },
  bullet: { color: colors.textTertiary, fontSize: fontSize.sm, lineHeight: 20 },
  listText: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  verseCard: {
    backgroundColor: colors.screen, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm,
  },
  verseText: {
    fontSize: fontSize.md, fontStyle: 'italic', fontWeight: fontWeight.semibold,
    color: colors.accentPurple, lineHeight: 22,
  },
  versePart: { gap: 2 },
  verseLabel: { fontSize: fontSize.xs, color: colors.textTertiary, fontWeight: fontWeight.semibold, textTransform: 'uppercase' },
  versePartText: { fontSize: fontSize.sm, color: colors.textStrong, lineHeight: 21 },
});
