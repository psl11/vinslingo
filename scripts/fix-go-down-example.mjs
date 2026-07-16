#!/usr/bin/env node
/**
 * Arregla el 2º ejemplo de "go down" [phave]: era de otra acepción.
 * Idempotente: re-ejecutarlo no cambia nada si ya está aplicado.
 *
 * Uso:  node scripts/fix-go-down-example.mjs [--apply]
 *
 * La ficha enseña "BAJAR (precios/nivel) / REDUCIRSE", pero el ejemplo 2 era
 * "The sun went down behind the mountains" — la acepción de PONERSE el sol, otra
 * distinta (y "El sol bajó" además estaba mal, sería "se puso"). Se cambia por un
 * ejemplo de la acepción que la ficha explica (fiebre → reducirse).
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PATCH = {
  example_sentence_2: 'Her fever went down after taking the medicine.',
  example_translation_2: 'Le bajó la fiebre después de tomar la medicina.',
};

async function main() {
  console.log(`\n${APPLY ? '🔧 APLICANDO' : '🔍 DRY-RUN'}\n`);
  const { data: rows, error } = await supabase
    .from('vocabulary')
    .select('id, word, example_sentence_2, example_translation_2')
    .eq('word', 'go down')
    .eq('category', 'phave');
  if (error) { console.error(error); process.exit(1); }
  if (!rows || rows.length !== 1) {
    console.error(`✗ go down: esperaba 1 fila, encontré ${rows?.length ?? 0}`);
    process.exit(1);
  }
  const row = rows[0];
  if (Object.entries(PATCH).every(([k, v]) => row[k] === v)) {
    console.log('= go down: ya aplicado\n');
    return;
  }
  console.log('• go down');
  console.log(`    antes: ${row.example_sentence_2} → ${row.example_translation_2}`);
  console.log(`    ahora: ${PATCH.example_sentence_2} → ${PATCH.example_translation_2}`);
  if (APPLY) {
    const { error: upErr } = await supabase.from('vocabulary').update(PATCH).eq('id', row.id);
    if (upErr) { console.error(upErr); process.exit(1); }
    console.log('\n▶ Ejecuta ahora: npm run backup:supabase && npm run validate:content\n');
  } else {
    console.log('\nℹ️  dry-run. Añade --apply.\n');
  }
}
main();
