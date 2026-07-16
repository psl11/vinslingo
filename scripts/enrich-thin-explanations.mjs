#!/usr/bin/env node
/**
 * Enriquece en Supabase las explicaciones "de etiqueta" de phrasal verbs: las que
 * tras quitar los ejemplos incrustados quedaban en un fragmento sin contenido
 * ("Formal.", "Se usa para aumentos.") o directamente rotas.
 * Idempotente: re-ejecutarlo no cambia nada si ya está aplicado.
 *
 * Uso:  node scripts/enrich-thin-explanations.mjs [--apply]
 *
 * Contexto (ver docs/content-qa.md):
 *  - carry on ("Similar a .") y move out ("… Opuesto"): ROTAS. Remitían a otro
 *    phrasal entre comillas (Similar a "go on" / Opuesto: "move in") y la
 *    limpieza de ejemplos se llevaba la referencia, dejando el conector colgando.
 *    Misma familia que el bug del "Ej". El validador ya caza este patrón.
 *  - bring about / call for: la explicación entera era "Formal.".
 *  - El resto: etiquetas de una línea que no enseñaban nada que la cabecera no
 *    dijera ya ("Se usa para descensos." bajo "BAJAR / REDUCIRSE").
 *
 * Regla al redactar (ver docs/features.md, mini-gramática):
 *  - SIN comillas: los ejemplos viven en example_sentence, y todo lo entrecomillado
 *    lo elimina stripInlineExamples() al maquetar la ficha.
 *  - Cada explicación se queda DENTRO de la acepción actual. Añadir acepciones
 *    volvería polisémica la entrada y obligaría a anular formal_synonym /
 *    separability, que aquí están pobladas y son correctas.
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** palabra (todas category='phave') → nueva translation */
const ENRICHED = {
  // --- rotas ---
  'carry on':
    'SEGUIR / CONTINUAR — Continuar con algo que ya habías empezado, sin pararte. Equivale a go on, y es especialmente frecuente en inglés británico.',
  'move out':
    'IRSE (de una vivienda) / MUDARSE FUERA — Dejar la casa en la que vivías, para independizarte o para cambiar de sitio. Lo contrario es move in, instalarse en una vivienda nueva.',

  // --- explicación entera = "Formal." ---
  'bring about':
    'CAUSAR / PROVOCAR — Hacer que algo ocurra, casi siempre un cambio o una consecuencia de calado. Es de registro formal: en el día a día se dice cause o make something happen.',
  'call for':
    'REQUERIR / PEDIR — Que una situación exija algo, o que alguien reclame algo en público. De registro formal, muy típico de la prensa. Nunca se separa: siempre call for something.',

  // --- etiquetas que no añadían nada a la cabecera ---
  'look at':
    'MIRAR — Dirigir la vista a algo a propósito, a diferencia de see, que es percibir sin buscarlo. Ojo: en inglés se mira AT algo, look at the photo, nunca look the photo.',
  'go up':
    'SUBIR (precios/temperatura) — Aumentar una cantidad o un nivel: precios, temperatura, sueldos, el volumen. Lo contrario es go down.',
  'go down':
    'BAJAR (precios/nivel) / REDUCIRSE — Disminuir una cantidad o un nivel: precios, fiebre, volumen. Lo contrario es go up.',
  'sit down':
    'SENTARSE — Pasar de estar de pie a estar sentado. Se usa sobre todo en imperativo: como invitación cortés acompañado de please, o como orden seca sin él.',
  'come in':
    'ENTRAR — Pasar adentro desde fuera, contado desde dentro: por eso come y no go. Muy habitual en imperativo para invitar a alguien a pasar.',
  'go out':
    'SALIR (de fiesta/cita) — Salir de casa para socializar: cenar fuera, tomar algo, ir de fiesta. En la forma go out with alguien, además, es salir juntos en plan pareja.',
};

async function main() {
  console.log(`\n${APPLY ? '🔧 APLICANDO' : '🔍 DRY-RUN'}\n`);
  let changed = 0;
  for (const [word, translation] of Object.entries(ENRICHED)) {
    const { data: rows, error } = await supabase
      .from('vocabulary')
      .select('id, word, translation')
      .eq('word', word)
      .eq('category', 'phave');
    if (error) { console.error('select', word, error); process.exit(1); }
    if (!rows || rows.length !== 1) {
      console.error(`✗ ${word}: esperaba 1 fila, encontré ${rows?.length ?? 0}`);
      process.exit(1);
    }
    const row = rows[0];
    if (row.translation === translation) { console.log(`= ${word}: ya aplicado`); continue; }

    console.log(`• ${word}`);
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
