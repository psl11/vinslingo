// PoC del match música ↔ vocabulario. Lee letras-playlist.txt (formato
// "### n | Título | Artista" + letra) y las cruza contra vocabulary.json.
// Saca un INFORME agregado (conteos, top recurrentes, por artista, huecos).
// No vuelca letras completas: solo palabras y estadísticas.
import fs from 'node:fs';

const REPO = '/Users/pablosanchez/CascadeProjects/Vinslingo';
const vocab = JSON.parse(fs.readFileSync(`${REPO}/supabase/backup/vocabulary.json`, 'utf8'));
const LYRICS_FILE = process.argv.find((a) => a.endsWith('.txt')) || `${REPO}/letras-playlist.txt`;
const raw = fs.readFileSync(LYRICS_FILE, 'utf8');
const APPLY = process.argv.includes('--apply');

// ---------- scope ----------
const JUICY = new Set(['phave', 'idiom', 'expression', 'collocation', 'false_friend', 'confusing_pair', 'british_slang', 'american_slang']);
const B2PLUS = new Set(['B2', 'C1', 'C2']);
const B1PLUS = new Set(['B1', 'B2', 'C1', 'C2']);

// Palabras comunes (ngsl A1/A2/B1): sirven para detectar homógrafos ambiguos.
const BASIC = new Set(
  vocab.filter((v) => v.category === 'ngsl' && ['A1', 'A2', 'B1'].includes(v.cefr_level)).map((v) => v.word.toLowerCase())
);
// Ambiguo = trampa UK↔US (meta), o slang de UNA palabra homógrafo de una común.
function ambiguous(v) {
  if (/\(uk vs us\)/i.test(v.word || '')) return true;
  const w = (v.word || '').toLowerCase().trim();
  if (!/\s/.test(w) && BASIC.has(w)) return true;
  return false;
}

function inScope(v) {
  const c = v.cefr_level;
  if (ambiguous(v)) return false;                        // precisión: fuera homógrafos/trampas
  if (v.category === 'ngsl') return B1PLUS.has(c);       // suelto: no hay B2+, así que B1
  if (v.category === 'connector') return false;          // fuera (ruido)
  if (JUICY.has(v.category)) return B1PLUS.has(c);        // jugoso: B1+
  return B1PLUS.has(c);
}

// ---------- lematización ----------
const IRREG = {
  run: ['ran', 'running'], get: ['got', 'gotten', 'getting'], give: ['gave', 'given', 'giving'],
  take: ['took', 'taken', 'taking'], make: ['made', 'making'], go: ['went', 'gone', 'going', 'goes'],
  come: ['came', 'coming'], see: ['saw', 'seen', 'seeing'], find: ['found', 'finding'],
  hold: ['held', 'holding'], keep: ['kept', 'keeping'], bring: ['brought', 'bringing'],
  break: ['broke', 'broken', 'breaking'], blow: ['blew', 'blown', 'blowing'], throw: ['threw', 'thrown', 'throwing'],
  fall: ['fell', 'fallen', 'falling'], catch: ['caught', 'catching'], put: ['putting'],
  cut: ['cutting'], let: ['letting'], set: ['setting'], hit: ['hitting'], shut: ['shutting'],
  lose: ['lost', 'losing'], leave: ['left', 'leaving'], feel: ['felt', 'feeling'],
  tell: ['told', 'telling'], think: ['thought', 'thinking'], stand: ['stood', 'standing'],
  wake: ['woke', 'woken', 'waking'], pay: ['paid', 'paying'], lay: ['laid', 'laying'],
  buy: ['bought', 'buying'], sell: ['sold', 'selling'], draw: ['drew', 'drawn', 'drawing'],
  drive: ['drove', 'driven', 'driving'], write: ['wrote', 'written', 'writing'], ride: ['rode', 'ridden', 'riding'],
  eat: ['ate', 'eaten', 'eating'], speak: ['spoke', 'spoken', 'speaking'], sit: ['sat', 'sitting'],
};

