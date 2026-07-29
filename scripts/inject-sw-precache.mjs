#!/usr/bin/env node
/**
 * Inyecta en `dist/sw.js` la lista COMPLETA de assets del build.
 *
 * POR QUÉ: el service worker cacheaba en tiempo de ejecución (cache-first), o
 * sea, solo guardaba lo que ya se había pedido alguna vez. Consecuencias reales
 * en un avión:
 *
 *   - El bundle de entrada se pide ANTES de que el SW se registre (el registro
 *     vive en un useEffect), así que en la primera visita no se cacheaba: hacía
 *     falta una segunda carga para que la app abriese offline.
 *   - Los chunks perezosos (un JSON de guiones por artista) solo se cacheaban si
 *     habías abierto una canción de ESE grupo con red. Sin conexión, cualquier
 *     artista no visitado fallaba.
 *
 * Con la lista inyectada, `install` descarga todo de golpe (~4 MB) y la app
 * funciona entera offline desde la primera visita.
 *
 * Además calcula la versión de la caché a partir de los nombres de fichero (que
 * llevan hash de contenido): si cambia el build, cambia el nombre de la caché y
 * el handler de `activate` borra la vieja. Sin esto, un deploy nuevo conviviría
 * con assets viejos cacheados.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const DIST = 'dist';
const SW = join(DIST, 'sw.js');

// Extensiones que merece la pena precachear. Deliberadamente NO se incluye
// `.map` (source maps: pesan y no hacen falta para funcionar).
const CACHEABLE = new Set(['.js', '.css', '.wasm', '.ttf', '.otf', '.woff', '.woff2', '.png', '.ico', '.json']);

// Ficheros de la raíz de dist que son configuración de despliegue o del propio
// SW, no assets de la app.
const SKIP_ROOT = new Set(['sw.js', '_headers', '_redirects', 'serve.json', 'metadata.json']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(DIST)
  .map((f) => relative(DIST, f))
  .filter((rel) => {
    const parts = rel.split('/');
    if (parts.length === 1 && SKIP_ROOT.has(parts[0])) return false;
    const dot = rel.lastIndexOf('.');
    return dot !== -1 && CACHEABLE.has(rel.slice(dot));
  })
  .map((rel) => '/' + rel)
  .sort();

// index.html no sale del walk como asset cacheable por extensión, y es la shell.
const assets = ['/', '/index.html', ...files];

const version = createHash('sha1').update(assets.join('\n')).digest('hex').slice(0, 12);

let sw = readFileSync(SW, 'utf8');

const before = sw;
sw = sw.replace(
  /const CACHE = '[^']*';/,
  `const CACHE = 'vinslingo-shell-${version}';`
);
sw = sw.replace(
  /const PRECACHE = \[[\s\S]*?\];/,
  `const PRECACHE = ${JSON.stringify(assets, null, 2)};`
);

if (sw === before) {
  console.error('❌ No se pudo inyectar: no encontré `const CACHE` ni `const PRECACHE` en dist/sw.js');
  process.exit(1);
}

writeFileSync(SW, sw);

const bytes = files.reduce((sum, f) => sum + statSync(join(DIST, f.slice(1))).size, 0);
console.log(`✅ SW: ${assets.length} assets precacheados (${(bytes / 1024 / 1024).toFixed(1)} MB) · caché vinslingo-shell-${version}`);
