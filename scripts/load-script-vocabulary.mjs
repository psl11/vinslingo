#!/usr/bin/env node
/**
 * Carga en Supabase las fichas extraídas de los guiones de podcast
 * (scripts/script-vocabulary.json) y las ancla al verso de su canción.
 *
 * Los guiones explican ~300 puntos de inglés que hasta ahora no se podían
 * repasar. Esto convierte en ficha la parte que lo merece: expresiones hechas y
 * phrasal verbs con significado propio. El criterio de qué entra y qué no está
 * documentado en la cabecera del JSON.
 *
 * Idempotente: IDs deterministas (detId), re-ejecutable sin churn.
 *
 * Uso:
 *   node scripts/load-script-vocabulary.mjs              # prueba en seco
 *   node scripts/load-script-vocabulary.mjs --apply
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const APPLY = process.argv.includes('--apply');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('\n❌ Faltan credenciales en .env\n'); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false } });

/** Mismo generador que el resto del pipeline: sha1 → forma de UUID v5. */
const detId = (k) => {
  const h = createHash('sha1').update(k).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const norm = (s) => (s || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9]/g, '');
const songKey = (t, a) => `${norm(t)}|${norm((a || '').split(',')[0])}`;

const { cards } = JSON.parse(readFileSync('scripts/script-vocabulary.json', 'utf8'));
console.log(`\n📇 ${cards.length} fichas curadas`);

// --- letras locales, para anclar al verso ---
const lyrics = new Map();
if (existsSync('letras-playlist.txt')) {
  let cur = null;
  for (const line of readFileSync('letras-playlist.txt', 'utf8').split('\n')) {
    const m = line.match(/^###\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*$/);
    if (m) { cur = { lines: [] }; lyrics.set(songKey(m[2], m[3]), cur); }
    else if (cur) cur.lines.push(line);
  }
}

/**
 * Busca en la letra la línea donde aparece la expresión y devuelve el verso de
 * 3 líneas alrededor, como el resto de anclas.
 *
 * Las fichas son formas de diccionario ("get under someone's skin", "break
 * one's back") y la canción usa la forma conjugada y con posesivo real ("under
 * your skin", "breaking my back"). Así que no se busca la expresión entera: se
 * buscan sus palabras con contenido, permitiendo hueco entre ellas.
 */
// Comodines de la forma de diccionario: se quitan siempre, porque la canción
// pone el suyo propio ("walk in someone's shoes" → "walking in your shoes").
const FILLER = new Set(["someone's", 'someone', "one's", 'something', 'your', 'my']);

// Palabras gramaticales que van OPCIONALES, ni exigidas ni descartadas. Es el
// punto medio entre los dos fallos: exigirlas pierde anclas ("be here to stay"
// contra "they're here to stay"), y quitarlas trunca el resaltado ("let it be"
// resaltaba solo "Let it").
const SOFT = new Set(['be', 'to', 'a', 'an', 'the']);
function findVerse(card) {
  const song = lyrics.get(songKey(card.song, card.artist));
  if (!song) return null;
  const toks = card.word.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/)
    .filter((t) => t && !FILLER.has(t));
  if (!toks.length) return null;
  // Si TODO son palabras opcionales no hay nada que buscar; se descarta.
  if (toks.every((t) => SOFT.has(t))) return null;
  // Raíz + sufijo flexivo opcional: "break" casa con "breaking", y "shoe" se
  // lleva la -s de "shoes" en vez de dejarla fuera del resaltado.
  const stem = (t) => t.replace(/(ing|ed|s)$/, '');
  const esc = (t) => `${stem(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:s|es|ing|ed|'s)?`;
  const parts = toks.map((t) => (SOFT.has(t) ? `(?:${esc(t)}\\s*)?` : esc(t)));
  // Los extremos son lo que evitó el desastre la última vez: sin el límite
  // inicial, el hueco arranca a mitad de palabra y el resaltado sale como
  // "kbird singing in the dead of night" (se comió parte de "Blackbird").
  const re = new RegExp(`(?:^|[^\\w'])(${parts.join("[\\w' ,]{0,20}?\\s*")})(?!\\w)`, 'i');
  for (let i = 0; i < song.lines.length; i++) {
    const l = song.lines[i];
    if (!l.trim() || /^\[.*\]$/.test(l.trim())) continue;
    const hit = re.exec(l);
    if (!hit) continue;
    const ctx = [song.lines[i - 1], l, song.lines[i + 1]]
      .filter((x) => x && x.trim() && !/^\[.*\]$/.test(x.trim()))
      .map((x) => x.trim());
    // hit[1] y no hit[0]: el grupo 0 arrastra el carácter del límite inicial.
    return { verse: ctx.join('\n'), surface: hit[1].trim(), idx: i };
  }
  return null;
}

