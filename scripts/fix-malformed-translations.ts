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
