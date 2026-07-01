#!/usr/bin/env npx tsx
/**
 * Content-quality audit for the `vocabulary` table (example sentences + songs).
 *
 * The words themselves live in Supabase, so this script reads them either from:
 *   1. A JSON export:   npx tsx scripts/validate-content.ts data/vocabulary.json
 *      (an array of vocabulary rows, or { data: [...] })
 *   2. Supabase directly (paginated), using the same env vars as the app:
 *        EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 *      npx tsx scripts/validate-content.ts
 *
 * It focuses on the DIDACTIC content the single-word translations don't cover:
 * whole sentences + their translations, and the song feature.
 *
 * What it CAN check automatically (structure/consistency):
 *   - sentence/translation pairing and orphan fields
 *   - the target word actually appears in its example / song lyric
 *   - translation present and not a copy of the English
 *   - encoding/placeholder junk (mojibake, "undefined", stray markup)
 *   - duplicated example sentences / reused songs (lazy templating)
 *   - song attribution completeness (title + artist) and lyric length
 *
 * What it CANNOT check (needs a human or an LLM/grammar pass):
 *   - English grammar/naturalness  -> use scripts/validate-grammar.ts (LanguageTool)
 *   - translation accuracy/register -> human or bilingual LLM review
 *   - whether a song lyric is REAL and correctly attributed (LLM-seeded lyrics
 *     are often plausible but fabricated/misattributed) -> manual spot-check.
 *     The script prints the full song list at the end for exactly this.
 */

import { readFileSync } from 'node:fs';

interface VocabRow {
  id: string;
  word: string;
  cefr_level?: string;
  category?: string;
  example_sentence?: string | null;
  example_translation?: string | null;
  example_sentence_2?: string | null;
  example_translation_2?: string | null;
  song_lyric?: string | null;
  song_lyric_translation?: string | null;
  song_title?: string | null;
  song_artist?: string | null;
}

// ─── report helpers ──────────────────────────────────────────────────
let errors = 0;
let warnings = 0;
const SAMPLE = 8; // how many offending ids to print per check

function report(
  label: string,
  offenders: { id: string; word: string; detail?: string }[],
  level: 'error' | 'warn'
) {
  if (offenders.length === 0) return;
  if (level === 'error') errors += offenders.length;
  else warnings += offenders.length;
  const icon = level === 'error' ? '❌' : '⚠️ ';
  console.log(`\n${icon} ${label}: ${offenders.length}`);
  for (const o of offenders.slice(0, SAMPLE)) {
    console.log(`     - [${o.id}] ${o.word}${o.detail ? ` — ${o.detail}` : ''}`);
  }
  if (offenders.length > SAMPLE) console.log(`     … +${offenders.length - SAMPLE} more`);
}

// ─── text helpers ────────────────────────────────────────────────────
const norm = (s: string) => s.toLowerCase().normalize('NFC').trim();
const nonEmpty = (s?: string | null): s is string => !!s && s.trim().length > 0;

// Does `text` contain `word` (or a reasonable stem, for inflections)?
// Heuristic → reported as a warning, not a hard error.
function mentionsWord(text: string, word: string): boolean {
  const t = norm(text);
  const w = norm(word);
  if (!w) return true;
  // multi-word entry: require the first meaningful token
  const first = w.split(/\s+/)[0];
  const stem = first.length >= 5 ? first.slice(0, Math.ceil(first.length * 0.7)) : first;
  return t.includes(w) || t.includes(first) || t.includes(stem);
}

const MOJIBAKE = /(Ã.|â€|�|Â.)/; // common UTF-8 double-encoding artifacts
const PLACEHOLDER = /\b(undefined|null|todo|tbd|lorem ipsum|xxx)\b|_{3,}/i;

function junk(s: string): string | null {
  if (MOJIBAKE.test(s)) return 'posible mojibake/codificación';
  if (PLACEHOLDER.test(s)) return 'placeholder/valor sin rellenar';
  if (s !== s.trim()) return 'espacios sobrantes';
  if (/\s{2,}/.test(s)) return 'espacios dobles';
  return null;
}

