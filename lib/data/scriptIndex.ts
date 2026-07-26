import index from './podcastScriptIndex.json';

// Saber si una canción TIENE guion, sin descargar los guiones.
//
// Las listas de canciones necesitan esto para pintar el distintivo 🎙️. Cargar
// podcastScripts.json (~200 KB y creciendo) solo para comprobar la existencia
// sería tirar el ahorro del import() diferido de SongScript. Este índice son
// unos 2 KB y va en el bundle principal.
//
// La clave es `título|artista` normalizados, igual que en el JSON de guiones —
// ver scripts/build-podcast-scripts.mjs y docs/podcast-scripts.md.

const keys = new Set(index as string[]);

const norm = (s: string) => (s || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9]/g, '');

/** El artista del catálogo puede venir compuesto ("Jay-Z, Kanye West"); el guion se escribe para el principal. */
export function scriptKey(title?: string | null, artist?: string | null): string {
  return `${norm(title ?? '')}|${norm((artist ?? '').split(',')[0])}`;
}

export function hasScript(title?: string | null, artist?: string | null): boolean {
  if (!title || !artist) return false;
  return keys.has(scriptKey(title, artist));
}

/** Cuántas canciones de una lista tienen guion (para los contadores de cabecera). */
export function countWithScript(songs: { title: string; artist?: string | null }[], fallbackArtist?: string | null): number {
  return songs.filter((s) => hasScript(s.title, s.artist ?? fallbackArtist)).length;
}

// Guiones por artista. Se cuenta del propio índice (la clave lleva el artista
// detrás de la barra), así que el hub no necesita consultar la BD para saber
// qué artistas tienen historias. Se calcula una vez al cargar el módulo.
const byArtist = new Map<string, number>();
for (const k of keys) {
  const a = k.slice(k.indexOf('|') + 1);
  byArtist.set(a, (byArtist.get(a) ?? 0) + 1);
}

export function countScriptsByArtist(artist?: string | null): number {
  if (!artist) return 0;
  return byArtist.get(norm(artist.split(',')[0])) ?? 0;
}
