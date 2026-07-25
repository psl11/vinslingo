#!/usr/bin/env node
/**
 * Sube las letras de ./letras-playlist.txt (local, gitignored) a la tabla
 * privada `song_lyrics` de Supabase.
 *
 * La tabla tiene RLS y solo la lee una cuenta; este script usa la SERVICE ROLE
 * KEY, que se salta la RLS por diseño. Por eso solo se ejecuta desde tu máquina
 * y nunca desde CI ni desde el build de Vercel.
 *
 * Requisitos:
 *   1. Haber ejecutado supabase/migrations/song_lyrics.sql en el editor SQL.
 *   2. Tener .env con SUPABASE_SERVICE_ROLE_KEY y EXPO_PUBLIC_SUPABASE_URL.
 *
 * Uso:
 *   node scripts/upload-lyrics.mjs              # prueba en seco, no escribe
 *   node scripts/upload-lyrics.mjs --apply      # escribe de verdad
 *   node scripts/upload-lyrics.mjs --apply --artist Oasis
 *
 * Ver docs/song-lyrics-privadas.md.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// .env a mano: el script se lanza con `node`, sin el precargado de Expo.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const APPLY = process.argv.includes('--apply');
const ai = process.argv.indexOf('--artist');
const ARTIST = ai >= 0 ? process.argv[ai + 1].toLowerCase() : null;
const LYRICS = 'letras-playlist.txt';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('\n❌ Faltan EXPO_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env\n');
  process.exit(1);
}
if (!existsSync(LYRICS)) {
  console.error(`\n❌ No existe ./${LYRICS}. Ejecuta antes scripts/download-lyrics.mjs\n`);
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const norm = (s) => (s || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9]/g, '');
const key2 = (t, a) => `${norm(t)}|${norm((a || '').split(',')[0])}`;

// --- letras locales ---
const local = new Map();
{
  let cur = null;
  for (const line of readFileSync(LYRICS, 'utf8').split('\n')) {
    const m = line.match(/^###\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*$/);
    if (m) { cur = { title: m[2], artist: m[3], lines: [] }; local.set(key2(m[2], m[3]), cur); }
    else if (cur) cur.lines.push(line);
  }
}
console.log(`\n📄 ${local.size} letras en ./${LYRICS}`);

// --- canciones del catálogo (solo las tuyas) ---
const { data: songs, error: e1 } = await supabase
  .from('songs').select('id, title, artist_id, source').eq('source', 'user');
if (e1) { console.error('❌ ' + e1.message); process.exit(1); }
const { data: artists, error: e2 } = await supabase.from('artists').select('id, name');
if (e2) { console.error('❌ ' + e2.message); process.exit(1); }
const byId = Object.fromEntries(artists.map((a) => [a.id, a.name]));

const rows = [];
let sinLetra = 0;
for (const s of songs) {
  const artist = byId[s.artist_id] ?? '';
  if (ARTIST && !artist.toLowerCase().includes(ARTIST)) continue;
  const hit = local.get(key2(s.title, artist));
  if (!hit) { sinLetra++; continue; }
  // Se limpian las líneas vacías del principio/final y los encabezados sueltos.
  const lyrics = hit.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!lyrics) { sinLetra++; continue; }
  // El descargador deja un marcador cuando no encuentra letra. Pasa sobre todo
  // con instrumentales (Orion de Metallica, Sunrise de Coldplay), que
  // sencillamente no tienen. Subirlo enseñaría el marcador como si fuera la
  // letra, así que se descarta.
  if (/NO DESCARGADA/i.test(lyrics) || lyrics.split('\n').length < 4) { sinLetra++; continue; }
  rows.push({ song_id: s.id, lyrics });
}

console.log(`   ${rows.length} canciones con letra para subir · ${sinLetra} sin letra local`);

if (!APPLY) {
  console.log('\n🔍 Prueba en seco. Ejemplos:');
  for (const r of rows.slice(0, 3)) {
    const s = songs.find((x) => x.id === r.song_id);
    console.log(`   ${s.title} — ${r.lyrics.split('\n').length} líneas`);
  }
  console.log('\n   Añade --apply para escribir en Supabase.\n');
  process.exit(0);
}

// Lotes pequeños: son textos largos y el upsert de una tacada se puede atragantar.
let subidas = 0;
for (let i = 0; i < rows.length; i += 50) {
  const chunk = rows.slice(i, i + 50);
  const { error } = await supabase.from('song_lyrics').upsert(chunk, { onConflict: 'song_id' });
  if (error) { console.error(`\n❌ Lote ${i / 50 + 1}: ${error.message}`); process.exit(1); }
  subidas += chunk.length;
  process.stdout.write(`\r   subiendo... ${subidas}/${rows.length}`);
}

console.log(`\n\n✅ ${subidas} letras en song_lyrics (privada, RLS).`);
console.log('   Visible solo desde la cuenta autorizada en la política RLS.');
console.log('   NO se versiona ni entra en el backup del repo.\n');
