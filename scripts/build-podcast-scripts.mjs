#!/usr/bin/env node
/**
 * Compila los guiones de podcast (./guiones-podcast/*.md, gitignored) al JSON
 * que consume la app: lib/data/podcastScripts.json.
 *
 * Por qué un JSON empaquetado y no una tabla de Supabase:
 *   - Los guiones son contenido editorial que se escribe OFFLINE en el repo, no
 *     datos que cambien en caliente. No necesitan sync ni marca de agua.
 *   - Sobreviven a una caída del proyecto de Supabase (ya pasó una vez, ver
 *     CLAUDE.md → "Backup del contenido de Supabase").
 *   - La app lo carga con `import()` diferido, así que va en su propio chunk y
 *     no penaliza el arranque.
 *
 * Uso:  node scripts/build-podcast-scripts.mjs
 *
 * El índice se construye por `título|artista` normalizados, que es lo que la
 * pantalla de canción tiene a mano en sus params (no hay songId en el .md).
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SRC = 'guiones-podcast';
const OUT = 'lib/data/podcastScripts.json';

if (!existsSync(SRC)) {
  console.error(`\n❌ No existe ./${SRC}/. Nada que compilar.\n`);
  process.exit(1);
}

/** Misma normalización que usa el resto del pipeline de música. */
const norm = (s) => (s || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9]/g, '');
const key = (title, artist) => `${norm(title)}|${norm(artist)}`;

/**
 * Convierte el cuerpo de una sección en bloques que la app sabe pintar.
 * Deliberadamente NO es un parser de Markdown completo: solo reconoce lo que
 * los guiones usan de verdad. Cualquier cosa rara cae a párrafo.
 */
function parseBlocks(lines) {
  const blocks = [];
  let para = [];
  const flush = () => {
    if (!para.length) return;
    blocks.push({ t: 'p', text: para.join(' ').trim() });
    para = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }

    // Cita en bloque: "> texto". Se usan para cortes de audio y avisos.
    if (line.startsWith('>')) {
      flush();
      const text = line.replace(/^>\s?/, '').trim();
      const prev = blocks[blocks.length - 1];
      if (prev?.t === 'quote') prev.text += ' ' + text;
      else if (text) blocks.push({ t: 'quote', text });
      continue;
    }

    // Verso comentado: **«...»** abre una ficha de verso.
    const verse = line.match(/^\*\*[«"](.+)[»"]\*\*$/);
    if (verse) { flush(); blocks.push({ t: 'verse', verse: verse[1], parts: [] }); continue; }

    // Sub-líneas del verso: *Qué dice:* ... / *El inglés:* ...
    const part = line.match(/^\*(.+?):\*\s*(.*)$/);
    const last = blocks[blocks.length - 1];
    if (part && last?.t === 'verse') {
      flush();
      last.parts.push({ label: part[1].trim(), text: part[2].trim() });
      continue;
    }
    // Continuación de la última sub-línea de un verso (los .md envuelven a 80 cols).
    if (last?.t === 'verse' && last.parts.length && !para.length) {
      last.parts[last.parts.length - 1].text += ' ' + line.trim();
      continue;
    }

    // Lista de fuentes.
    if (/^[-*]\s+/.test(line)) {
      flush();
      const text = line.replace(/^[-*]\s+/, '').trim();
      const prevList = blocks[blocks.length - 1];
      if (prevList?.t === 'list') prevList.items.push(text);
      else blocks.push({ t: 'list', items: [text] });
      continue;
    }
    // Continuación de un item de lista (indentado).
    if (/^\s{2,}\S/.test(raw) && last?.t === 'list' && !para.length) {
      last.items[last.items.length - 1] += ' ' + line.trim();
      continue;
    }

    para.push(line.trim());
  }
  flush();
  return blocks;
}

