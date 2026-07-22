import { supabase } from '../supabase';
import { runQuery, withTransaction, getSyncMetadata, setSyncMetadata } from '../database/client';
import { VocabularyItem } from '../database/queries';

// "Aprende con tu música": sincroniza el espejo local de songs/artists/
// song_vocabulary (solo source='user') y expone consultas para la sección.
// Diseño y política en docs/music-feature.md.

const MUSIC_SYNC_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

/**
 * Descarga las canciones del usuario (source='user'), sus matches y los artistas
 * referenciados, y reemplaza las tablas locales en UNA transacción. Tablas
 * pequeñas (~500 canciones / ~750 matches), así que full replace. Gateado por
 * intervalo mínimo salvo `force`. Degrada con gracia si las tablas no existen.
 */
export async function syncMusicFromSupabase(options: { force?: boolean } = {}): Promise<number> {
  const { force = false } = options;
  try {
    const last = await getSyncMetadata('music_last_sync');
    const localCount = (await runQuery<{ c: number }>('SELECT COUNT(*) as c FROM songs'))[0]?.c ?? 0;
    if (!force && localCount > 0 && last && Date.now() - Number(last) < MUSIC_SYNC_MIN_INTERVAL_MS) {
      return 0;
    }

    const { data: songs, error: se } = await supabase
      .from('songs')
      .select('id, artist_id, title, source, rank')
      .eq('source', 'user');
    if (se) throw se;
    if (!songs || songs.length === 0) return 0;

    const songIds = songs.map((s) => s.id);
    const artistIds = [...new Set(songs.map((s) => s.artist_id).filter(Boolean))] as string[];

    const sv: any[] = [];
    for (let i = 0; i < songIds.length; i += 200) {
      const { data, error } = await supabase
        .from('song_vocabulary')
        .select('id, song_id, vocabulary_id, line_text, line_translation, highlighted_word, line_index')
        .in('song_id', songIds.slice(i, i + 200));
      if (error) throw error;
      if (data) sv.push(...data);
    }

    const artists: any[] = [];
    for (let i = 0; i < artistIds.length; i += 200) {
      const { data, error } = await supabase.from('artists').select('id, name').in('id', artistIds.slice(i, i + 200));
      if (error) throw error;
      if (data) artists.push(...data);
    }

    // Notas por canción (capa 2). Degrada con gracia si la tabla no existe todavía.
    const notes: any[] = [];
    try {
      for (let i = 0; i < songIds.length; i += 200) {
        const { data, error } = await supabase
          .from('song_notes')
          .select('id, song_id, kind, term, explanation, line_text')
          .in('song_id', songIds.slice(i, i + 200));
        if (error) throw error;
        if (data) notes.push(...data);
      }
    } catch (e) {
      console.log('song_notes sync skipped:', (e as any)?.message ?? e);
    }

    await withTransaction(async (db) => {
      await db.runAsync('DELETE FROM song_vocabulary');
      await db.runAsync('DELETE FROM song_notes');
      await db.runAsync('DELETE FROM songs');
      await db.runAsync('DELETE FROM artists');
      for (const a of artists) {
        await db.runAsync('INSERT OR REPLACE INTO artists (id, name) VALUES (?, ?)', [a.id, a.name]);
      }
      for (const s of songs) {
        await db.runAsync('INSERT OR REPLACE INTO songs (id, artist_id, title, source, rank) VALUES (?, ?, ?, ?, ?)', [
          s.id, s.artist_id, s.title, s.source, s.rank ?? null,
        ]);
      }
      for (const r of sv) {
        await db.runAsync(
          'INSERT OR REPLACE INTO song_vocabulary (id, song_id, vocabulary_id, line_text, line_translation, highlighted_word, line_index) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [r.id, r.song_id, r.vocabulary_id, r.line_text, r.line_translation ?? null, r.highlighted_word, r.line_index]
        );
      }
      for (const n of notes) {
        await db.runAsync(
          'INSERT OR REPLACE INTO song_notes (id, song_id, kind, term, explanation, line_text) VALUES (?, ?, ?, ?, ?, ?)',
          [n.id, n.song_id, n.kind ?? null, n.term, n.explanation, n.line_text ?? null]
        );
      }
    });

    await setSyncMetadata('music_last_sync', String(Date.now()));
    console.log(`✅ Synced music: ${songs.length} songs, ${sv.length} matches, ${artists.length} artists`);
    return songs.length;
  } catch (error) {
    // No romper el arranque si el contenido musical aún no está en el servidor.
    console.log('Music sync skipped/failed:', (error as any)?.message ?? error);
    return 0;
  }
}

function cefrClause(cefrLevels: string[] | undefined, params: (string | number)[]): string {
  if (!cefrLevels || cefrLevels.length === 0) return '';
  params.push(...cefrLevels);
  return ` AND v.cefr_level IN (${cefrLevels.map(() => '?').join(', ')})`;
}

