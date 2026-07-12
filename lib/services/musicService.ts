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

    await withTransaction(async (db) => {
      await db.runAsync('DELETE FROM song_vocabulary');
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

  // Adjuntar a cada palabra UN verso de contexto (el de su canción, priorizando
  // el mismo artista/canción del alcance si lo hay). Refuerza la memoria: verso
  // + título + artista donde aparece la palabra.
  const ids = words.map((w) => w.id);
  const ctxWhere: string[] = [`sv.vocabulary_id IN (${ids.map(() => '?').join(', ')})`];
  const ctxParams: (string | number)[] = [...ids];
  if (songId) { ctxWhere.push('sv.song_id = ?'); ctxParams.push(songId); }
  else if (artistId) { ctxWhere.push('s.artist_id = ?'); ctxParams.push(artistId); }
  const ctx = await runQuery<{ vocabulary_id: string; line_text: string | null; line_translation: string | null; highlighted_word: string | null; title: string; artist: string | null }>(
    `SELECT sv.vocabulary_id, sv.line_text, sv.line_translation, sv.highlighted_word, s.title, a.name as artist
     FROM song_vocabulary sv
     JOIN songs s ON s.id = sv.song_id
     LEFT JOIN artists a ON a.id = s.artist_id
     WHERE ${ctxWhere.join(' AND ')} AND sv.line_text IS NOT NULL
     ORDER BY s.rank ASC`,
    ctxParams
  );
  // Prioriza la canción de menor rank (tu top personal primero, luego la más
  // popular del artista): al recorrer en orden, el primero por palabra gana.
  const byWord = new Map<string, typeof ctx[number]>();
  for (const c of ctx) if (!byWord.has(c.vocabulary_id)) byWord.set(c.vocabulary_id, c);
  return words.map((w) => {
    const c = byWord.get(w.id);
    return {
      ...w,
      music_line: c?.line_text ?? null,
      music_line_translation: c?.line_translation ?? null,
      music_highlight: c?.highlighted_word ?? null,
      music_song: c?.title ?? null,
      music_artist: c?.artist ?? null,
    };
  });
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
