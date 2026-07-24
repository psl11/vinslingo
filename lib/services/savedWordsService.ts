import { runQuery, runStatement, getOne } from '../database/client';
import { generateUUID } from '../utils/uuid';
import type { SearchResult } from './vocabularyService';

// "Palabras guardadas" (chincheta 📌): listado personal del usuario. Guardar una
// palabra crea una fila en `saved_words` (ver docs/saved-words.md). Es dato de
// usuario y, de momento, LOCAL (no se sincroniza a Supabase). Las "categorías"
// por las que se filtra (nivel B1, slang, phrasal verb…) salen de las columnas
// `cefr_level`/`category` del propio vocabulario, no de un sistema de etiquetas
// aparte: por eso el listado se resuelve con un JOIN contra `vocabulary`.

export async function isWordSaved(vocabularyId: string): Promise<boolean> {
  const row = await getOne<{ id: string }>(
    'SELECT id FROM saved_words WHERE vocabulary_id = ?',
    [vocabularyId]
  );
  return !!row;
}

// Alterna el estado de guardado y devuelve el NUEVO estado (true = guardada).
// INSERT OR IGNORE evita duplicados si dos toggles corrieran a la vez.
export async function toggleSavedWord(vocabularyId: string): Promise<boolean> {
  const existing = await getOne<{ id: string }>(
    'SELECT id FROM saved_words WHERE vocabulary_id = ?',
    [vocabularyId]
  );
  if (existing) {
    await runStatement('DELETE FROM saved_words WHERE vocabulary_id = ?', [vocabularyId]);
    return false;
  }
  await runStatement(
    'INSERT OR IGNORE INTO saved_words (id, vocabulary_id, created_at) VALUES (?, ?, ?)',
    [generateUUID(), vocabularyId, Date.now()]
  );
  return true;
}

export async function removeSavedWord(vocabularyId: string): Promise<void> {
  await runStatement('DELETE FROM saved_words WHERE vocabulary_id = ?', [vocabularyId]);
}

export interface SavedWordFilter {
  // Filtra por una categoría de vocabulario (phave, idiom, british_slang…).
  category?: string;
  // Filtra por nivel(es) CEFR. NOTA: el listado NO aplica el filtro de nivel del
  // perfil a propósito — el usuario guardó estas palabras explícitamente, así que
  // ocultarlas por el nivel activo sería confuso. Este filtro es opcional y de la
  // propia pantalla de guardadas.
  cefrLevels?: string[];
}

// Listado de palabras guardadas, orden por más recientes primero. Reutiliza la
// forma `SearchResult` para pintarlas con VocabResultCard (como el buscador y las
// "palabras más falladas"). LEFT JOIN a user_vocabulary: una palabra guardada
// puede no tener progreso todavía (mastery_level saldrá null → "Nueva").
export async function getSavedWords(filter: SavedWordFilter = {}): Promise<SearchResult[]> {
  const { category, cefrLevels } = filter;
  let query = `SELECT v.*, uv.mastery_level, uv.times_correct, uv.times_incorrect
     FROM saved_words s
     INNER JOIN vocabulary v ON s.vocabulary_id = v.id
     LEFT JOIN user_vocabulary uv ON v.id = uv.vocabulary_id
     WHERE 1 = 1`;
  const params: (string | number)[] = [];
  if (category) {
    query += ` AND v.category = ?`;
    params.push(category);
  }
  if (cefrLevels && cefrLevels.length > 0) {
    query += ` AND v.cefr_level IN (${cefrLevels.map(() => '?').join(', ')})`;
    params.push(...cefrLevels);
  }
  query += ` ORDER BY s.created_at DESC`;
  return runQuery<SearchResult>(query, params);
}

// Categorías presentes entre las palabras guardadas (con recuento), para pintar
// solo los chips de filtro que tienen contenido.
export async function getSavedCategories(): Promise<{ category: string; count: number }[]> {
  return runQuery<{ category: string; count: number }>(
    `SELECT v.category AS category, COUNT(*) AS count
     FROM saved_words s
     INNER JOIN vocabulary v ON s.vocabulary_id = v.id
     WHERE v.category IS NOT NULL
     GROUP BY v.category
     ORDER BY count DESC`
  );
}

export async function getSavedWordsCount(): Promise<number> {
  const result = await getOne<{ count: number }>(
    'SELECT COUNT(*) AS count FROM saved_words'
  );
  return result?.count ?? 0;
}