/** Cuántas palabras únicas de tu BD aparecen en tu música (para la tarjeta). */
export async function getMusicWordCount(): Promise<{ words: number; songs: number }> {
  const w = (await runQuery<{ c: number }>('SELECT COUNT(DISTINCT vocabulary_id) as c FROM song_vocabulary'))[0]?.c ?? 0;
  const s = (await runQuery<{ c: number }>('SELECT COUNT(DISTINCT song_id) as c FROM song_vocabulary'))[0]?.c ?? 0;
  return { words: w, songs: s };
}

/** Categorías presentes en tu música con nº de palabras únicas. */
export async function getMusicCategories(cefrLevels?: string[]): Promise<{ category: string; wordCount: number }[]> {
  const params: (string | number)[] = [];
  const cefr = cefrClause(cefrLevels, params);
  return runQuery(
    `SELECT v.category as category, COUNT(DISTINCT v.id) as wordCount
     FROM vocabulary v JOIN song_vocabulary sv ON sv.vocabulary_id = v.id
     WHERE 1=1${cefr}
     GROUP BY v.category ORDER BY wordCount DESC`,
    params
  );
}

// Umbral mínimo de palabras para que un artista aparezca como entrada propia:
// con media ~2 palabras/canción, "por canción" sería ruido; agrupando por
// artista buscamos que cada uno dé una ronda de verdad. Los artistas por debajo
// del umbral no se pierden: su vocabulario sigue en "Top recurrentes" y "Por tipo".
export const MIN_ARTIST_WORDS = 8;

/** Artistas de tu música con >= MIN_ARTIST_WORDS palabras, por nº de palabras. */
export async function getMusicArtists(
  cefrLevels?: string[]
): Promise<{ id: string; name: string; wordCount: number; songCount: number }[]> {
  const params: (string | number)[] = [];
  const cefr = cefrClause(cefrLevels, params);
  params.push(MIN_ARTIST_WORDS);
  return runQuery(
    `SELECT a.id as id, a.name as name,
       COUNT(DISTINCT v.id) as wordCount,
       COUNT(DISTINCT s.id) as songCount
     FROM artists a
     JOIN songs s ON s.artist_id = a.id
     JOIN song_vocabulary sv ON sv.song_id = s.id
     JOIN vocabulary v ON v.id = sv.vocabulary_id
     WHERE 1=1${cefr}
     GROUP BY a.id
     HAVING wordCount >= ?
     ORDER BY wordCount DESC`,
    params
  );
}

/** Canciones con contenido estudiable (palabras ancladas o notas), para el
 *  listado "Por canción". Ordenadas por riqueza de contenido, luego por rank. */
export async function getMusicSongs(
  cefrLevels?: string[]
): Promise<{ id: string; title: string; artist: string | null; wordCount: number; noteCount: number }[]> {
  const params: (string | number)[] = [];
  const cefr = cefrLevels && cefrLevels.length
    ? ` AND v.cefr_level IN (${cefrLevels.map(() => '?').join(', ')})`
    : '';
  if (cefr) params.push(...cefrLevels!);
  // Lista enfocada: solo canciones enriquecidas por el extractor (con vocabulario
  // coloquial o notas). Las que solo tienen algún match curado del feature
  // original no dan una experiencia "por canción" rica, así que se dejan fuera.
  // `wordCount` sí cuenta TODO el vocabulario anclado (para estudiarlo y el badge).
  return runQuery(
    `SELECT s.id as id, s.title as title, a.name as artist,
       COUNT(DISTINCT v.id) as wordCount,
       COUNT(DISTINCT CASE WHEN v.category = 'colloquial' THEN v.id END) as colloquialCount,
       (SELECT COUNT(*) FROM song_notes n WHERE n.song_id = s.id) as noteCount
     FROM songs s
     LEFT JOIN artists a ON a.id = s.artist_id
     LEFT JOIN song_vocabulary sv ON sv.song_id = s.id
     LEFT JOIN vocabulary v ON v.id = sv.vocabulary_id${cefr}
     GROUP BY s.id
     HAVING colloquialCount > 0 OR noteCount > 0
     ORDER BY (colloquialCount + noteCount) DESC, s.rank ASC`,
    params
  );
}

/** Notas (referencias + wordplay) de una canción, con su verso de contexto. */
export async function getSongNotes(
  songId: string
): Promise<{ id: string; kind: string; term: string; explanation: string; line_text: string | null }[]> {
  return runQuery(
    `SELECT id, kind, term, explanation, line_text FROM song_notes
     WHERE song_id = ? ORDER BY CASE kind WHEN 'wordplay' THEN 0 ELSE 1 END, term`,
    [songId]
  );
}

/**
 * Vocabulario que aparece en tu música, con filtros. Devuelve VocabularyItem
 * (v.*) — el mismo shape que el resto del estudio. `top` ordena por nº de
 * canciones distintas (recurrencia); si no, por frecuencia.
 */
