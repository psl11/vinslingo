#!/usr/bin/env node
/**
 * Vuelca a un fichero de texto legible todo el contenido del extractor de
 * canciones (categoría `colloquial` + `song_notes`) para revisarlo de una
 * sentada, sin depender del sync al dispositivo.
 *
 * Uso:  node scripts/dump-song-content.mjs [ruta-de-salida]
 *       (por defecto escribe en el scratchpad de la sesión)
 *
 * Lee el BACKUP local (supabase/backup/*.json), así que refresca antes con
 * `npm run backup:supabase` si acabas de cargar un lote.
 *
 * El fichero de salida es un documento de trabajo personal: NO se versiona
 * (igual que letras-playlist.txt). Incluye el verso de contexto que ya vive en
 * la BD (3 líneas máx.), con la palabra anclada marcada **así** para poder
 * detectar desajustes de resaltado de un vistazo.
 *
 * Secciones:
 *   1. Resumen
 *   2. Fichas coloquiales por tipo (idiom / slang / contraction / aave)
 *   3. Por artista y canción: fichas ancladas (con su verso) + notas
 *   4. Fichas sin anclar (no salen en las vistas por canción)
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = '/Users/pablosanchez/CascadeProjects/Vinslingo';
const B = `${REPO}/supabase/backup`;
const OUT = process.argv[2] ||
  '/private/tmp/claude-501/-Users-pablosanchez-CascadeProjects-Vinslingo/705c69d9-75d5-479a-b97c-fe3098510827/scratchpad/REVISION-contenido-canciones.md';

const read = (f) => JSON.parse(fs.readFileSync(path.join(B, f), 'utf8'));
const vocab = read('vocabulary.json');
const songs = read('songs.json');
const artists = read('artists.json');
const sv = read('song_vocabulary.json');
const notes = (() => { try { return read('song_notes.json'); } catch { return []; } })();

const byV = Object.fromEntries(vocab.map((v) => [v.id, v]));
const byS = Object.fromEntries(songs.map((s) => [s.id, s]));
const byA = Object.fromEntries(artists.map((a) => [a.id, a.name]));

const colloquial = vocab.filter((v) => v.category === 'colloquial');
const colIds = new Set(colloquial.map((c) => c.id));

// Marca la palabra anclada dentro del verso, con límite de palabra (misma
// lógica que lib/utils/highlight.ts) para que un desajuste se vea a simple vista.
function mark(line, word) {
  if (!line || !word) return line || '';
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wb = new RegExp('(?:^|[^A-Za-z0-9])(' + esc + ')(?![A-Za-z0-9])', 'i');
  const m = wb.exec(line);
  const i = m ? m.index + (m[0].length - m[1].length) : line.toLowerCase().indexOf(word.toLowerCase());
  if (i < 0) return line + '   ⚠️ (la palabra no aparece en el verso)';
  const len = m ? m[1].length : word.length;
  return line.slice(0, i) + '**' + line.slice(i, i + len) + '**' + line.slice(i + len);
}
const indent = (t) => (t || '').split('\n').map((l) => '  > ' + l.trim()).join('\n');

// --- índices ---
const anchorsByVocab = {};   // vocab_id -> [{song, artist, verse, hl}]
const anchorsBySong = {};    // song_id  -> [{vocab, verse, hl}]
for (const r of sv) {
  if (!colIds.has(r.vocabulary_id)) continue;
  const s = byS[r.song_id];
  if (!s) continue;
  const entry = { songId: r.song_id, song: s.title, artist: byA[s.artist_id] || '?', verse: r.line_text, hl: r.highlighted_word };
  (anchorsByVocab[r.vocabulary_id] ||= []).push(entry);
  (anchorsBySong[r.song_id] ||= []).push({ v: byV[r.vocabulary_id], verse: r.line_text, hl: r.highlighted_word });
}
const notesBySong = {};
for (const n of notes) (notesBySong[n.song_id] ||= []).push(n);

const TYPE_LABEL = { idiom: 'Idioms / expresiones', slang: 'Slang', contraction: 'Contracciones y elisiones', aave: 'Gramática AAVE' };

const L = [];
const p = (s = '') => L.push(s);

// --- 1. resumen ---
const enriched = new Set([...Object.keys(anchorsBySong), ...Object.keys(notesBySong)]);
const perArtist = {};
for (const id of enriched) { const s = byS[id]; if (s) (perArtist[byA[s.artist_id]] ||= []).push(s.title); }
const anchored = new Set(Object.keys(anchorsByVocab));

p('# Revisión del contenido de canciones');
p('');
p('Documento de trabajo generado con `scripts/dump-song-content.mjs` desde el backup local.');
p('Marca aquí lo que quieras corregir y lo aplicamos de una tacada.');
p('');
p('## Resumen');
p('');
p(`- **${colloquial.length}** fichas coloquiales · **${notes.length}** notas de canción`);
p(`- **${enriched.size}** canciones enriquecidas · **${Object.keys(perArtist).length}** artistas`);
p(`- **${anchored.size}** fichas ancladas a un verso · ${colloquial.length - anchored.size} sin anclar`);
p('');
p('Por tipo:');
const byType = {};
for (const c of colloquial) byType[c.part_of_speech || '?'] = (byType[c.part_of_speech || '?'] || 0) + 1;
for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) p(`- ${TYPE_LABEL[t] || t}: ${n}`);
p('');
p('---');
p('');

// --- 2. fichas por tipo ---
p('## 1. Fichas coloquiales (todas, por tipo)');
p('');
p('Formato: **palabra** — traducción · _ejemplo_ · canciones donde aparece.');
p('');
for (const type of ['idiom', 'slang', 'contraction', 'aave']) {
  const list = colloquial.filter((c) => c.part_of_speech === type)
    .sort((a, b) => a.word.toLowerCase().localeCompare(b.word.toLowerCase()));
  if (!list.length) continue;
  p(`### ${TYPE_LABEL[type] || type} (${list.length})`);
  p('');
  for (const c of list) {
    p(`- **${c.word}** — ${c.translation}`);
    if (c.example_sentence) p(`  - _${c.example_sentence}_ → ${c.example_translation || ''}`);
    const a = anchorsByVocab[c.id] || [];
    p(`  - ${a.length ? '🎵 ' + [...new Set(a.map((x) => `${x.song} (${x.artist})`))].join(' · ') : '— sin anclar a ninguna canción'}`);
  }
  p('');
}
p('---');
p('');

// --- 3. por artista y canción ---
p('## 2. Por artista y canción');
p('');
p('Aquí se ve lo que verás en la app: las fichas de cada canción con **su verso**');
p('(la palabra marcada `**así**`) y las notas. Revisa que el verso case con la palabra.');
p('');
for (const [artist, titles] of Object.entries(perArtist).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))) {
  p(`### 🎤 ${artist} (${titles.length} ${titles.length === 1 ? 'canción' : 'canciones'})`);
  p('');
  const ids = [...enriched].filter((id) => byS[id] && byA[byS[id].artist_id] === artist)
    .sort((x, y) => byS[x].title.localeCompare(byS[y].title));
  for (const id of ids) {
    const s = byS[id];
    const words = anchorsBySong[id] || [];
    const ns = notesBySong[id] || [];
    p(`#### ${s.title}  —  ${words.length} fichas · ${ns.length} notas`);
    p('');
    for (const w of words) {
      if (!w.v) continue;
      p(`- **${w.v.word}** — ${w.v.translation}`);
      if (w.verse) p(indent(mark(w.verse, w.hl)));
    }
    if (ns.length) {
      p('');
      p('  **Notas:**');
      for (const n of ns) {
        p(`  - 📓 **${n.term}** _(${n.kind})_ — ${n.explanation}`);
        if (n.line_text) p(indent(mark(n.line_text, n.term)).split('\n').map((l) => '  ' + l).join('\n'));
      }
    }
    p('');
  }
}
p('---');
p('');

// --- 4. sin anclar ---
const orphan = colloquial.filter((c) => !anchored.has(c.id))
  .sort((a, b) => a.word.toLowerCase().localeCompare(b.word.toLowerCase()));
p(`## 3. Fichas sin anclar (${orphan.length})`);
p('');
p('Se estudian igual, pero no aparecen en las vistas por canción porque no se');
p('localizó su verso (normalmente idioms que en la letra van conjugados).');
p('');
for (const c of orphan) p(`- **${c.word}** — ${c.translation}`);
p('');

fs.writeFileSync(OUT, L.join('\n'));
console.log(`✅ Escrito: ${OUT}`);
console.log(`   ${colloquial.length} fichas · ${notes.length} notas · ${enriched.size} canciones · ${L.length} líneas`);
