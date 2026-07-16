#!/usr/bin/env node
/**
 * Corrige el registro de 6 entradas de jerga mal etiquetadas como (malsonante).
 * Idempotente: re-ejecutarlo no cambia nada si ya está aplicado.
 *
 * Uso:  node scripts/fix-slang-register.mjs [--apply]
 *
 * Contexto (ver docs/features.md, sección slang):
 *  El registro va en la traducción: casual (sin nota), (malsonante), (vulgar).
 *  Principio: (malsonante) marca palabras que SON groseras en sí (crap, damn),
 *  no palabras limpias que DESCRIBEN algo grosero o desagradable. Estas 6
 *  describían algo (o eran ya el eufemismo suave) pero la palabra no es grosera:
 *   - snog: besarse con lengua; palabra totalmente normal.
 *   - take the mick: ES el eufemismo de "take the piss". Marcar de malsonante la
 *     versión suave es justo al revés.
 *   - gobby (bocazas), rank (asqueroso), lairy (chulesco): describen, no insultan.
 *   - wasted (muy borracho): palabra limpia (a diferencia de shit-faced).
 *  Se dejan a propósito crap (expletivo suave real), suck y slag off (crudas por
 *  origen).
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** [palabra, categoría, translation nueva] — se le quita el " (malsonante)" */
const FIXES = [
  ['snog', 'british_slang', 'morrearse'],
  ['take the mick', 'british_slang', 'vacilar, cachondearse; o pasarse'],
  ['gobby', 'british_slang', 'bocazas'],
  ['rank', 'british_slang', 'asqueroso'],
  ['lairy', 'british_slang', 'chulesco, alborotador'],
  ['wasted', 'american_slang', 'muy borracho'],
];

async function main() {
  console.log(`\n${APPLY ? '🔧 APLICANDO' : '🔍 DRY-RUN'}\n`);
  let changed = 0;
  for (const [word, category, translation] of FIXES) {
    const { data: rows, error } = await supabase
      .from('vocabulary')
      .select('id, word, translation')
      .eq('word', word)
      .eq('category', category);
    if (error) { console.error('select', word, error); process.exit(1); }
    if (!rows || rows.length !== 1) {
      console.error(`✗ ${word} [${category}]: esperaba 1 fila, encontré ${rows?.length ?? 0}`);
      process.exit(1);
    }
    const row = rows[0];
    if (row.translation === translation) { console.log(`= ${word}: ya aplicado`); continue; }

    console.log(`• ${word} [${category}]`);
    console.log(`    antes: ${JSON.stringify(row.translation)}`);
    console.log(`    ahora: ${JSON.stringify(translation)}`);
    changed++;

    if (APPLY) {
      const { error: upErr } = await supabase.from('vocabulary').update({ translation }).eq('id', row.id);
      if (upErr) { console.error('update', word, upErr); process.exit(1); }
    }
  }

  console.log(`\n${changed} entradas ${APPLY ? 'actualizadas' : 'a actualizar'}.`);
  if (!APPLY) console.log('ℹ️  dry-run. Añade --apply.\n');
  else console.log('▶ Ejecuta ahora: npm run backup:supabase && npm run validate:content\n');
}
main();
