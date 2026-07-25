#!/usr/bin/env node
/**
 * Descarga las ANOTACIONES de Genius (no las letras) para preparar el contenido
 * editorial de los guiones de podcast: son las explicaciones verso a verso de
 * "por qué dice esto", que es lo que no dan Songfacts ni Wikipedia.
 *
 * Usa la **API oficial** de Genius (api.genius.com), no scraping: es la vía
 * documentada, respeta sus términos y no te pueden bloquear por ella.
 *
 * ── Cómo conseguir el token (2 minutos, gratis) ────────────────────────────
 *   1. Entra en https://genius.com/api-clients y crea un "API Client"
 *      (cualquier nombre y URL valen; es para uso personal).
 *   2. Pulsa "Generate Access Token".
 *   3. Exporta el token antes de ejecutar:
 *        export GENIUS_ACCESS_TOKEN="tu_token"
 *
 * ── Uso ────────────────────────────────────────────────────────────────────
 *   node scripts/download-genius-annotations.mjs                # todo el catálogo
 *   node scripts/download-genius-annotations.mjs --artist Oasis # solo un artista
 *
 * Salida: ./genius-anotaciones/<slug>.json  (carpeta gitignored)
 * Reanudable: salta las que ya estén descargadas.
 *
 * NOTA: el contenido descargado es de sus autores. Es material de CONSULTA para
 * documentarse; en los guiones se escriben los hechos con palabras propias y se
 * citan declaraciones breves con atribución, igual que hace un libro de música.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const TOKEN = process.env.GENIUS_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('\n❌ Falta GENIUS_ACCESS_TOKEN.\n');
  console.error('   1. https://genius.com/api-clients → crea un API Client');
  console.error('   2. "Generate Access Token"');
  console.error('   3. export GENIUS_ACCESS_TOKEN="tu_token"\n');
  process.exit(1);
}

const ai = process.argv.indexOf('--artist');
const ARTIST_FILTER = ai >= 0 ? process.argv[ai + 1].toLowerCase() : null;
const OUT_DIR = 'genius-anotaciones';
const CATALOG = JSON.parse(readFileSync(new URL('./music-catalog.json', import.meta.url), 'utf8'));

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(pathname, params = {}) {
  const url = new URL('https://api.genius.com' + pathname);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (res.status === 429) { console.log('   ⏳ rate limit, espero 20s…'); await sleep(20000); return api(pathname, params); }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} en ${pathname}`);
  return res.json();
}

/** Busca el id de la canción en Genius por título + artista. */
async function findSongId(title, artist) {
  const q = `${title} ${artist.split(',')[0]}`;
  const { response } = await api('/search', { q });
  const hits = response?.hits || [];
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  // Preferimos coincidencia de título Y artista; si no, el primer resultado.
  const exact = hits.find((h) =>
    norm(h.result?.title).includes(norm(title).slice(0, 12)) &&
    norm(h.result?.primary_artist?.name).includes(norm(artist.split(',')[0]).slice(0, 6))
  );
  return (exact || hits[0])?.result?.id ?? null;
}

/** Anotaciones: /referents devuelve cada fragmento anotado + su explicación. */
async function fetchAnnotations(songId) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const { response } = await api('/referents', {
      song_id: songId, text_format: 'plain', per_page: 50, page,
    });
    const refs = response?.referents || [];
    if (!refs.length) break;
    for (const r of refs) {
      const body = r.annotations?.[0]?.body?.plain?.trim();
      if (!body) continue;
      out.push({
        fragmento: r.fragment?.trim() || '',      // el trozo de letra anotado
        anotacion: body,                          // la explicación
        votos: r.annotations?.[0]?.votes_total ?? 0,
        verificada: !!r.annotations?.[0]?.verified, // ✓ = validada por el artista
      });
    }
    if (refs.length < 50) break;
    await sleep(400);
  }
  // Las mejores primero: verificadas por el artista, luego las más votadas.
  return out.sort((a, b) => (b.verificada - a.verificada) || (b.votos - a.votos));
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR);
  const songs = CATALOG.filter((s) => !ARTIST_FILTER || s.artist.toLowerCase().includes(ARTIST_FILTER));
  const done = new Set(readdirSync(OUT_DIR).map((f) => f.replace(/\.json$/, '')));

  console.log(`\n🎤 ${songs.length} canciones${ARTIST_FILTER ? ` de "${ARTIST_FILTER}"` : ''} · ya descargadas: ${done.size}\n`);
  let ok = 0, skip = 0, fail = 0;

  for (const [i, s] of songs.entries()) {
    const name = slug(`${s.artist.split(',')[0]}-${s.title}`);
    if (done.has(name)) { skip++; continue; }
    const label = `[${i + 1}/${songs.length}] ${s.title}`;
    try {
      const id = await findSongId(s.title, s.artist);
      if (!id) { console.log(`   ✗ ${label} — no encontrada en Genius`); fail++; continue; }
      const anotaciones = await fetchAnnotations(id);
      writeFileSync(
        path.join(OUT_DIR, `${name}.json`),
        JSON.stringify({ titulo: s.title, artista: s.artist, genius_id: id, url: s.url, anotaciones }, null, 2)
      );
      console.log(`   ✓ ${label} — ${anotaciones.length} anotaciones${anotaciones.some((a) => a.verificada) ? ' (con verificadas ✓)' : ''}`);
      ok++;
      await sleep(600);   // amable con la API
    } catch (e) {
      console.log(`   ✗ ${label} — ${e.message}`);
      fail++;
      await sleep(1500);
    }
  }

  console.log(`\n✅ ${ok} descargadas · ${skip} ya estaban · ${fail} fallidas`);
  console.log(`   Carpeta: ./${OUT_DIR}/ (gitignored)\n`);
  console.log('   Pásame los ficheros de las canciones que quieras y los incorporo a los guiones.\n');
}
main();