// ─── data loading ────────────────────────────────────────────────────
async function loadRows(): Promise<VocabRow[]> {
  const fileArg = process.argv[2];
  if (fileArg) {
    const raw = JSON.parse(readFileSync(fileArg, 'utf8'));
    const rows = Array.isArray(raw) ? raw : raw.data;
    if (!Array.isArray(rows)) throw new Error('El JSON debe ser un array o { data: [...] }');
    console.log(`📄 Cargadas ${rows.length} filas desde ${fileArg}`);
    return rows;
  }

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error(
      '\nNo hay fuente de datos. Pasa un JSON export:\n' +
      '  npx tsx scripts/validate-content.ts data/vocabulary.json\n' +
      'o define EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY.\n'
    );
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key);
  const rows: VocabRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('vocabulary')
      .select('id, word, cefr_level, category, example_sentence, example_translation, example_sentence_2, example_translation_2, song_lyric, song_lyric_translation, song_title, song_artist')
      .order('frequency_rank', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as VocabRow[]));
    if (data.length < PAGE) break;
  }
  console.log(`☁️  Cargadas ${rows.length} filas desde Supabase`);
  return rows;
}

// ─── checks ──────────────────────────────────────────────────────────
function run(rows: VocabRow[]) {
  const A1A2 = new Set(['A1', 'A2']);

  // Example sentence pairs
  const orphanSentence: any[] = [];   // sentence without translation (or vice versa)
  const orphanExample2: any[] = [];   // example 2 present but example 1 empty
  const wordNotInExample: any[] = []; // sentence doesn't mention the word
  const untranslated: any[] = [];     // translation == english
  const junkExample: any[] = [];      // encoding/placeholder junk
  const longForLevel: any[] = [];     // A1/A2 word with a long sentence

  // Songs
  const withSong = rows.filter(r => nonEmpty(r.song_lyric) || nonEmpty(r.song_title) || nonEmpty(r.song_artist));
  const songNoAttribution: any[] = []; // lyric without title/artist
  const songNoLyric: any[] = [];       // title/artist without lyric
  const songUntranslated: any[] = [];  // translation missing or == lyric
  const wordNotInLyric: any[] = [];    // lyric doesn't mention the word
  const songTooLong: any[] = [];       // copyright risk / too much text
  const junkSong: any[] = [];

  const sentenceSeen = new Map<string, number>();
  const songSeen = new Map<string, number>();

  for (const r of rows) {
    const s1 = r.example_sentence, t1 = r.example_translation;
    const s2 = r.example_sentence_2, t2 = r.example_translation_2;

    // pairing
    if (nonEmpty(s1) !== nonEmpty(t1)) {
      orphanSentence.push({ id: r.id, word: r.word, detail: nonEmpty(s1) ? 'frase sin traducción' : 'traducción sin frase' });
    }
    if (nonEmpty(s2) && !nonEmpty(s1)) {
      orphanExample2.push({ id: r.id, word: r.word, detail: 'ejemplo 2 sin ejemplo 1' });
    }
    if (nonEmpty(s2) !== nonEmpty(t2) && (nonEmpty(s2) || nonEmpty(t2))) {
      orphanSentence.push({ id: r.id, word: r.word, detail: 'ejemplo 2 desparejado' });
    }

    for (const [s, t] of [[s1, t1], [s2, t2]] as const) {
      if (!nonEmpty(s)) continue;
      if (!mentionsWord(s, r.word)) wordNotInExample.push({ id: r.id, word: r.word, detail: `"${s.slice(0, 50)}…"` });
      if (nonEmpty(t) && norm(s) === norm(t)) untranslated.push({ id: r.id, word: r.word });
      const j = junk(s) || (nonEmpty(t) ? junk(t) : null);
      if (j) junkExample.push({ id: r.id, word: r.word, detail: j });
      if (A1A2.has(r.cefr_level || '') && s.split(/\s+/).length > 14) {
        longForLevel.push({ id: r.id, word: r.word, detail: `${s.split(/\s+/).length} palabras (${r.cefr_level})` });
      }
      const key = norm(s);
      sentenceSeen.set(key, (sentenceSeen.get(key) || 0) + 1);
    }

    // songs
    if (nonEmpty(r.song_lyric)) {
      if (!nonEmpty(r.song_title) || !nonEmpty(r.song_artist)) {
        songNoAttribution.push({ id: r.id, word: r.word, detail: 'falta título o artista' });
      }
      if (!nonEmpty(r.song_lyric_translation) || norm(r.song_lyric) === norm(r.song_lyric_translation!)) {
        songUntranslated.push({ id: r.id, word: r.word, detail: 'traducción ausente o igual al original' });
      }
      if (!mentionsWord(r.song_lyric, r.word)) {
        wordNotInLyric.push({ id: r.id, word: r.word, detail: `la letra no contiene "${r.word}"` });
      }
      const lines = r.song_lyric.split(/\n/).length;
      if (r.song_lyric.length > 200 || lines > 4) {
        songTooLong.push({ id: r.id, word: r.word, detail: `${r.song_lyric.length} car., ${lines} líneas` });
      }
      const j = junk(r.song_lyric) || (nonEmpty(r.song_lyric_translation) ? junk(r.song_lyric_translation) : null);
      if (j) junkSong.push({ id: r.id, word: r.word, detail: j });

      const skey = `${norm(r.song_title || '')} | ${norm(r.song_artist || '')}`;
      if (skey.trim() !== '|') songSeen.set(skey, (songSeen.get(skey) || 0) + 1);
    } else if (nonEmpty(r.song_title) || nonEmpty(r.song_artist)) {
      songNoLyric.push({ id: r.id, word: r.word, detail: 'título/artista sin letra' });
    }
  }

  const dupSentences = [...sentenceSeen.entries()].filter(([, n]) => n >= 5)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => ({ id: `x${n}`, word: `"${s.slice(0, 45)}…"`, detail: `reutilizada ${n} veces` }));
  const dupSongs = [...songSeen.entries()].filter(([, n]) => n >= 8)
    .sort((a, b) => b[1] - a[1])
    .map(([s, n]) => ({ id: `x${n}`, word: s, detail: `reutilizada ${n} veces` }));

  // ── report ──
  console.log('\n════════ FRASES DE EJEMPLO ════════');
  report('Frase/traducción desparejada', orphanSentence, 'error');
  report('Ejemplo 2 sin ejemplo 1', orphanExample2, 'error');
  report('Traducción == inglés (sin traducir)', untranslated, 'error');
  report('Junk/codificación/placeholder', junkExample, 'error');
  report('La palabra no aparece en su ejemplo (heurístico)', wordNotInExample, 'warn');
  report('Frase larga para nivel A1/A2', longForLevel, 'warn');
  report('Frases de ejemplo muy reutilizadas', dupSentences, 'warn');

  console.log('\n════════ CANCIONES ════════');
  console.log(`   (${withSong.length} entradas con datos de canción)`);
  report('Letra sin atribución (título/artista)', songNoAttribution, 'error');
  report('Título/artista sin letra', songNoLyric, 'error');
  report('Traducción de la letra ausente o == original', songUntranslated, 'error');
  report('Junk/codificación en canción', junkSong, 'error');
  report('La palabra no aparece en la letra (heurístico)', wordNotInLyric, 'warn');
  report('Letra larga (riesgo de copyright / exceso)', songTooLong, 'warn');
  report('Misma canción reutilizada en muchas palabras', dupSongs, 'warn');

  // ── manual-verification dump for songs (authenticity can't be auto-checked) ──
  if (withSong.length > 0) {
    console.log('\n──── Revisión MANUAL de autenticidad/atribución de canciones ────');
    console.log('   (verifica que la letra es real y el artista correcto)');
    for (const r of withSong.slice(0, 40)) {
      console.log(`   • ${r.word}: "${(r.song_lyric || '').slice(0, 60).replace(/\n/g, ' ')}…" — ${r.song_title || '¿?'} / ${r.song_artist || '¿?'}`);
    }
    if (withSong.length > 40) console.log(`   … +${withSong.length - 40} canciones más`);
  }

  console.log('\n════════════════════════════════════════');
  console.log(`  Filas: ${rows.length}   Errores: ${errors}   Avisos: ${warnings}`);
  console.log('════════════════════════════════════════');
}

loadRows().then(run).catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
