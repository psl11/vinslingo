#!/usr/bin/env node
/**
 * Pone ejemplos a las 7 trampas UK↔US de `confusing_pair` que no tenían ninguno.
 * Idempotente: re-ejecutarlo no cambia nada si ya está aplicado.
 *
 * Uso:  node scripts/fix-confusing-pair-examples.mjs [--apply]
 *
 * Contexto (ver docs/content-qa.md):
 *  Las otras 50 confusing_pair sí traen ejemplos, y la ficha los muestra en este
 *  formato (FlashCard sólo los oculta en las entradas multi-acepción). Estas 7
 *  salían con la comparación a secas. Convención de la categoría: ej1 = primer
 *  sentido, ej2 = segundo → aquí ej1 = uso británico, ej2 = uso americano.
 *
 *  "fag" se queda A PROPÓSITO sin ejemplo americano: su sentido en EE.UU. es un
 *  insulto homófobo, y la ficha existe justo para avisar de que no se use. Un
 *  ejemplo de uso enseñaría a usarlo. El ejemplo británico (cigarrillo) sí va.
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** word → { ej1 = UK, ej2 = US } */
const EXAMPLES = {
  'pissed (UK vs US)': {
    example_sentence: 'He got completely pissed at the pub last night.',
    example_translation: 'Anoche se emborrachó del todo en el pub.',
    example_sentence_2: 'She was so pissed when they cancelled the show.',
    example_translation_2: 'Se cabreó muchísimo cuando cancelaron el concierto.',
  },
  'piss off (UK vs US)': {
    example_sentence: 'Piss off and leave me alone!',
    example_translation: '¡Lárgate y déjame en paz!',
    example_sentence_2: 'It really pisses me off when people are late.',
    example_translation_2: 'Me cabrea mucho que la gente llegue tarde.',
  },
  'fanny (UK vs US)': {
    example_sentence: 'Never ask for a fanny pack in Britain: there it is called a bum bag.',
    example_translation: 'No pidas nunca un fanny pack en Gran Bretaña: allí se llama bum bag.',
    example_sentence_2: 'He slipped and landed on his fanny.',
    example_translation_2: 'Resbaló y se cayó de culo.',
  },
  'fag (UK vs US)': {
    example_sentence: 'He stepped outside for a fag.',
    example_translation: 'Salió fuera a fumarse un cigarrillo.',
    // Sin ejemplo americano a propósito: ver cabecera.
  },
  'bum (UK vs US)': {
    example_sentence: 'I fell over and hurt my bum.',
    example_translation: 'Me caí y me hice daño en el culo.',
    example_sentence_2: 'A bum was asking for change outside the station.',
    example_translation_2: 'Un vagabundo pedía monedas a la salida de la estación.',
  },
  'pants (UK vs US)': {
    example_sentence: 'The film was absolute pants.',
    example_translation: 'La película fue una auténtica basura.',
    example_sentence_2: 'He bought a new pair of pants for the interview.',
    example_translation_2: 'Se compró unos pantalones nuevos para la entrevista.',
  },
  'rubber (UK vs US)': {
    example_sentence: 'Can I borrow your rubber? I need to erase this.',
    example_translation: '¿Me dejas la goma? Necesito borrar esto.',
    example_sentence_2: 'In the US, ask for an eraser instead: a rubber is a condom.',
    example_translation_2: 'En EE.UU., pide un eraser: un rubber es un condón.',
  },
};

async function main() {
  console.log(`\n${APPLY ? '🔧 APLICANDO' : '🔍 DRY-RUN'}\n`);
  let changed = 0;
  for (const [word, patch] of Object.entries(EXAMPLES)) {
    const { data: rows, error } = await supabase
      .from('vocabulary')
      .select('id, word, example_sentence, example_translation, example_sentence_2, example_translation_2')
      .eq('word', word)
      .eq('category', 'confusing_pair');
    if (error) { console.error('select', word, error); process.exit(1); }
    if (!rows || rows.length !== 1) {
      console.error(`✗ ${word}: esperaba 1 fila, encontré ${rows?.length ?? 0}`);
      process.exit(1);
    }
    const row = rows[0];
    if (Object.entries(patch).every(([k, v]) => row[k] === v)) { console.log(`= ${word}: ya aplicado`); continue; }

    console.log(`• ${word}`);
    console.log(`    UK: ${patch.example_sentence}`);
    console.log(`    US: ${patch.example_sentence_2 ?? '— (a propósito)'}`);
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