// --- canciones del catálogo ---
const { data: songs } = await supabase.from('songs').select('id, title, artist_id').eq('source', 'user');
const { data: artists } = await supabase.from('artists').select('id, name');
const byId = Object.fromEntries(artists.map((a) => [a.id, a.name]));
const songByKey = new Map(songs.map((s) => [songKey(s.title, byId[s.artist_id]), s.id]));

const vocabRows = [];
const svRows = [];
let anclados = 0;
const sinAncla = [];
const sinCancion = [];
const anclas = [];

for (const c of cards) {
  const id = detId('script-vocab:' + c.word.toLowerCase());
  vocabRows.push({
    id,
    word: c.word,
    translation: c.translation,
    category: 'colloquial',
    cefr_level: c.cefr,
    part_of_speech: c.type,
    example_sentence: c.en,
    example_translation: c.es,
  });

  const sid = songByKey.get(songKey(c.song, c.artist));
  if (!sid) { sinCancion.push(`${c.word} → ${c.song}`); continue; }
  const v = findVerse(c);
  if (!v) { sinAncla.push(`${c.word} [${c.song}]`); continue; }
  anclados++;
  anclas.push(`${c.word.padEnd(32)} → "${v.surface}"`);
  svRows.push({
    id: detId(`sv:${sid}|${id}`),
    song_id: sid, vocabulary_id: id,
    line_text: v.verse, highlighted_word: v.surface, line_index: v.idx,
  });
}

console.log(`   ${vocabRows.length} fichas · ${anclados} ancladas a su verso`);
if (sinAncla.length) {
  console.log(`\n   ${sinAncla.length} sin ancla (la expresión no aparece literal en la letra;`);
  console.log('   la ficha se crea igual, solo se queda sin verso):');
  sinAncla.slice(0, 12).forEach((x) => console.log('     · ' + x));
}
if (sinCancion.length) {
  console.log(`\n   ⚠ ${sinCancion.length} con canción que no está en el catálogo:`);
  sinCancion.forEach((x) => console.log('     · ' + x));
}

if (!APPLY) {
  // El resaltado se revisa AQUÍ: un ancla mal casada mete un verso equivocado en
  // la ficha, y eso solo se ve leyéndolo.
  console.log('\n   Anclas encontradas (revisa que el resaltado sea el correcto):');
  anclas.forEach((a) => console.log('     ' + a));
  console.log('\n🔍 Prueba en seco. Añade --apply para escribir.\n');
  process.exit(0);
}

const { error: e1 } = await supabase.from('vocabulary').upsert(vocabRows, { onConflict: 'id' });
if (e1) { console.error('\n❌ vocabulary: ' + e1.message); process.exit(1); }
if (svRows.length) {
  const { error: e2 } = await supabase.from('song_vocabulary').upsert(svRows, { onConflict: 'id' });
  if (e2) { console.error('\n❌ song_vocabulary: ' + e2.message); process.exit(1); }
}
console.log(`\n✅ ${vocabRows.length} fichas · ${svRows.length} anclas en Supabase.`);
console.log('   Recuerda: npm run backup:supabase + commit del diff.\n');