function parseScript(md, file) {
  const lines = md.split('\n');
  const out = { sections: [] };

  // Cabecera: "# Título — Artista" y "### Guion de podcast · Capítulo N"
  const h1 = lines.find((l) => l.startsWith('# '));
  if (!h1) throw new Error(`${file}: sin título (# ...)`);
  const [title, artist] = h1.slice(2).split('—').map((s) => s.trim());
  if (!artist) throw new Error(`${file}: la cabecera necesita "# Título — Artista"`);
  out.title = title;
  out.artist = artist;
  const chap = md.match(/Cap[íi]tulo\s+(\d+)/);
  out.chapter = chap ? Number(chap[1]) : null;

  // Ficha técnica: el bloque de cita que va antes de la primera sección.
  const firstH2 = lines.findIndex((l) => l.startsWith('## '));
  out.meta = lines
    .slice(0, firstH2 < 0 ? lines.length : firstH2)
    .filter((l) => l.startsWith('>'))
    .map((l) => l.replace(/^>\s?/, '').trim())
    .filter(Boolean);

  // Secciones "## N. Título"
  let cur = null;
  for (let i = firstH2 < 0 ? lines.length : firstH2; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('## ')) {
      if (cur) out.sections.push({ heading: cur.heading, blocks: parseBlocks(cur.body) });
      // Se quita la numeración: la app ya las pinta en orden.
      cur = { heading: l.slice(3).replace(/^\d+\.\s*/, '').trim(), body: [] };
      continue;
    }
    if (l.trim() === '---') continue;
    if (cur) cur.body.push(l);
  }
  if (cur) out.sections.push({ heading: cur.heading, blocks: parseBlocks(cur.body) });

  return out;
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.md')).sort();
const index = {};
const errors = [];

for (const f of files) {
  try {
    const s = parseScript(readFileSync(path.join(SRC, f), 'utf8'), f);
    const k = key(s.title, s.artist);
    if (index[k]) errors.push(`${f}: choca con ${index[k].source} (misma clave ${k})`);
    index[k] = { ...s, source: f };
  } catch (e) {
    errors.push(e.message);
  }
}

for (const e of errors) console.error(`   ⚠ ${e}`);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(index));

// Un guion cuyo título no case con el del catálogo simplemente no aparece en la
// app, sin error ni aviso. Es el fallo silencioso más probable de esta feature,
// así que se comprueba aquí contra el backup de Supabase.
try {
  const songs = JSON.parse(readFileSync('supabase/backup/songs.json', 'utf8'));
  const artists = JSON.parse(readFileSync('supabase/backup/artists.json', 'utf8'));
  const byId = Object.fromEntries(artists.map((a) => [a.id, a.name]));
  const catalog = new Set(songs.map((s) => key(s.title, (byId[s.artist_id] ?? '').split(',')[0])));
  const huerfanos = Object.entries(index).filter(([k]) => !catalog.has(k));
  if (huerfanos.length) {
    console.error(`\n⚠ ${huerfanos.length} guion(es) sin canción en el catálogo — NO se verán en la app:`);
    for (const [, s] of huerfanos) console.error(`   ${s.artist} — ${s.title}   (${s.source})`);
    console.error('   Revisa que el título del .md sea idéntico al del catálogo.');
  }
} catch {
  // Sin backup a mano no se puede comprobar; no es motivo para romper el build.
}

const words = Object.values(index).reduce(
  (n, s) => n + JSON.stringify(s.sections).split(/\s+/).length, 0
);
const byArtist = {};
for (const s of Object.values(index)) byArtist[s.artist] = (byArtist[s.artist] ?? 0) + 1;

console.log(`\n✅ ${Object.keys(index).length} guiones → ${OUT}`);
for (const [a, n] of Object.entries(byArtist).sort((x, y) => y[1] - x[1])) {
  console.log(`   ${String(n).padStart(3)}  ${a}`);
}
console.log(`   ~${Math.round(words / 1000)}k palabras · ${Math.round(JSON.stringify(index).length / 1024)} KB\n`);
if (errors.length) process.exit(1);
