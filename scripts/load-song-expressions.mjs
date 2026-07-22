#!/usr/bin/env node
/**
 * Carga en Supabase los mazos del extractor LLM de expresiones de canciones
 * (ver docs/song-expressions.md). Dos capas:
 *   - Capa 1 (colloquial): vocabulario global reutilizable → tabla `vocabulary`
 *     (category='colloquial'), deduplicado, + ancla a las canciones donde aparece
 *     vía `song_vocabulary` (busca el verso en letras-playlist.txt para line_text).
 *   - Capa 2 (notas): → tabla `song_notes` (con el verso de contexto del mazo).
 *
 * Idempotente: IDs deterministas (detId), re-ejecutable sin churn.
 * Uso:  node scripts/load-song-expressions.mjs [--apply] [--decks-dir <dir>]
 *
 * Los mazos (batchN-decks.json) se generan en sesión (Claude como extractor) y
 * son locales, como letras-playlist.txt (gitignored). El contenido, una vez en
 * la BD, se versiona vía el backup (song_notes está en CONTENT_TABLES).
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const APPLY = process.argv.includes('--apply');
const di = process.argv.indexOf('--decks-dir');
const DECKS_DIR = di >= 0 ? process.argv[di + 1]
  : '/private/tmp/claude-501/-Users-pablosanchez-CascadeProjects-Vinslingo/705c69d9-75d5-479a-b97c-fe3098510827/scratchpad';
const REPO = '/Users/pablosanchez/CascadeProjects/Vinslingo';
const LYRICS = `${REPO}/letras-playlist.txt`;
const CEFR = 'B2'; // registro coloquial/slang, como el resto del slang

const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const detId = (k) => { const h = createHash('sha1').update(k).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`; };
const norm = (s) => (s || '').toLowerCase().replace(/[.,!?$&"()\/]/g, '').replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// --- letras: bloques por título ---
const lyricBlocks = new Map(); // titleNorm -> lines[]
{
  const raw = fs.readFileSync(LYRICS, 'utf8').split('\n');
  let cur = null;
  for (const line of raw) {
    const m = line.match(/^###\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*$/);
    if (m) { cur = { title: m[2], lines: [] }; lyricBlocks.set(norm(m[2]), cur.lines); }
    else if (cur) cur.lines.push(line);
  }
}
const isSection = (l) => /^\[.*\]$/.test(l.trim());

// Candidatos de literal buscable a partir del `front` (que a veces lleva una
// etiqueta gramatical entre paréntesis, a veces en la cabecera, a veces dentro).
// Se prueban en orden: la cabecera, y el contenido del paréntesis.
function surfaceCandidates(front) {
  const out = [];
  const head = front.split(' (')[0].trim();
  const paren = (front.match(/\(([^)]+)\)/) || [])[1];
  for (let cand of [head, paren]) {
    if (!cand) continue;
    cand = cand.split('/')[0].split('=')[0].trim();       // 1ª variante
    if (/^-?in'\b|droppin|gerundio/i.test(cand) || cand.length < 2) continue;
    // fuera etiquetas en español y placeholders
    if (/negación|cópula|posesivo|persona|dancehall|acr[óo]nimo/i.test(cand)) continue;
    const cleaned = cand.replace(/\b(someone|something|one's|your|somebody|yourself)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned && !out.includes(cleaned)) out.push(cleaned);
  }
  return out;
}

// Busca el verso (3 líneas) donde aparece alguno de los `surfaces` en la canción.
function findVerse(title, surfaces) {
  const lines = lyricBlocks.get(norm(title));
  if (!lines || !surfaces.length) return null;
  const real = lines.filter((l) => l.trim() && !isSection(l));
  for (const surface of surfaces) {
    const toks = surface.split(/\s+/).map((t) => esc(t).replace(/^'/, "'?"));
    // límite inicial tolerante con apóstrofo inicial ('bout, 'sposed)
    const re = new RegExp("(?:^|[^\\w'])" + toks.join("[\\w' ,]*?\\s*") + '\\b', 'i');
    for (let i = 0; i < real.length; i++) {
      const mm = real[i].replace(/[’]/g, "'").match(re);
      if (mm) {
        const verse = [real[i - 1], real[i], real[i + 1]].filter(Boolean).map((l) => l.trim()).join('\n');
        return { verse, surface: mm[0].replace(/^[^\w']+/, '').trim(), idx: i };
      }
    }
  }
  return null;
}

// translation con el registro metido en la cabecera: "HEADER (malsonante) — expl".
function withRegister(translation, register) {
  if (!register) return translation;
  const i = translation.indexOf(' — ');
  if (i < 0) return `${translation} (${register})`;
  return `${translation.slice(0, i)} (${register})${translation.slice(i)}`;
}

async function main() {
  console.log(`\n${APPLY ? '🔧 APLICANDO' : '🔍 DRY-RUN'}  (decks: ${DECKS_DIR})\n`);

  // mapa título(norm) -> song_id (source=user)
  const { data: dbSongs, error: se } = await supabase.from('songs').select('id, title').eq('source', 'user');
  if (se) { console.error(se); process.exit(1); }
  const songIdByTitle = new Map(dbSongs.map((s) => [norm(s.title), s.id]));

  // Todos los mazos batchN-decks.json del directorio (auto-incluye lotes nuevos).
  const deckFiles = fs.readdirSync(DECKS_DIR).filter((f) => /^batch\d+-decks\.json$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
  console.log(`Mazos: ${deckFiles.join(', ')}`);
  const decks = deckFiles.map((f) => JSON.parse(fs.readFileSync(path.join(DECKS_DIR, f), 'utf8')));

  const vocabRows = new Map();  // word(lower) -> row (dedup global)
  const svRows = [];            // anclas song_vocabulary
  const noteRows = [];          // song_notes
  const anchorStats = { hit: 0, miss: [] };
  const songMiss = new Set();

  for (const deck of decks) {
    for (const song of deck.songs) {
      const sid = songIdByTitle.get(norm(song.title));
      if (!sid) { songMiss.add(song.title); continue; }

      for (const c of song.layer1) {
        const word = c.front.trim();
        const key = word.toLowerCase();
        if (!vocabRows.has(key)) {
          vocabRows.set(key, {
            id: detId('colloquial:' + key),
            word,
            translation: withRegister(c.translation, c.register),
            category: 'colloquial',
            cefr_level: CEFR,
            part_of_speech: c.type,             // contraction|aave|slang|idiom
            example_sentence: c.example_en || null,
            example_translation: c.example_es || null,
          });
        }
        const vid = vocabRows.get(key).id;
        // ancla: buscar verso
        const v = findVerse(song.title, surfaceCandidates(word));
        if (v) {
          anchorStats.hit++;
          svRows.push({ id: detId(`sv:${sid}|${vid}`), song_id: sid, vocabulary_id: vid, line_text: v.verse, highlighted_word: v.surface, line_index: v.idx });
        } else {
          anchorStats.miss.push(`${word} [${song.title}]`);
        }
      }

      for (const n of song.layer2) {
        noteRows.push({
          id: detId(`note:${sid}|${n.term.toLowerCase()}`),
          song_id: sid, kind: n.kind, term: n.term,
          explanation: n.explanation, line_text: n.line_text || null,
        });
      }
    }
  }

  // dedup svRows por id (una palabra puede repetirse en una canción)
  const svUniq = [...new Map(svRows.map((r) => [r.id, r])).values()];

  console.log(`Capa 1 (colloquial): ${vocabRows.size} fichas únicas`);
  console.log(`  anclas song_vocabulary: ${svUniq.length} (verso encontrado en ${anchorStats.hit} apariciones)`);
  console.log(`  sin verso (no se anclan, siguen como ficha): ${anchorStats.miss.length}`);
  if (anchorStats.miss.length) console.log('    ' + anchorStats.miss.slice(0, 20).join(', ') + (anchorStats.miss.length > 20 ? '…' : ''));
  console.log(`Capa 2 (song_notes): ${noteRows.length} notas`);
  if (songMiss.size) console.log(`⚠️  canciones no mapeadas en la BD: ${[...songMiss].join(', ')}`);

  if (!APPLY) { console.log('\nℹ️  dry-run. Añade --apply.\n'); return; }

  const vocabArr = [...vocabRows.values()];
  for (let i = 0; i < vocabArr.length; i += 200) {
    const { error } = await supabase.from('vocabulary').upsert(vocabArr.slice(i, i + 200), { onConflict: 'id' });
    if (error) { console.error('vocab upsert', error); process.exit(1); }
  }
  for (let i = 0; i < svUniq.length; i += 200) {
    const { error } = await supabase.from('song_vocabulary').upsert(svUniq.slice(i, i + 200), { onConflict: 'id' });
    if (error) { console.error('sv upsert', error); process.exit(1); }
  }
  for (let i = 0; i < noteRows.length; i += 200) {
    const { error } = await supabase.from('song_notes').upsert(noteRows.slice(i, i + 200), { onConflict: 'id' });
    if (error) { console.error('notes upsert', error); process.exit(1); }
  }
  console.log(`\n✅ Cargado: ${vocabArr.length} coloquiales, ${svUniq.length} anclas, ${noteRows.length} notas.`);
  console.log('▶ Ejecuta: npm run backup:supabase && npm run validate:content\n');
}
main();
