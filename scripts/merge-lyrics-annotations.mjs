#!/usr/bin/env node
/**
 * Cruza la letra que ya tienes en local con las anotaciones descargadas de la
 * API de Genius, y genera un documento de trabajo por canción: la letra con cada
 * anotación intercalada justo debajo del verso al que se refiere.
 *
 * Es el material de consulta para escribir los guiones del podcast: en un solo
 * sitio ves el verso y la explicación de por qué dice eso.
 *
 * Entradas:
 *   - ./letras-playlist.txt          (local, gitignored)
 *   - ./genius-anotaciones/*.json    (scripts/download-genius-annotations.mjs)
 *
 * Uso:
 *   node scripts/merge-lyrics-annotations.mjs                # todas las que haya
 *   node scripts/merge-lyrics-annotations.mjs --artist Oasis # filtra por artista
 *
 * Salida: ./letras-anotadas/<slug>.md   (carpeta gitignored)
 *
 * NOTA: documento personal de estudio. Ni la letra ni las anotaciones son
 * nuestras: son material de consulta. No se versiona ni se publica; en los
 * guiones se escriben los hechos con palabras propias.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ai = process.argv.indexOf('--artist');
const ARTIST_FILTER = ai >= 0 ? process.argv[ai + 1].toLowerCase() : null;
const ANN_DIR = 'genius-anotaciones';
const OUT_DIR = 'letras-anotadas';
const LYRICS = 'letras-playlist.txt';

if (!existsSync(ANN_DIR)) {
  console.error(`\n❌ No existe ./${ANN_DIR}/. Descarga primero las anotaciones:\n`);
  console.error('   export GENIUS_ACCESS_TOKEN="tu_token"');
  console.error('   node scripts/download-genius-annotations.mjs --artist Oasis\n');
  process.exit(1);
}
if (!existsSync(LYRICS)) {
  console.error(`\n❌ No existe ./${LYRICS}. Ejecuta antes scripts/download-lyrics.mjs\n`);
  process.exit(1);
}

// --- letras locales, indexadas por título normalizado ---
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const clean = (s) => (s || '').replace(/[’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
const songs = new Map();
{
  let cur = null;
  for (const line of readFileSync(LYRICS, 'utf8').split('\n')) {
    const m = line.match(/^###\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*$/);
    if (m) { cur = { title: m[2], artist: m[3], lines: [] }; songs.set(norm(m[2]), cur); }
    else if (cur) cur.lines.push(line);
  }
}

const isSection = (l) => /^\[.*\]$/.test(l.trim());

/**
 * Localiza en qué línea de la letra empieza un fragmento anotado. Genius
 * devuelve el fragmento tal cual aparece, pero puede abarcar varias líneas, así
 * que se compara su PRIMERA línea contra cada verso.
 */
function findLine(lines, fragmento) {
  const first = clean(fragmento.split('\n')[0]);
  if (first.length < 4) return -1;
  for (let i = 0; i < lines.length; i++) {
    const l = clean(lines[i]);
    if (!l || isSection(lines[i])) continue;
    if (l === first || l.includes(first) || first.includes(l)) return i;
  }
  return -1;
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR);
const files = readdirSync(ANN_DIR).filter((f) => f.endsWith('.json'));
let ok = 0, sinLetra = 0, totalAnn = 0, colocadas = 0;

for (const f of files) {
  const data = JSON.parse(readFileSync(path.join(ANN_DIR, f), 'utf8'));
  if (ARTIST_FILTER && !data.artista.toLowerCase().includes(ARTIST_FILTER)) continue;

  const song = songs.get(norm(data.titulo));
  if (!song) { console.log(`   ⚠ sin letra local: ${data.titulo}`); sinLetra++; continue; }

  // Anotación → índice de línea. Varias pueden caer en la misma línea.
  const porLinea = new Map();
  const huerfanas = [];
  for (const a of data.anotaciones || []) {
    totalAnn++;
    const idx = findLine(song.lines, a.fragmento);
    if (idx < 0) { huerfanas.push(a); continue; }
    if (!porLinea.has(idx)) porLinea.set(idx, []);
    porLinea.get(idx).push(a);
    colocadas++;
  }

  const out = [];
  out.push(`# ${data.titulo} — ${data.artista}`);
  out.push('');
  out.push(`> Letra con las anotaciones de Genius intercaladas. Documento de trabajo`);
  out.push(`> personal para preparar el guion. Fuente: ${data.url}`);
  out.push(`> ${data.anotaciones?.length ?? 0} anotaciones · ${porLinea.size} versos anotados`);
  out.push('');
  out.push('---');
  out.push('');

  song.lines.forEach((line, i) => {
    if (!line.trim()) { out.push(''); return; }
    out.push(isSection(line) ? `**${line.trim()}**` : line.trim());
    for (const a of porLinea.get(i) || []) {
      out.push('');
      out.push(`> 💬 **Anotación${a.verificada ? ' ✓ VERIFICADA POR EL ARTISTA' : ''}**${a.votos ? ` · ${a.votos} votos` : ''}`);
      for (const p of a.anotacion.split('\n').filter(Boolean)) out.push(`> ${p.trim()}`);
      out.push('');
    }
  });

  if (huerfanas.length) {
    out.push('');
    out.push('---');
    out.push('');
    out.push(`## Anotaciones sin verso localizado (${huerfanas.length})`);
    out.push('');
    out.push('Genius las ancla a un fragmento que no he sabido casar con la letra local');
    out.push('(suelen ser del título, de una sección entera o de un texto ya editado).');
    out.push('');
    for (const a of huerfanas) {
      out.push(`- **${a.fragmento.split('\n')[0].slice(0, 60)}**${a.verificada ? ' ✓' : ''}`);
      out.push(`  ${a.anotacion.replace(/\n+/g, ' ').slice(0, 400)}`);
      out.push('');
    }
  }

  const name = f.replace(/\.json$/, '.md');
  writeFileSync(path.join(OUT_DIR, name), out.join('\n'));
  console.log(`   ✓ ${data.titulo} — ${porLinea.size} versos anotados${huerfanas.length ? `, ${huerfanas.length} sin ubicar` : ''}`);
  ok++;
}

console.log(`\n✅ ${ok} canciones · ${colocadas}/${totalAnn} anotaciones colocadas en su verso`);
if (sinLetra) console.log(`   ⚠ ${sinLetra} sin letra local (bájala con scripts/download-lyrics.mjs)`);
console.log(`   Carpeta: ./${OUT_DIR}/ (gitignored)\n`);
