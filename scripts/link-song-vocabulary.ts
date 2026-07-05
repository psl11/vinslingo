#!/usr/bin/env npx tsx
/**
 * Cataloga y enlaza el contenido de canciones que YA existe en
 * vocabulary.song_lyric (verso + título + artista, aprobado en sesiones
 * anteriores) hacia las tablas relacionales `artists`, `songs` y
 * `song_vocabulary`. No genera ni una palabra de letra nueva: solo
 * organiza metadatos (títulos, nombres de artista, IDs) para que el
 * contenido ya aprobado quede correctamente consultable por canción.
 *
 * Uso:
 *   npx tsx scripts/link-song-vocabulary.ts           # dry-run
 *   npx tsx scripts/link-song-vocabulary.ts --apply   # aplica los cambios
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface VocabRow {
  id: string;
  word: string;
  song_lyric: string | null;
  song_title: string | null;
  song_artist: string | null;
}
interface Artist { id: string; name: string }
interface Song { id: string; artist_id: string; title: string; lyrics_excerpt: string }
interface SongVocab { id: string; song_id: string; vocabulary_id: string }

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).order('id').range(from, from + PAGE - 1);
    if (error) throw new Error(`[${table}] ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function main() {
  console.log(APPLY ? '=== MODO APLICAR ===' : '=== DRY RUN (usa --apply para ejecutar) ===\n');

  const vocab = await fetchAll<VocabRow>('vocabulary', 'id, word, song_lyric, song_title, song_artist');
  const withLyric = vocab.filter((r) => r.song_lyric && r.song_lyric.trim() && r.song_title && r.song_artist);
  console.log(`vocabulary con verso+título+artista: ${withLyric.length}`);

  const artists = await fetchAll<Artist>('artists', 'id, name');
  const songs = await fetchAll<Song>('songs', 'id, artist_id, title');
  const songVocab = await fetchAll<SongVocab>('song_vocabulary', 'id, song_id, vocabulary_id');

  const artistByName = new Map(artists.map((a) => [a.name.trim().toLowerCase(), a.id]));
  const songByKey = new Map(songs.map((s) => [`${s.title.trim().toLowerCase()}|${s.artist_id}`, s.id]));
  const linkedVocabIds = new Set(songVocab.map((sv) => sv.vocabulary_id));

  const newArtists: Artist[] = [];
  const newSongs: Song[] = [];
  const newLinks: { id: string; song_id: string; vocabulary_id: string; line_text: string; highlighted_word: string; line_index: number }[] = [];

  for (const r of withLyric) {
    if (linkedVocabIds.has(r.id)) continue; // ya enlazada

    const artistKey = r.song_artist!.trim().toLowerCase();
    let artistId = artistByName.get(artistKey);
    if (!artistId) {
      const pending = newArtists.find((a) => a.name.trim().toLowerCase() === artistKey);
      if (pending) {
        artistId = pending.id;
      } else {
        artistId = uuid();
        newArtists.push({ id: artistId, name: r.song_artist! });
        artistByName.set(artistKey, artistId);
      }
    }

    const songKey = `${r.song_title!.trim().toLowerCase()}|${artistId}`;
    let songId = songByKey.get(songKey);
    if (!songId) {
      const pending = newSongs.find((s) => s.title.trim().toLowerCase() === r.song_title!.trim().toLowerCase() && s.artist_id === artistId);
      if (pending) {
        songId = pending.id;
      } else {
        songId = uuid();
        // lyrics_excerpt es NOT NULL en el schema; usamos el propio verso
        // ya aprobado como excerpt en vez de un valor vacío/inventado.
        newSongs.push({ id: songId, artist_id: artistId, title: r.song_title!, lyrics_excerpt: r.song_lyric! });
        songByKey.set(songKey, songId);
      }
    }

    newLinks.push({
      id: uuid(),
      song_id: songId,
      vocabulary_id: r.id,
      line_text: r.song_lyric!,
      highlighted_word: r.word,
      line_index: 0,
    });
  }

  console.log(`artistas nuevos a crear: ${newArtists.length}`);
  console.log(`canciones nuevas a crear: ${newSongs.length}`);
  console.log(`enlaces song_vocabulary nuevos: ${newLinks.length}`);
  console.log(`(ya enlazadas antes: ${linkedVocabIds.size})`);

  if (!APPLY) {
    console.log('\nDry run completo. Revisa los números y ejecuta con --apply.');
    return;
  }

  console.log('\nAplicando...');

  for (let i = 0; i < newArtists.length; i += 100) {
    const batch = newArtists.slice(i, i + 100);
    const { error } = await supabase.from('artists').insert(batch);
    if (error) throw new Error(`insert artists: ${error.message}`);
  }
  console.log(`✓ ${newArtists.length} artistas creados`);

  for (let i = 0; i < newSongs.length; i += 100) {
    const batch = newSongs.slice(i, i + 100).map((s) => ({ ...s, album: null, year: null }));
    const { error } = await supabase.from('songs').insert(batch);
    if (error) throw new Error(`insert songs: ${error.message}`);
  }
  console.log(`✓ ${newSongs.length} canciones creadas`);

  for (let i = 0; i < newLinks.length; i += 100) {
    const batch = newLinks.slice(i, i + 100);
    const { error } = await supabase.from('song_vocabulary').insert(batch);
    if (error) throw new Error(`insert song_vocabulary: ${error.message}`);
  }
  console.log(`✓ ${newLinks.length} enlaces song_vocabulary creados`);

  const { count } = await supabase.from('song_vocabulary').select('*', { count: 'exact', head: true });
  console.log(`\nsong_vocabulary total tras el proceso: ${count}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
