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

/**
 * Expresiones del extractor que YA existen en el vocabulario curado con el MISMO
 * significado. En vez de crear una ficha `colloquial` duplicada, se ancla la ficha
 * curada a la canción: una sola ficha por expresión, y el verso cambia según la
 * canción (que es justo el modelo de la feature).
 *
 * OJO, solo se listan aquí los duplicados de VERDAD. Los HOMÓGRAFOS (misma
 * grafía, significado distinto) se quedan como ficha propia: `ill` = enfermo
 * (ngsl) vs genial (slang), `cheese` = queso vs pasta, `ball` = pelota vs vivir
 * a lo grande, `heat` = calor vs temazo, `put on` = ponerse ropa vs dar un
 * empujón, `come up` = surgir vs un chollo, `get on` = subirse vs triunfar.
 * Fusionarlos sería un error de contenido.
 *
 * clave = `front` del mazo (en minúsculas) → ficha curada destino.
 */
const MERGE_INTO_CURATED = {
  'in spite of': { word: 'in spite of', category: 'connector' },
  'open up (to someone)': { word: 'open up', category: 'phave' },
  'run away': { word: 'run away', category: 'phave' },
  'settle down': { word: 'settle down', category: 'phave' },
  'get away': { word: 'get away', category: 'phave' },
  'figure something out': { word: 'figure out', category: 'phave' },
  'give in': { word: 'give in', category: 'phave' },
  "i don't mind": { word: "I don't mind", category: 'expression' },
  'never mind': { word: 'never mind', category: 'expression' },
  'brand-new': { word: 'brand-new', category: 'ngsl' },
  'take someone out': { word: 'take out', category: 'phave' },
  'grand': { word: 'grand', category: 'british_slang' },
};
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

  // Fichas curadas destino de MERGE_INTO_CURATED (se anclan en vez de duplicar).
  const curatedId = new Map(); // front(lower) -> vocabulary.id
  for (const [front, target] of Object.entries(MERGE_INTO_CURATED)) {
    const { data, error } = await supabase
      .from('vocabulary').select('id, word')
      .eq('word', target.word).eq('category', target.category);
    if (error) { console.error('curated lookup', front, error); process.exit(1); }
    if (!data || data.length !== 1) {
      console.error(`✗ ${front}: esperaba 1 ficha curada ${target.category}/${target.word}, encontré ${data?.length ?? 0}`);
      process.exit(1);
    }
    curatedId.set(front, data[0].id);
  }

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
  const merged = new Set();     // fronts servidos por una ficha curada

  for (const deck of decks) {
    for (const song of deck.songs) {
      const sid = songIdByTitle.get(norm(song.title));
      if (!sid) { songMiss.add(song.title); continue; }

      for (const c of song.layer1) {
        const word = c.front.trim();
        const key = word.toLowerCase();

        // Duplicado de una ficha ya curada: se ancla ESA a la canción (una sola
        // ficha por expresión; el verso es lo que cambia de canción a canción).
        if (curatedId.has(key)) {
          const vid = curatedId.get(key);
          const v = findVerse(song.title, surfaceCandidates(word));
          if (v) {
            anchorStats.hit++;
            svRows.push({ id: detId(`sv:${sid}|${vid}`), song_id: sid, vocabulary_id: vid, line_text: v.verse, highlighted_word: v.surface, line_index: v.idx });
          } else {
            anchorStats.miss.push(`${word} [${song.title}] (curada)`);
          }
          merged.add(key);
          continue;
        }

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
  if (merged.size) console.log(`  + ${merged.size} expresiones servidas por su ficha CURADA (sin duplicar): ${[...merged].join(', ')}`);
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
  // Limpieza de huérfanas: fichas `colloquial` que ya no salen de los mazos
  // (fusionadas con una curada, renombradas o eliminadas). Sin esto quedarían
  // duplicados fantasma, porque el upsert no borra. Nunca se borra algo con
  // progreso del usuario: si lo tiene, se avisa y se deja.
  const expected = new Set(vocabArr.map((r) => r.id));
  const { data: existing, error: exErr } = await supabase
    .from('vocabulary').select('id, word').eq('category', 'colloquial');
  if (exErr) { console.error('colloquial select', exErr); process.exit(1); }
  const orphans = (existing || []).filter((r) => !expected.has(r.id));
  if (orphans.length) {
    const ids = orphans.map((o) => o.id);
    const { data: prog, error: pErr } = await supabase
      .from('user_vocabulary').select('vocabulary_id').in('vocabulary_id', ids);
    if (pErr) { console.error('user_vocabulary check', pErr); process.exit(1); }
    const withProgress = new Set((prog || []).map((p) => p.vocabulary_id));
    const safe = orphans.filter((o) => !withProgress.has(o.id));
    if (withProgress.size) {
      console.log(`\n⚠️  ${withProgress.size} huérfanas CON progreso: no se borran (${orphans.filter((o) => withProgress.has(o.id)).map((o) => o.word).join(', ')})`);
    }
    if (safe.length) {
      const safeIds = safe.map((o) => o.id);
      const { error: dsvErr } = await supabase.from('song_vocabulary').delete().in('vocabulary_id', safeIds);
      if (dsvErr) { console.error('orphan anchors delete', dsvErr); process.exit(1); }
      const { error: dErr } = await supabase.from('vocabulary').delete().in('id', safeIds);
      if (dErr) { console.error('orphan delete', dErr); process.exit(1); }
      console.log(`\n🧹 ${safe.length} fichas huérfanas borradas: ${safe.map((o) => o.word).join(', ')}`);
    }
  }

  console.log(`\n✅ Cargado: ${vocabArr.length} coloquiales, ${svUniq.length} anclas, ${noteRows.length} notas.`);
  console.log('▶ Ejecuta: npm run backup:supabase && npm run validate:content\n');
}
main();
