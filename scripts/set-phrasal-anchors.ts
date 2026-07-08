#!/usr/bin/env npx tsx
/**
 * Fija/actualiza el "ancla" (canción, película o libro famoso con el phrasal en
 * el título) de phrasal verbs, para reforzar la memorización. Solo se usan
 * TÍTULOS reales verificados (los títulos no tienen copyright).
 *
 * Fase A (canciones): reutiliza song_title/song_artist (sin letra: las anclas
 * nuevas no llevan verso, solo el título). Las de tipo película/libro (Fase B)
 * necesitan las columnas anchor_type/anchor_year en Supabase (ALTER TABLE).
 *
 * Uso:
 *   npx tsx scripts/set-phrasal-anchors.ts           # dry-run
 *   npx tsx scripts/set-phrasal-anchors.ts --apply    # aplica
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY (cargar .env).
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Anchor {
  title: string;
  creator: string; // artista / director / autor
  clearLyric?: boolean; // true = borrar la letra existente (ancla solo-título)
}

// word (phave) -> ancla verificada
const ANCHORS: Record<string, Anchor> = {
  // Sin ancla hasta ahora. Verificado: "Kiss and Make Up" (Dua Lipa & BLACKPINK,
  // 2018) contiene "make up" en el título.
  'make up': { title: 'Kiss and Make Up', creator: 'Dua Lipa & BLACKPINK', clearLyric: true },
};

async function main() {
  console.log(`\n${APPLY ? '🔧 APLICANDO' : '🔍 DRY-RUN'} — ${Object.keys(ANCHORS).length} anclas\n`);
  const words = Object.keys(ANCHORS);
  const { data: rows, error } = await supabase
    .from('vocabulary')
    .select('id, word, song_title, song_artist')
    .eq('category', 'phave')
    .in('word', words);
  if (error) {
    console.error('Error leyendo vocabulary:', error);
    process.exit(1);
  }
  const byWord = new Map((rows || []).map((r) => [r.word, r]));
  let updated = 0;
  for (const word of words) {
    const row = byWord.get(word);
    if (!row) {
      console.warn(`⚠️  no encontrada en phave: "${word}"`);
      continue;
    }
    const a = ANCHORS[word];
    console.log(`• ${word}`);
    console.log(`  ANTES: ${row.song_title ? `${row.song_title} — ${row.song_artist}` : '(sin ancla)'}`);
    console.log(`  AHORA: ${a.title} — ${a.creator}`);
    if (APPLY) {
      const patch: Record<string, unknown> = { song_title: a.title, song_artist: a.creator };
      if (a.clearLyric) {
        patch.song_lyric = null;
        patch.song_lyric_translation = null;
      }
      const { error: upErr } = await supabase.from('vocabulary').update(patch).eq('id', row.id);
      if (upErr) {
        console.error(`  ❌ error al actualizar ${word}:`, upErr);
        continue;
      }
      updated++;
    }
  }
  console.log(`\n${APPLY ? `✅ ${updated} anclas actualizadas` : 'ℹ️  dry-run. Añade --apply.'}\n`);
}

main();