function verbForms(w) {
  const base = w.toLowerCase();
  const forms = new Set([base]);
  if (IRREG[base]) IRREG[base].forEach((f) => forms.add(f));
  forms.add(base + 's');
  if (/(s|x|z|ch|sh|o)$/.test(base)) forms.add(base + 'es');
  if (/[^aeiou]y$/.test(base)) { forms.add(base.slice(0, -1) + 'ies'); forms.add(base.slice(0, -1) + 'ied'); }
  else { forms.add(base + 'ed'); }
  forms.add(base + 'ing');
  if (base.endsWith('e')) { forms.add(base.slice(0, -1) + 'ing'); forms.add(base + 'd'); }
  if (/[^aeiou][aeiou][^aeiouwxy]$/.test(base)) { // CVC doubling: stop→stopping/stopped
    const d = base + base.slice(-1);
    forms.add(d + 'ing'); forms.add(d + 'ed');
  }
  return [...forms];
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PRON = "(?:my|your|his|her|our|their|its|one's|someone's)";

// Construye regex de match para una entrada de vocabulario.
function buildRegex(v) {
  let w = (v.word || '').toLowerCase().replace(/\s*\(uk vs us\)\s*$/, '').trim();
  if (w.length < 2) return null;
  w = w.replace(/[’]/g, "'");
  const toks = w.split(/\s+/);
  if (toks.length === 1) {
    const forms = verbForms(toks[0]).map(esc);
    return new RegExp(`\\b(?:${forms.join('|')})\\b`, 'i');
  }
  // multipalabra: 1er token flexionado (si parece verbo), resto literal salvo one's/sb/sth
  const first = `(?:${verbForms(toks[0]).map(esc).join('|')})`;
  const rest = toks.slice(1).map((t) => {
    if (/^(one's|someone's|sb's)$/.test(t)) return PRON;
    if (/^(sb|someone|sth|something)$/.test(t)) return "\\w+(?:\\s+\\w+)?";
    return esc(t);
  });
  const sep = v.separability === 'separable';
  if (sep && toks.length === 2) {
    // permite partícula separada hasta 3 palabras: take it off
    return new RegExp(`\\b${first}(?:\\s+\\w+){0,3}\\s+${rest[0]}\\b|\\b${first}\\s+${rest[0]}\\b`, 'i');
  }
  return new RegExp(`\\b${first}\\s+${rest.join('\\s+')}\\b`, 'i');
}

// ---------- parse letras ----------
const songs = [];
let cur = null;
for (const line of raw.split('\n')) {
  const m = line.match(/^###\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*$/);
  if (m) { cur = { n: +m[1], title: m[2], artist: m[3], lines: [] }; songs.push(cur); }
  else if (cur) cur.lines.push(line);
}
const primaryArtist = (a) => a.split(',')[0].trim();
const isSection = (l) => /^\[.*\]$/.test(l.trim());

// ---------- match ----------
const scoped = vocab.filter(inScope).map((v) => ({ v, re: buildRegex(v) })).filter((x) => x.re);
const matches = []; // {songN, title, artist, word, cat, cefr, line, lineIdx}
for (const s of songs) {
  const text = s.lines.filter((l) => !isSection(l)).join('\n');
  const low = text.toLowerCase().replace(/[’]/g, "'");
  for (const { v, re } of scoped) {
    if (!re.test(low)) continue;
    // localizar la línea
    let lineText = '', lineIdx = -1;
    const realLines = s.lines.filter((l) => l.trim() && !isSection(l));
    for (let i = 0; i < realLines.length; i++) {
      if (re.test(realLines[i].toLowerCase().replace(/[’]/g, "'"))) { lineText = realLines[i].trim(); lineIdx = i; break; }
    }
    matches.push({ songN: s.n, title: s.title, artist: primaryArtist(s.artist), vid: v.id, word: v.word, cat: v.category, cefr: v.cefr_level, line: lineText, lineIdx });
  }
}

// ---------- informe ----------
const uniqWords = new Set(matches.map((m) => m.word));
console.log(`\n==== MATCH MÚSICA ↔ BD (PoC, ${songs.length} canciones) ====`);
console.log(`Vocab en alcance: ${scoped.length} / ${vocab.length}`);
console.log(`Matches (canción×palabra): ${matches.length} | palabras únicas: ${uniqWords.size}`);

const byCat = {};
for (const m of matches) (byCat[m.cat] ||= new Set()).add(m.word);
console.log('\nPor categoría (palabras únicas):');
for (const c of Object.keys(byCat).sort((a, b) => byCat[b].size - byCat[a].size)) console.log(`  ${c.padEnd(16)} ${byCat[c].size}`);

// top recurrentes (por nº de canciones distintas)
const songsPerWord = {};
for (const m of matches) (songsPerWord[m.word] ||= new Set()).add(m.songN);
const topRec = Object.entries(songsPerWord).map(([w, s]) => [w, s.size]).sort((a, b) => b[1] - a[1]).slice(0, 30);
console.log('\nTop recurrentes (nº de canciones):');
console.log('  ' + topRec.map(([w, c]) => `${w}(${c})`).join(', '));

// por artista
const perArtist = {};
for (const m of matches) (perArtist[m.artist] ||= new Set()).add(m.word);
const topArt = Object.entries(perArtist).map(([a, s]) => [a, s.size]).sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log('\nPor artista (palabras únicas, top 15):');
for (const [a, c] of topArt) console.log(`  ${a.padEnd(22)} ${c}`);

// muestra de una canción concreta (solo palabras)
const sample = matches.filter((m) => /No Role Modelz/i.test(m.title));
console.log(`\nMuestra "No Role Modelz" (${sample.length} matches): ` + [...new Set(sample.map((m) => `${m.word}[${m.cat}]`))].join(', '));

// líneas sin match útil
const zero = songs.filter((s) => !matches.some((m) => m.songN === s.n));
console.log(`\nCanciones sin ningún match: ${zero.length}${zero.length ? ' -> ' + zero.map((s) => s.n).join(',') : ''}`);

// ---------- apply a Supabase (fase 2-3) ----------
if (APPLY) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('\n❌ Falta EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el entorno.');
    process.exit(1);
  }
  const { createClient } = await import('@supabase/supabase-js');
  const { createHash } = await import('node:crypto');
  const supabase = createClient(url, key);
  // Id determinista (UUID v5-like) para idempotencia entre re-ejecuciones.
  const detId = (k) => {
    const h = createHash('sha1').update(k).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
  };

  // 1) artistas: reutilizar los existentes por nombre; crear los que falten.
  const { data: existingArtists, error: eaErr } = await supabase.from('artists').select('id,name');
  if (eaErr) { console.error('artists select', eaErr); process.exit(1); }
  const nameToId = new Map(existingArtists.map((a) => [a.name.toLowerCase().trim(), a.id]));
  const newArtists = [];
  for (const s of songs) {
    const name = primaryArtist(s.artist);
    const k = name.toLowerCase().trim();
    if (!nameToId.has(k)) { const id = detId('artist:' + k); nameToId.set(k, id); newArtists.push({ id, name }); }
  }
  if (newArtists.length) {
    const { error } = await supabase.from('artists').upsert(newArtists, { onConflict: 'id' });
    if (error) { console.error('artists upsert', error); process.exit(1); }
  }

  // 2) canciones (source='user' para separarlas del seed genérico).
  const songIdByN = new Map();
  const songRows = songs.map((s) => {
    const name = primaryArtist(s.artist);
    const id = detId(`song:${name.toLowerCase().trim()}|${s.title.toLowerCase().trim()}`);
    songIdByN.set(s.n, id);
    // lyrics_excerpt='' a propósito: no guardamos letra en songs (el contexto va
    // en song_vocabulary.line_text). '' satisface un posible NOT NULL sin texto.
    return { id, artist_id: nameToId.get(name.toLowerCase().trim()), title: s.title, source: 'user', lyrics_excerpt: '' };
  });
  {
    const { error } = await supabase.from('songs').upsert(songRows, { onConflict: 'id' });
    if (error) { console.error('songs upsert', error); process.exit(1); }
  }

  // 3) song_vocabulary: borrar las de estas canciones y reinsertar (idempotente).
  const songIds = [...songIdByN.values()];
  for (let i = 0; i < songIds.length; i += 100) {
    const { error } = await supabase.from('song_vocabulary').delete().in('song_id', songIds.slice(i, i + 100));
    if (error) { console.error('sv delete', error); process.exit(1); }
  }
  const seen = new Set();
  const svRows = matches.map((m) => {
    const sid = songIdByN.get(m.songN);
    return { id: detId(`sv:${sid}|${m.vid}`), song_id: sid, vocabulary_id: m.vid, line_text: m.line || null, highlighted_word: m.word, line_index: m.lineIdx };
  }).filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
  for (let i = 0; i < svRows.length; i += 200) {
    const { error } = await supabase.from('song_vocabulary').upsert(svRows.slice(i, i + 200), { onConflict: 'id' });
    if (error) { console.error('sv upsert', error); process.exit(1); }
  }
  console.log(`\n✅ Aplicado a Supabase: ${songRows.length} canciones (source=user), ${newArtists.length} artistas nuevos, ${svRows.length} song_vocabulary.`);
}
