#!/usr/bin/env node
/**
 * Arregla en Supabase los problemas de contenido que caza `npm run validate:content`.
 * Idempotente: re-ejecutarlo no cambia nada si ya está aplicado.
 *
 * Uso:  node scripts/fix-content-issues.mjs [--apply]
 *
 * Contexto (ver docs/content-qa.md):
 *  - turn on / wipe out: eran POLISÉMICOS con un "1)" huérfano (sin "2)"), así que
 *    parseaban como monosémicos ('term') y la ficha les mostraba un sinónimo
 *    formal y una separabilidad únicos — engañoso, porque dependen de la
 *    acepción. Se convierten a acepciones numeradas de verdad y se anula su
 *    mini-gramática (misma regla que los otros 89 polisémicos).
 *  - kick off / hang out: la explicación llevaba notas entre paréntesis con
 *    ejemplos dentro; al quitar los ejemplos incrustados (los ejemplos viven en
 *    example_sentence) quedaba el andamiaje suelto. Se reescriben como prosa
 *    limpia, sin comillas.
 *  - tight (slang): venía como "(1) … (2) …", que no parsea como acepciones. Se
 *    deja como glosa simple (también corregido en seed-slang.ts).
 *  - honor: el ejemplo usaba la grafía británica "honour" en una ficha US.
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** [categoría, palabra, campos a actualizar] */
const FIXES = [
  [
    'phave', 'turn on',
    {
      translation:
        'ENCENDER / VOLVERSE EN CONTRA / ATRAER — 1) Poner en marcha un aparato o abrir un grifo: "Turn on the TV" = enciende la tele. "Turn on the tap" = abre el grifo. 2) Volverse en contra de alguien (turn on someone): "The dog turned on its owner" = el perro se volvió contra su dueño. 3) Atraer o excitar (turn someone on): "That song turns me on" = esa canción me pone. (Opuesto: turn off.)',
      formal_synonym: null,
      separability: null,
    },
  ],
  [
    'phave', 'wipe out',
    {
      translation:
        'ANIQUILAR / ARRASAR / AGOTAR — 1) Destruir por completo: "The tsunami wiped out entire villages" = el tsunami arrasó pueblos enteros. 2) Dejar agotado, casi siempre en pasiva (be wiped out): "I\'m wiped out after the marathon" = estoy hecho polvo tras el maratón. 3) Darse un batacazo al surfear o esquiar: "He wiped out on the first wave" = se dio un batacazo en la primera ola.',
      formal_synonym: null,
      separability: null,
    },
  ],
  [
    'phave', 'kick off',
    {
      translation:
        'EMPEZAR / DAR EL PISTOLETAZO DE SALIDA — Arrancar un evento o una actividad. Viene del fútbol, del saque inicial. En inglés británico coloquial, kick off también significa montar un pollo.',
    },
  ],
  [
    'phave', 'hang out',
    {
      translation:
        'PASAR EL RATO / QUEDAR (con amigos) — Estar por ahí sin un plan concreto, sobre todo con amigos. En la forma hang out with significa juntarse con alguien.',
    },
  ],
  [
    'american_slang', 'tight',
    { translation: 'tacaño; o muy amigos; o genial (según contexto)' },
  ],
  [
    'ngsl', 'honor',
    { example_sentence: 'They fought bravely for the honor of their country.' },
  ],
];

async function main() {
  console.log(`\n${APPLY ? '🔧 APLICANDO' : '🔍 DRY-RUN'}\n`);
  let changed = 0;
  for (const [category, word, patch] of FIXES) {
    const { data: rows, error } = await supabase
      .from('vocabulary')
      .select('id, word, category, translation, formal_synonym, separability, example_sentence')
      .eq('word', word)
      .eq('category', category);
    if (error) { console.error('select', word, error); process.exit(1); }
    if (!rows || rows.length !== 1) {
      console.error(`✗ ${word} [${category}]: esperaba 1 fila, encontré ${rows?.length ?? 0}`);
      process.exit(1);
    }
    const row = rows[0];
    const isSame = Object.entries(patch).every(([k, v]) => row[k] === v);
    if (isSame) { console.log(`= ${word} [${category}]: ya aplicado`); continue; }

    console.log(`• ${word} [${category}]`);
    for (const [k, v] of Object.entries(patch)) {
      if (row[k] === v) continue;
      console.log(`    ${k}:`);
      console.log(`      antes: ${JSON.stringify(row[k])}`);
      console.log(`      ahora: ${JSON.stringify(v)}`);
    }
    changed++;

    if (APPLY) {
      const { error: upErr } = await supabase.from('vocabulary').update(patch).eq('id', row.id);
      if (upErr) { console.error('update', word, upErr); process.exit(1); }
    }
  }

  console.log(`\n${changed} entradas ${APPLY ? 'actualizadas' : 'a actualizar'}.`);
  if (!APPLY) console.log('ℹ️  dry-run. Añade --apply.\n');
  else console.log('▶ Ejecuta ahora: npm run backup:supabase && npm run validate:content\n');
}
main();