export type MusicVocabularyItem = VocabularyItem & {
  music_line?: string | null;
  music_line_translation?: string | null;
  music_highlight?: string | null;
  music_song?: string | null;
  music_artist?: string | null;
};

export async function getMusicVocabulary(opts: {
  artistId?: string;
  songId?: string;
  category?: string;
  top?: boolean;
  cefrLevels?: string[];
  limit?: number;
}): Promise<MusicVocabularyItem[]> {
  const { artistId, songId, category, top, cefrLevels, limit = 20 } = opts;
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (songId) { where.push('sv.song_id = ?'); params.push(songId); }
  if (artistId) { where.push('s.artist_id = ?'); params.push(artistId); }
  if (category) { where.push('v.category = ?'); params.push(category); }
  if (cefrLevels && cefrLevels.length > 0) {
    where.push(`v.cefr_level IN (${cefrLevels.map(() => '?').join(', ')})`);
    params.push(...cefrLevels);
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const order = top ? 'ORDER BY COUNT(DISTINCT sv.song_id) DESC, v.frequency_rank ASC' : 'ORDER BY v.frequency_rank ASC';
  params.push(limit);
  const words = await runQuery<VocabularyItem>(
    `SELECT v.* FROM vocabulary v
       JOIN song_vocabulary sv ON sv.vocabulary_id = v.id
       JOIN songs s ON s.id = sv.song_id
     ${whereSql}
     GROUP BY v.id
     ${order}
     LIMIT ?`,
    params
  );
  if (words.length === 0) return words;

  // Verso de contexto (prioridad por rank) para cada palabra del alcance.
  const byWord = await fetchMusicContext(words.map((w) => w.id), { songId, artistId });
  return words.map((w) => mergeMusicContext(w, byWord.get(w.id)));
}

type MusicCtx = { vocabulary_id: string; line_text: string | null; line_translation: string | null; highlighted_word: string | null; title: string; artist: string | null };
type MusicContextFields = { music_line: string | null; music_line_translation: string | null; music_highlight: string | null; music_song: string | null; music_artist: string | null };

// Contexto (verso + canción) de MENOR rank por vocabulary_id — tu top personal
// primero, luego la más popular del artista. Opcionalmente acotado a una
// canción/artista (ejes del hub).
async function fetchMusicContext(ids: string[], opts: { songId?: string; artistId?: string } = {}): Promise<Map<string, MusicCtx>> {
  const byWord = new Map<string, MusicCtx>();
  if (ids.length === 0) return byWord;
  const where = [`sv.vocabulary_id IN (${ids.map(() => '?').join(', ')})`];
  const params: (string | number)[] = [...ids];
  if (opts.songId) { where.push('sv.song_id = ?'); params.push(opts.songId); }
  else if (opts.artistId) { where.push('s.artist_id = ?'); params.push(opts.artistId); }
  const ctx = await runQuery<MusicCtx>(
    `SELECT sv.vocabulary_id, sv.line_text, sv.line_translation, sv.highlighted_word, s.title, a.name as artist
     FROM song_vocabulary sv
     JOIN songs s ON s.id = sv.song_id
     LEFT JOIN artists a ON a.id = s.artist_id
     WHERE ${where.join(' AND ')} AND sv.line_text IS NOT NULL
     ORDER BY s.rank ASC`,
    params
  );
  for (const c of ctx) if (!byWord.has(c.vocabulary_id)) byWord.set(c.vocabulary_id, c);
  return byWord;
}

function mergeMusicContext<T extends { id: string }>(card: T, c?: MusicCtx): T & MusicContextFields {
  return {
    ...card,
    music_line: c?.line_text ?? null,
    music_line_translation: c?.line_translation ?? null,
    music_highlight: c?.highlighted_word ?? null,
    music_song: c?.title ?? null,
    music_artist: c?.artist ?? null,
  };
}

// Ancla inversa: adjunta a cualquier lista de tarjetas (estudio normal) el verso
// de tu música donde aparece cada palabra, si aparece. Misma prioridad por rank.
export async function attachMusicContext<T extends { id: string }>(cards: T[]): Promise<(T & MusicContextFields)[]> {
  const byWord = cards.length ? await fetchMusicContext(cards.map((c) => c.id)) : new Map<string, MusicCtx>();
  return cards.map((c) => mergeMusicContext(c, byWord.get(c.id)));
}

/** Canciones en las que aparece una palabra (para el ancla en la ficha). */
export async function getSongsForWord(
  vocabularyId: string,
  limit = 3
): Promise<{ title: string; artist: string; line_text: string | null }[]> {
  return runQuery(
    `SELECT s.title as title, a.name as artist, sv.line_text as line_text
     FROM song_vocabulary sv
     JOIN songs s ON s.id = sv.song_id
     LEFT JOIN artists a ON a.id = s.artist_id
     WHERE sv.vocabulary_id = ?
     LIMIT ?`,
    [vocabularyId, limit]
  );
}
