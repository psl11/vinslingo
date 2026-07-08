#!/usr/bin/env npx tsx
/**
 * Corrige traducciones numeradas mal formadas que detecta
 * scripts/validate-translations.ts (p.ej. una acepción que empieza por comillas
 * y deja la descripción vacía). Reestructura al patrón esperado
 * "N) descripción: \"inglés\" = español".
 *
 * Uso:
 *   npx tsx scripts/fix-malformed-translations.ts           # dry-run
 *   npx tsx scripts/fix-malformed-translations.ts --apply    # aplica
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY (cargar .env).
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// word (phave) -> traducción corregida
const FIXES: Record<string, string> = {
  // La 3ª acepción empezaba con "get away with something" = ... (sin descripción
  // antes de las comillas), lo que dejaba la acepción sin descripción.
  'get away':
    'ESCAPAR / DESCONECTAR / SALIRSE CON LA SUYA — 1) Lograr huir: "The thief got away" = el ladrón escapó. 2) Desconectar unos días: "We need to get away" = necesitamos escaparnos. 3) Salirse con la suya (get away with): "He got away with it" = se salió con la suya.',
  // Estas 3 ya estaban numeradas, pero el título llevaba el phrasal en inglés
  // entre paréntesis ("(look down on)"...), que se colaba en el enunciado del
  // modo escribir. Se quita del título (los ejemplos siguen igual).
  'look down':
    'MIRAR HACIA ABAJO / DESPRECIAR — 1) Literal: "Don\'t look down, we\'re very high up!" = ¡no mires abajo, estamos muy altos! 2) Con "on", menospreciar: "Don\'t look down on others" = no mires a los demás por encima del hombro.',
  'cut down':
    'REDUCIR / TALAR — 1) Consumir o hacer menos de algo: "cut down on sugar" = reducir el azúcar. "cut down on spending" = recortar gastos. 2) Talar un árbol: "They cut down the old oak" = talaron el roble viejo.',
  'run out':
    'AGOTARSE / QUEDARSE SIN / CADUCAR — 1) Acabarse algo: "Time is running out" = se acaba el tiempo. 2) Con "of", quedarse sin algo: "We\'ve run out of milk" = nos hemos quedado sin leche. 3) Vencer un plazo: "My contract runs out in May" = mi contrato vence en mayo.',
};

async function main() {
  console.log(`\n${APPLY ? '🔧 APLICANDO' : '🔍 DRY-RUN'} — ${Object.keys(FIXES).length} correcciones\n`);
  const words = Object.keys(FIXES);
  const { data: rows, error } = await supabase
    .from('vocabulary')
    .select('id, word, translation')
    .eq('category', 'phave')
    .in('word', words);
  if (error) {
    console.error('Error leyendo vocabulary:', error);
    process.exit(1);
  }
  const byWord = new Map((rows || []).map((r) => [r.word, r]));
  let updated = 0;
  for (const word of words) {
    const row = byWord.get(word);
    if (!row) {
      console.warn(`⚠️  no encontrada en phave: "${word}"`);
      continue;
    }
    const next = FIXES[word];
    if (row.translation === next) {
      console.log(`= sin cambios: ${word}`);
      continue;
    }
    console.log(`\n• ${word}`);
    console.log(`  ANTES: ${row.translation}`);
    console.log(`  AHORA: ${next}`);
    if (APPLY) {
      const { error: upErr } = await supabase.from('vocabulary').update({ translation: next }).eq('id', row.id);
      if (upErr) {
        console.error(`  ❌ error al actualizar ${word}:`, upErr);
        continue;
      }
      updated++;
    }
  }
  console.log(`\n${APPLY ? `✅ ${updated} corregidas` : 'ℹ️  dry-run. Añade --apply.'}\n`);
}

main();
