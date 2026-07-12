#!/usr/bin/env node
/**
 * Descarga local de letras (uso personal) para cruzarlas con el vocabulario.
 * Sin dependencias: usa `curl` (ya viene en macOS) vía child_process.
 *
 * La lista de canciones + enlaces vive en scripts/music-catalog.json (URLs de
 * Genius verificadas). Para añadir playlists, se amplía ese JSON.
 *
 * Uso:
 *   node scripts/download-lyrics.mjs
 *
 * Salida: ./letras-playlist.txt  (cada canción precedida de
 *   "### nº | Título | Artista"). Ese formato es el que espera match-music.mjs.
 *
 * Nota: baja contenido con copyright a tu máquina para tu estudio personal.
 * No lo subas al repo (letras-playlist.txt está en .gitignore).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const SONGS = JSON.parse(readFileSync(new URL('./music-catalog.json', import.meta.url), 'utf8'));
const OUT = 'letras-playlist.txt';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fetchHtml(url) {
  return execFileSync('curl', ['-sL', '-A', UA, '--max-time', '25', url], {
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });
}

function decodeEntities(s) {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Extrae el contenido de TODOS los <div data-lyrics-container="true"> contando
// la profundidad de <div> para cerrar cada uno en su </div> correcto (Genius
// inyecta cabeceras y sidebars a mitad, así que no vale cortar por marcadores).
function extractContainers(html) {
  const marker = 'data-lyrics-container="true"';
  let idx = 0;
  const out = [];
  while (true) {
    const f = html.indexOf(marker, idx);
    if (f === -1) break;
    let p = html.indexOf('>', f) + 1;
    const start = p;
    let depth = 1;
    while (depth > 0 && p < html.length) {
      const o = html.indexOf('<div', p);
      const c = html.indexOf('</div>', p);
      if (c === -1) { p = html.length; break; }
      if (o !== -1 && o < c) { depth++; p = o + 4; }
      else { depth--; p = c + 6; if (depth === 0) out.push(html.slice(start, c)); }
    }
    idx = p;
  }
  return out.join('\n');
}

function extractLyrics(html) {
  let region = extractContainers(html);
  if (!region) return '';
  region = region.replace(/<\/div>/gi, '\n').replace(/<\/p>/gi, '\n');
  region = decodeEntities(region);
  region = region.replace(/<[^>]+>/g, ''); // quitar tags restantes
  // Quitar cabecera de créditos ("… Read More") si va antes de la 1ª [Sección].
  const b = region.indexOf('[');
  const rm = region.search(/Read More/i);
  if (rm !== -1 && (b === -1 || rm < b)) region = region.slice(rm + 9);
  region = region.replace(/You might also like/gi, '\n').replace(/\d*Embed\s*$/i, '');
  // Limpiar líneas y colapsar huecos.
  const lines = region.split('\n').map((l) => l.replace(/ /g, ' ').trimEnd());
  const out = [];
  let blanks = 0;
  for (const l of lines) {
    if (l.trim() === '') { if (++blanks <= 1 && out.length) out.push(''); }
    else { blanks = 0; out.push(l); }
  }
  return out.join('\n').trim();
}

// Reanudable: reutiliza las letras ya presentes en letras-playlist.txt (por nº)
// y NO las vuelve a descargar. Devuelve Map<n, cuerpo>.
function loadExisting() {
  const map = new Map();
  if (!existsSync(OUT)) return map;
  for (const blk of readFileSync(OUT, 'utf8').split(/(?=^### )/m)) {
    const m = blk.match(/^###\s*(\d+)\s*\|[^\n]*\n([\s\S]*?)\s*$/);
    if (!m) continue;
    const body = m[2].trim();
    if (body && !/NO DESCARGADA/.test(body)) map.set(+m[1], body);
  }
  return map;
}

async function main() {
  const chunks = [];
  const failed = [];
  const done = loadExisting();
  let reused = 0;
  for (const { n, title, artist, url } of SONGS) {
    if (done.has(n)) {
      chunks.push(`### ${n} | ${title} | ${artist}\n${done.get(n)}\n`);
      reused++;
      continue;
    }
    let lyrics = '';
    for (let attempt = 1; attempt <= 2 && !lyrics; attempt++) {
      try { lyrics = extractLyrics(fetchHtml(url)); } catch { /* reintento */ }
      if (!lyrics && attempt === 1) await sleep(1500);
    }
    if (lyrics) {
      process.stderr.write(`✓ ${n}/${SONGS.length}  ${title}\n`);
    } else {
      process.stderr.write(`✗ ${n}/${SONGS.length}  ${title}  (vacío — cógela a mano: ${url})\n`);
      failed.push([n, title, url]);
    }
    chunks.push(`### ${n} | ${title} | ${artist}\n${lyrics || '(NO DESCARGADA — pega la letra a mano aquí)'}\n`);
    await sleep(700 + Math.random() * 600); // educado con el servidor
  }
  writeFileSync(OUT, chunks.join('\n') + '\n', 'utf8');
  process.stderr.write(`\n📄 Escrito ${OUT} (${SONGS.length - failed.length}/${SONGS.length} con letra; ${reused} reutilizadas, ${SONGS.length - reused - failed.length} descargadas ahora).\n`);
  if (failed.length) {
    process.stderr.write('Faltaron:\n' + failed.map(([n, t]) => `  - ${n} ${t}`).join('\n') + '\n');
  }
}

main();
