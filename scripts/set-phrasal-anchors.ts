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
  type?: 'song' | 'movie' | 'book'; // por defecto 'song'
  year?: number;
  clearLyric?: boolean; // true = borrar la letra existente (ancla solo-título)
  lyric?: string; // verso que SÍ contiene el phrasal (cuando el título no)
  lyricEs?: string; // traducción del verso
}

// word (phave) -> ancla verificada (título que SÍ contiene el phrasal). Todas
// verificadas en la web. Los títulos no tienen copyright.
const ANCHORS: Record<string, Anchor> = {
  // Sin ancla hasta ahora. "Kiss and Make Up" (Dua Lipa & BLACKPINK, 2018).
  'make up': { title: 'Kiss and Make Up', creator: 'Dua Lipa & BLACKPINK', year: 2018, clearLyric: true },
  // Upgrade: la peli "Get Out" (Jordan Peele, 2017) es más icónica que la
  // canción genérica anterior.
  'get out': { title: 'Get Out', creator: 'Jordan Peele', type: 'movie', year: 2017, clearLyric: true },
  // Fix: la anterior ("Down by the River") no contenía el phrasal. "Comedown"
  // (Bush, 1995) sí (comedown = come down).
  'come down': { title: 'Comedown', creator: 'Bush', type: 'song', year: 1995, clearLyric: true },
  // Hueco. "Up" (Pixar, 2009): icónica y temáticamente perfecta (una casa que
  // SUBE con globos). Política: prima el ancla famosa aunque el título no lleve
  // el phrasal completo.
  'go up': { title: 'Up', creator: 'Pete Docter', type: 'movie', year: 2009, clearLyric: true },
  // Hueco. "Livin' on a Prayer" (Bon Jovi, 1986): icónica; "livin' on" = live on.
  'live on': { title: "Livin' on a Prayer", creator: 'Bon Jovi', type: 'song', year: 1986, clearLyric: true },
  // Hueco. "Lay Down Sally" (Eric Clapton, 1977): famosa; "lay down" (variante).
  'lie down': { title: 'Lay Down Sally', creator: 'Eric Clapton', type: 'song', year: 1977, clearLyric: true },

  // ── Subir de nivel anclas oscuras (artista poco conocido → famoso) ──
  // break down: Julie Roberts (oscura) → "Breakdown" (Tom Petty, 1976), título.
  'break down': { title: 'Breakdown', creator: 'Tom Petty and the Heartbreakers', type: 'song', year: 1976, clearLyric: true },
  // send out: Fee (oscura) → "Message in a Bottle" (The Police, 1979). El título
  // no lleva el phrasal, así que usamos el verso icónico.
  'send out': { title: 'Message in a Bottle', creator: 'The Police', type: 'song', year: 1979, lyric: "I'll send out an S.O.S. to the world", lyricEs: 'Lanzaré un S.O.S. al mundo' },
  // move up: Dannii Minogue (oscura) → "Moving On Up" (M People, 1993), título.
  'move up': { title: 'Moving On Up', creator: 'M People', type: 'song', year: 1993, clearLyric: true },
  // Fix: "Back to Black" no tenía nada que ver con "go back". "Back to the
  // Future" (Zemeckis, 1985) es icónica y va literalmente de VOLVER ATRÁS en el
  // tiempo — ancla temática perfecta (política: fama > título exacto).
  'go back': { title: 'Back to the Future', creator: 'Robert Zemeckis', type: 'movie', year: 1985, clearLyric: true },
};

async function main() {
  console.log(`\n${APPLY ? '🔧 APLICANDO' : '🔍 DRY-RUN'} — ${Object.keys(ANCHORS).length} anclas\n`);
  const words = Object.keys(ANCHORS);
  const { data: rows, error } = await supabase
    .from('vocabulary')
    .select('id, word, song_title, song_artist, anchor_type, anchor_year')
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
    const typeLabel = a.type && a.type !== 'song' ? ` [${a.type}]` : '';
    console.log(`• ${word}`);
    console.log(`  ANTES: ${row.song_title ? `${row.song_title} — ${row.song_artist}` : '(sin ancla)'}`);
    console.log(`  AHORA: ${a.title} — ${a.creator}${a.year ? `, ${a.year}` : ''}${typeLabel}`);
    if (APPLY) {
      const patch: Record<string, unknown> = {
        song_title: a.title,
        song_artist: a.creator,
        anchor_type: a.type || 'song',
        anchor_year: a.year || null,
      };
      if (a.lyric) {
        patch.song_lyric = a.lyric;
        patch.song_lyric_translation = a.lyricEs || null;
      } else if (a.clearLyric) {
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
