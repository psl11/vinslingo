#!/usr/bin/env node
/**
 * Borra dos fichas duplicadas: la misma palabra existía en dos categorías con el
 * mismo significado, así que salían dos veces al estudiar.
 * Idempotente: re-ejecutarlo no cambia nada si ya está aplicado.
 *
 * Uso:  node scripts/delete-duplicate-entries.mjs [--apply]
 *
 * Contexto (ver docs/content-qa.md):
 *  - hang out [american_slang] duplicaba hang out [phave], que es la buena (trae
 *    explicación y mini-gramática). Además no es jerga, es un phrasal mainstream.
 *    Ya está quitada de seed-slang.ts para que no vuelva al re-sembrar.
 *  - keep in mind [expression] duplicaba keep in mind [collocation], que es la que
 *    encaja (verbo + complemento fijo). No la recrea ningún seed.
 *
 *  Comprobado antes de borrar: 0 filas en user_vocabulary (ningún progreso que
 *  perder), song_vocabulary y quote_vocabulary. Se comprueba otra vez aquí.
 *
 *  OJO: el sync del cliente es incremental por updated_at y NO detecta borrados
 *  del servidor. La ficha desaparece del dispositivo en el siguiente full resync
 *  (a los 7 días, o forzando fullResync). Ver CLAUDE.md.
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** [palabra, categoría a borrar, categoría que se queda] */
const DUPES = [
  ['hang out', 'american_slang', 'phave'],
  ['keep in mind', 'expression', 'collocation'],
];

async function main() {
  console.log(`\n${APPLY ? '🔧 APLICANDO' : '🔍 DRY-RUN'}\n`);
  let changed = 0;
  for (const [word, dropCat, keepCat] of DUPES) {
    const { data: rows, error } = await supabase
      .from('vocabulary')
      .select('id, word, category, translation')
      .eq('word', word);
    if (error) { console.error('select', word, error); process.exit(1); }

    const drop = rows.filter((r) => r.category === dropCat);
    const keep = rows.filter((r) => r.category === keepCat);

    if (drop.length === 0 && keep.length === 1) { console.log(`= ${word}: ya aplicado`); continue; }
    if (drop.length !== 1 || keep.length !== 1) {
      console.error(`✗ ${word}: esperaba 1 en ${dropCat} y 1 en ${keepCat}, encontré ${drop.length}/${keep.length}`);
      process.exit(1);
    }

    // Nunca borrar algo que otra tabla referencia o que tenga progreso.
    for (const table of ['user_vocabulary', 'song_vocabulary', 'quote_vocabulary']) {
      const { data: refs, error: refErr } = await supabase
        .from(table).select('vocabulary_id').eq('vocabulary_id', drop[0].id);
      if (refErr) { console.error(table, refErr); process.exit(1); }
      if (refs.length) {
        console.error(`✗ ${word} [${dropCat}]: ${refs.length} filas en ${table}. Abortando.`);
        process.exit(1);
      }
    }

    console.log(`• ${word}`);
    console.log(`    borra  [${dropCat}]: ${drop[0].translation}`);
    console.log(`    queda  [${keepCat}]: ${keep[0].translation.slice(0, 90)}`);
    changed++;

    if (APPLY) {
      const { error: delErr } = await supabase.from('vocabulary').delete().eq('id', drop[0].id);
      if (delErr) { console.error('delete', word, delErr); process.exit(1); }
    }
  }

  console.log(`\n${changed} entradas ${APPLY ? 'borradas' : 'a borrar'}.`);
  if (!APPLY) console.log('ℹ️  dry-run. Añade --apply.\n');
  else console.log('▶ Ejecuta ahora: npm run backup:supabase && npm run validate:content\n');
}
main();
