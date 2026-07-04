#!/usr/bin/env npx tsx
/**
 * Deduplica la tabla vocabulary de Supabase.
 *
 * La importación inicial del NGSL metió ~560 filas duplicadas (misma palabra y
 * misma categoría gramatical). Este script:
 *  1. Agrupa por word+part_of_speech (case-insensitive).
 *  2. Elige una fila superviviente por grupo (la que más contenido tiene:
 *     verso de canción > ejemplos > mejor frequency_rank > más antigua).
 *  3. Fusiona la traducción (curada a mano para los grupos donde difería) y
 *     usa el nivel CEFR más bajo del grupo.
 *  4. Remapea las referencias de user_vocabulary (fusionando progreso si el
 *     usuario tenía filas para ambas copias) y song_vocabulary.
 *  5. Borra las filas duplicadas.
 *
 * Uso:
 *   npx tsx scripts/dedupe-vocabulary.ts           # dry-run (no escribe nada)
 *   npx tsx scripts/dedupe-vocabulary.ts --apply   # aplica los cambios
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en el entorno (cargar .env).
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface VocabRow {
  id: string;
  word: string;
  translation: string;
  part_of_speech: string | null;
  cefr_level: string;
  category: string | null;
  frequency_rank: number | null;
  example_sentence: string | null;
  example_translation: string | null;
  example_sentence_2: string | null;
  example_translation_2: string | null;
  song_lyric: string | null;
  song_lyric_translation: string | null;
  song_title: string | null;
  song_artist: string | null;
  created_at: string;
}

// Traducciones curadas para los grupos donde las copias diferían. Se fusionan
// las acepciones válidas para la categoría gramatical y se descartan tokens de
// otra categoría que se colaron (p.ej. "reloj" en watch como verbo).
const CURATED_TRANSLATIONS: Record<string, string> = {
  'gas|n': 'gas, gasolina',
  'short|adj': 'corto, bajo',
  'delete|v': 'borrar, eliminar',
  'path|n': 'camino, sendero',
  'wrong|adj': 'incorrecto, equivocado',
  'power|n': 'poder, energía',
  'setting|n': 'configuración, escenario',
  'altogether|adv': 'completamente, en total',
  'outstanding|adj': 'excepcional, sobresaliente',
  'change|v': 'cambiar',
  'performance|n': 'rendimiento, actuación',
  'light|adj': 'ligero',
  'little|adj': 'pequeño, poco',
  'ratio|n': 'proporción, ratio',
  'own|adj': 'propio',
  'smooth|adj': 'liso, suave',
  'rough|adj': 'áspero, brusco',
  'view|n': 'vista, opinión',
  'back|n': 'espalda, parte trasera',
  'close|v': 'cerrar',
  'subject|n': 'asignatura, tema',
  'top|n': 'cima, parte superior',
  'kind|n': 'tipo',
  'either|adv': 'tampoco, cualquiera',
  'turn|v': 'girar',
  'release|v': 'soltar, liberar',
  'party|n': 'fiesta, partido',
  'join|v': 'unirse, unir',
  'yet|adv': 'todavía, aún',
  'agree|v': 'estar de acuerdo, acordar',
  'point|n': 'punto',
  'environment|n': 'medio ambiente, entorno',
  'character|n': 'personaje, carácter',
  'all|adj': 'todo, todos',
  'gentle|adj': 'suave, gentil',
  'within|prep': 'dentro de',
  'awful|adj': 'horrible, espantoso',
  'claim|v': 'afirmar, reclamar',
  'through|prep': 'a través de',
  'feature|n': 'característica, función',
  'last|adj': 'último',
  'some|adj': 'algunos, algún',
  'tip|n': 'propina, consejo',
  'width|n': 'anchura, ancho',
  'above|prep': 'encima de, sobre',
  'helpful|adj': 'útil, servicial',
  'drop|v': 'dejar caer, soltar',
  'major|adj': 'principal, mayor',
  'order|n': 'orden',
  'soft|adj': 'suave, blando',
  'just|adv': 'solo, justo',
  'too|adv': 'también, demasiado',
  'bit|n': 'poco, bit',
  'only|adv': 'solo',
  'board|n': 'junta, tablero',
  'certain|adj': 'cierto, seguro',
  'application|n': 'solicitud, aplicación',
  'trial|n': 'prueba, juicio',
  'begin|v': 'empezar, comenzar',
  'maybe|adv': 'tal vez, quizás',
  'speech|n': 'discurso, habla',
  'watch|v': 'ver, mirar',
  'deny|v': 'negar, denegar',
};

const LEVEL_ORDER: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

function contentScore(r: VocabRow): number {
  return (r.song_lyric ? 4 : 0) + (r.example_sentence ? 2 : 0) + (r.example_sentence_2 ? 1 : 0);
}

function pickSurvivor(group: VocabRow[]): VocabRow {
  return [...group].sort((a, b) => {
    const score = contentScore(b) - contentScore(a);
    if (score !== 0) return score;
    const rankA = a.frequency_rank ?? Infinity;
    const rankB = b.frequency_rank ?? Infinity;
    if (rankA !== rankB) return rankA - rankB;
    return a.created_at.localeCompare(b.created_at);
  })[0];
}

async function fetchAll<T>(table: string): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await supabase.from(table).select('*').order('id').range(from, from + PAGE - 1);
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

  const vocab = await fetchAll<VocabRow>('vocabulary');
  console.log(`vocabulary: ${vocab.length} filas`);

  // Agrupar por word+pos
  const groups = new Map<string, VocabRow[]>();
  for (const r of vocab) {
    const key = `${r.word.toLowerCase().trim()}|${r.part_of_speech || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const dupGroups = [...groups.entries()].filter(([, g]) => g.length > 1);
  console.log(`grupos duplicados: ${dupGroups.length}`);

  const idRemap = new Map<string, string>(); // deleted id -> survivor id
  const survivorPatches = new Map<string, Record<string, string>>(); // survivor id -> patch

  for (const [key, group] of dupGroups) {
    const survivor = pickSurvivor(group);
    const patch: Record<string, string> = {};

    // Nivel CEFR: el más bajo del grupo
    const minLevel = group.reduce((min, r) =>
      (LEVEL_ORDER[r.cefr_level] ?? 9) < (LEVEL_ORDER[min] ?? 9) ? r.cefr_level : min,
      survivor.cefr_level
    );
    if (minLevel !== survivor.cefr_level) patch.cefr_level = minLevel;

    // Traducción curada si el grupo tenía traducciones distintas
    const curated = CURATED_TRANSLATIONS[key];
    if (curated && curated !== survivor.translation) patch.translation = curated;

    if (Object.keys(patch).length > 0) survivorPatches.set(survivor.id, patch);

    for (const r of group) {
      if (r.id !== survivor.id) idRemap.set(r.id, survivor.id);
    }
  }

  console.log(`filas a borrar: ${idRemap.size}`);
  console.log(`supervivientes a parchear (traducción/nivel): ${survivorPatches.size}`);
  console.log(`vocabulary final: ${vocab.length - idRemap.size} filas\n`);

  // --- Referencias en user_vocabulary ---
  const userVocab = await fetchAll<{
    id: string; user_id: string; vocabulary_id: string;
    ease_factor: number; interval_days: number; repetitions: number;
    next_review_at: string | null; last_reviewed_at: string | null;
    times_correct: number; times_incorrect: number; mastery_level: number;
  }>('user_vocabulary');

  const affected = userVocab.filter(uv => idRemap.has(uv.vocabulary_id));
  console.log(`user_vocabulary: ${userVocab.length} filas, ${affected.length} afectadas por el remapeo`);

  // Índice user+vocab -> fila, para detectar fusiones
  const byUserVocab = new Map<string, typeof userVocab[0]>();
  for (const uv of userVocab) byUserVocab.set(`${uv.user_id}|${uv.vocabulary_id}`, uv);

  const uvUpdates: { id: string; vocabulary_id: string }[] = [];
  const uvMerges: { keepId: string; deleteId: string; merged: Record<string, unknown> }[] = [];

  for (const uv of affected) {
    const survivorId = idRemap.get(uv.vocabulary_id)!;
    const existing = byUserVocab.get(`${uv.user_id}|${survivorId}`);
    if (existing) {
      // El usuario tiene progreso en ambas copias: fusionar en la del superviviente.
      // SRS: conservar el estado de la fila repasada más recientemente; contadores: sumar.
      const uvTime = uv.last_reviewed_at ? Date.parse(uv.last_reviewed_at) : 0;
      const exTime = existing.last_reviewed_at ? Date.parse(existing.last_reviewed_at) : 0;
      const srs = uvTime > exTime ? uv : existing;
      uvMerges.push({
        keepId: existing.id,
        deleteId: uv.id,
        merged: {
          ease_factor: srs.ease_factor,
          interval_days: srs.interval_days,
          repetitions: srs.repetitions,
          next_review_at: srs.next_review_at,
          last_reviewed_at: srs.last_reviewed_at,
          times_correct: existing.times_correct + uv.times_correct,
          times_incorrect: existing.times_incorrect + uv.times_incorrect,
          mastery_level: Math.max(existing.mastery_level, uv.mastery_level),
          updated_at: new Date().toISOString(),
        },
      });
    } else {
      uvUpdates.push({ id: uv.id, vocabulary_id: survivorId });
    }
  }
  console.log(`  -> remapear: ${uvUpdates.length}, fusionar: ${uvMerges.length}`);

  // --- Referencias en song_vocabulary ---
  const songVocab = await fetchAll<{ id: string; song_id: string; vocabulary_id: string }>('song_vocabulary');
  const svAffected = songVocab.filter(sv => idRemap.has(sv.vocabulary_id));
  const svExisting = new Set(songVocab.map(sv => `${sv.song_id}|${sv.vocabulary_id}`));
  const svUpdates: { id: string; vocabulary_id: string }[] = [];
  const svDeletes: string[] = [];
  for (const sv of svAffected) {
    const survivorId = idRemap.get(sv.vocabulary_id)!;
    if (svExisting.has(`${sv.song_id}|${survivorId}`)) {
      svDeletes.push(sv.id); // ya existe la relación con el superviviente
    } else {
      svUpdates.push({ id: sv.id, vocabulary_id: survivorId });
    }
  }
  console.log(`song_vocabulary: ${songVocab.length} filas, remapear: ${svUpdates.length}, borrar (relación ya existente): ${svDeletes.length}`);

  if (!APPLY) {
    console.log('\nDry run completo. Revisa los números y ejecuta con --apply.');
    return;
  }

  // ============ APLICAR ============
  console.log('\nAplicando cambios...');

  // 1. Parchear supervivientes
  for (const [id, patch] of survivorPatches) {
    const { error } = await supabase.from('vocabulary').update(patch).eq('id', id);
    if (error) throw new Error(`patch survivor ${id}: ${error.message}`);
  }
  console.log(`✓ ${survivorPatches.size} supervivientes parcheados`);

  // 2. Remapear/fusionar user_vocabulary
  for (const u of uvUpdates) {
    const { error } = await supabase.from('user_vocabulary').update({ vocabulary_id: u.vocabulary_id }).eq('id', u.id);
    if (error) throw new Error(`remap user_vocabulary ${u.id}: ${error.message}`);
  }
  for (const m of uvMerges) {
    const { error: e1 } = await supabase.from('user_vocabulary').update(m.merged).eq('id', m.keepId);
    if (e1) throw new Error(`merge user_vocabulary ${m.keepId}: ${e1.message}`);
    const { error: e2 } = await supabase.from('user_vocabulary').delete().eq('id', m.deleteId);
    if (e2) throw new Error(`delete merged user_vocabulary ${m.deleteId}: ${e2.message}`);
  }
  console.log(`✓ user_vocabulary: ${uvUpdates.length} remapeadas, ${uvMerges.length} fusionadas`);

  // 3. Remapear song_vocabulary
  for (const u of svUpdates) {
    const { error } = await supabase.from('song_vocabulary').update({ vocabulary_id: u.vocabulary_id }).eq('id', u.id);
    if (error) throw new Error(`remap song_vocabulary ${u.id}: ${error.message}`);
  }
  for (const id of svDeletes) {
    const { error } = await supabase.from('song_vocabulary').delete().eq('id', id);
    if (error) throw new Error(`delete song_vocabulary ${id}: ${error.message}`);
  }
  console.log(`✓ song_vocabulary: ${svUpdates.length} remapeadas, ${svDeletes.length} borradas`);

  // 4. Borrar duplicados de vocabulary (en lotes de 100)
  const toDelete = [...idRemap.keys()];
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    const { error } = await supabase.from('vocabulary').delete().in('id', batch);
    if (error) throw new Error(`delete vocabulary batch ${i}: ${error.message}`);
  }
  console.log(`✓ ${toDelete.length} filas duplicadas borradas de vocabulary`);

  // Verificación final
  const { count } = await supabase.from('vocabulary').select('*', { count: 'exact', head: true });
  console.log(`\nvocabulary tras dedup: ${count} filas (esperado: ${vocab.length - idRemap.size})`);
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
