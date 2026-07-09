#!/usr/bin/env npx tsx
/**
 * Rellena, para cada phrasal verb (category = 'phave'), dos columnas nuevas:
 *
 *  - formal_synonym: sinónimo FORMAL de UNA sola palabra (put off ≈ postpone).
 *    Se prima el cognado latino cuando existe (posponer, continuar, establecer…)
 *    porque el hispanohablante lo reconoce al instante, y de paso enseña el
 *    registro: el phrasal es coloquial, el latino es formal. Donde no hay un
 *    equivalente de una palabra limpio y correcto, se deja null (mejor vacío
 *    que forzar un sinónimo dudoso).
 *
 *  - separability: 'separable' | 'inseparable' | 'intransitive', por el sentido
 *    DOMINANTE del phrasal (muchos son polisémicos con separabilidad distinta
 *    según la acepción; se clasifica el uso más común/enseñable):
 *      · separable    → transitivo, el objeto puede ir en medio (turn it off)
 *      · inseparable  → verbo preposicional, el objeto va siempre después
 *                       (look after him, deal with it)
 *      · intransitive → sin objeto (break down, grow up)
 *
 * Uso:
 *   npx tsx scripts/set-phave-grammar.ts            # dry-run (lista todo)
 *   npx tsx scripts/set-phave-grammar.ts --apply    # aplica
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY (cargar .env). Tras aplicar: correr
 * `npm run backup:supabase`, revisar el diff y commitear (ver CLAUDE.md).
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Sep = 'separable' | 'inseparable' | 'intransitive';
interface Grammar {
  formal: string | null; // sinónimo formal de una palabra, o null
  sep: Sep;
}

// word (phave) -> { sinónimo formal, separabilidad del sentido dominante }
const GRAMMAR: Record<string, Grammar> = {
  'go on': { formal: 'continue', sep: 'intransitive' },
  'carry out': { formal: 'execute', sep: 'separable' },
  'set up': { formal: 'establish', sep: 'separable' },
  'pick up': { formal: 'collect', sep: 'separable' },
  'go back': { formal: 'return', sep: 'intransitive' },
  'come back': { formal: 'return', sep: 'intransitive' },
  'go out': { formal: 'exit', sep: 'intransitive' },
  'point out': { formal: 'indicate', sep: 'separable' },
  'find out': { formal: 'ascertain', sep: 'separable' },
  'come up': { formal: 'arise', sep: 'intransitive' },
  'make up': { formal: 'invent', sep: 'separable' },
  'take over': { formal: 'assume', sep: 'separable' },
  'come out': { formal: 'emerge', sep: 'intransitive' },
  'come in': { formal: 'enter', sep: 'intransitive' },
  'go down': { formal: 'decrease', sep: 'intransitive' },
  'work out': { formal: 'resolve', sep: 'separable' },
  'set out': { formal: 'commence', sep: 'intransitive' },
  'take up': { formal: 'occupy', sep: 'separable' },
  'get back': { formal: 'return', sep: 'intransitive' },
  'sit down': { formal: null, sep: 'intransitive' },
  'turn out': { formal: null, sep: 'intransitive' },
  'take on': { formal: 'assume', sep: 'separable' },
  'give up': { formal: 'abandon', sep: 'separable' },
  'get out': { formal: 'exit', sep: 'intransitive' },
  'go up': { formal: 'increase', sep: 'intransitive' },
  'carry on': { formal: 'continue', sep: 'intransitive' },
  'let out': { formal: 'release', sep: 'separable' },
  'point to': { formal: 'indicate', sep: 'inseparable' },
  'get in': { formal: 'enter', sep: 'intransitive' },
  'come on': { formal: null, sep: 'intransitive' },
  'look at': { formal: 'observe', sep: 'inseparable' },
  'look for': { formal: 'seek', sep: 'inseparable' },
  'look up': { formal: 'consult', sep: 'separable' },
  'grow up': { formal: 'mature', sep: 'intransitive' },
  'break down': { formal: 'malfunction', sep: 'intransitive' },
  'move on': { formal: 'proceed', sep: 'intransitive' },
  'hold up': { formal: 'delay', sep: 'separable' },
  'bring in': { formal: 'introduce', sep: 'separable' },
  'look back': { formal: 'reminisce', sep: 'intransitive' },
  'bring about': { formal: 'cause', sep: 'separable' },
  'take off': { formal: 'remove', sep: 'separable' },
  'come down': { formal: 'descend', sep: 'intransitive' },
  'put in': { formal: 'invest', sep: 'separable' },
  'come from': { formal: 'originate', sep: 'inseparable' },
  'bring up': { formal: 'mention', sep: 'separable' },
  'base on': { formal: null, sep: 'inseparable' },
  'open up': { formal: null, sep: 'intransitive' },
  'think of': { formal: 'consider', sep: 'inseparable' },
  'stand up': { formal: 'rise', sep: 'intransitive' },
  'call for': { formal: 'require', sep: 'inseparable' },
  'keep on': { formal: 'persist', sep: 'intransitive' },
  'look into': { formal: 'investigate', sep: 'inseparable' },
  'turn into': { formal: 'become', sep: 'inseparable' },
  'get up': { formal: 'arise', sep: 'intransitive' },
  'pull out': { formal: 'withdraw', sep: 'separable' },
  'end up': { formal: null, sep: 'intransitive' },
  'put on': { formal: 'don', sep: 'separable' },
  'bring back': { formal: 'restore', sep: 'separable' },
  'deal with': { formal: 'address', sep: 'inseparable' },
  'move in': { formal: null, sep: 'intransitive' },
  'take out': { formal: 'extract', sep: 'separable' },
  'put down': { formal: null, sep: 'separable' },
  'break up': { formal: 'separate', sep: 'intransitive' },
  'come over': { formal: 'visit', sep: 'intransitive' },
  'build up': { formal: 'accumulate', sep: 'separable' },
  'cut off': { formal: 'sever', sep: 'separable' },
  'go through': { formal: 'endure', sep: 'inseparable' },
  'fill in': { formal: 'complete', sep: 'separable' },
  'pass on': { formal: 'transmit', sep: 'separable' },
  'bring out': { formal: 'release', sep: 'separable' },
  'get on': { formal: null, sep: 'intransitive' },
  'live on': { formal: 'subsist', sep: 'inseparable' },
  'close down': { formal: null, sep: 'intransitive' },
  'move out': { formal: null, sep: 'intransitive' },
  'take back': { formal: 'retract', sep: 'separable' },
  'hand over': { formal: 'surrender', sep: 'separable' },
  'turn up': { formal: 'appear', sep: 'intransitive' },
  'get off': { formal: 'disembark', sep: 'intransitive' },
  'come along': { formal: null, sep: 'intransitive' },
  'throw out': { formal: 'discard', sep: 'separable' },
  'look down': { formal: null, sep: 'intransitive' },
  'run out': { formal: 'expire', sep: 'intransitive' },
  'pull up': { formal: null, sep: 'intransitive' },
  'get through': { formal: 'endure', sep: 'inseparable' },
  'lie down': { formal: 'recline', sep: 'intransitive' },
  'turn down': { formal: 'decline', sep: 'separable' },
  'make out': { formal: 'discern', sep: 'separable' },
  'fall down': { formal: 'collapse', sep: 'intransitive' },
  'send out': { formal: 'distribute', sep: 'separable' },
  'move up': { formal: 'ascend', sep: 'intransitive' },
  'shut down': { formal: 'deactivate', sep: 'separable' },
  'go off': { formal: null, sep: 'intransitive' },
  'start off': { formal: 'commence', sep: 'intransitive' },
  'get away': { formal: 'escape', sep: 'intransitive' },
  'break out': { formal: 'erupt', sep: 'intransitive' },
  'keep up': { formal: 'maintain', sep: 'separable' },
  'give back': { formal: 'return', sep: 'separable' },
  'wake up': { formal: 'awaken', sep: 'separable' },
  'slow down': { formal: 'decelerate', sep: 'intransitive' },
  'write down': { formal: 'record', sep: 'separable' },
  'put together': { formal: 'assemble', sep: 'separable' },
  'split up': { formal: 'separate', sep: 'intransitive' },
  'speak out': { formal: null, sep: 'intransitive' },
  'show up': { formal: 'appear', sep: 'intransitive' },
  'wipe out': { formal: 'eradicate', sep: 'separable' },
  'settle down': { formal: null, sep: 'intransitive' },
  'pay off': { formal: 'settle', sep: 'separable' },
  'clean up': { formal: null, sep: 'separable' },
  'run away': { formal: 'flee', sep: 'intransitive' },
  'dress up': { formal: null, sep: 'intransitive' },
  'cut down': { formal: 'reduce', sep: 'separable' },
  'hang out': { formal: null, sep: 'intransitive' },
  'figure out': { formal: 'determine', sep: 'separable' },
  'calm down': { formal: 'pacify', sep: 'separable' },
  'back up': { formal: 'support', sep: 'separable' },
  'give in': { formal: 'yield', sep: 'intransitive' },
  'check out': { formal: 'examine', sep: 'separable' },
  'drop off': { formal: 'deliver', sep: 'separable' },
  'stand out': { formal: null, sep: 'intransitive' },
  'try on': { formal: null, sep: 'separable' },
  'put off': { formal: 'postpone', sep: 'separable' },
  'look after': { formal: 'tend', sep: 'inseparable' },
  'look out': { formal: null, sep: 'intransitive' },
  'hurry up': { formal: 'hasten', sep: 'intransitive' },
  'catch up': { formal: null, sep: 'intransitive' },
  'mix up': { formal: 'confuse', sep: 'separable' },
  'sign up': { formal: 'register', sep: 'intransitive' },
  'warm up': { formal: null, sep: 'separable' },
  'pick out': { formal: 'select', sep: 'separable' },
  'come apart': { formal: 'disintegrate', sep: 'intransitive' },
  'throw away': { formal: 'discard', sep: 'separable' },
  'take apart': { formal: 'dismantle', sep: 'separable' },
  'put away': { formal: 'store', sep: 'separable' },
  'hand in': { formal: 'submit', sep: 'separable' },
  'kick off': { formal: 'commence', sep: 'intransitive' },
  'run into': { formal: 'encounter', sep: 'inseparable' },
  'look forward to': { formal: 'anticipate', sep: 'inseparable' },
  'get along': { formal: null, sep: 'intransitive' },
  'get over': { formal: 'overcome', sep: 'inseparable' },
  'keep away': { formal: null, sep: 'intransitive' },
  'pass away': { formal: null, sep: 'intransitive' },
  'blow up': { formal: 'explode', sep: 'separable' },
  'pull off': { formal: 'achieve', sep: 'separable' },
  'turn off': { formal: 'deactivate', sep: 'separable' },
  'turn on': { formal: 'activate', sep: 'separable' },
  'log in': { formal: null, sep: 'intransitive' },
  'log out': { formal: null, sep: 'intransitive' },
  'hang up': { formal: null, sep: 'separable' },
  'sum up': { formal: 'summarize', sep: 'separable' },
  'wrap up': { formal: 'conclude', sep: 'separable' },
};

async function main() {
  const words = Object.keys(GRAMMAR);
  console.log(
    `\n${APPLY ? '🔧 APLICANDO' : '🔍 DRY-RUN'} — ${words.length} phrasal verbs\n`
  );

  // Traer todas las filas phave para avisar de discrepancias (palabras del mapa
  // que no existan, o phave en BD sin entrada en el mapa).
  const { data: rows, error } = await supabase
    .from('vocabulary')
    .select('id, word')
    .eq('category', 'phave');
  if (error) {
    console.error('Error leyendo vocabulary:', error);
    process.exit(1);
  }
  const dbWords = new Set((rows || []).map((r) => r.word));

  const missingInDb = words.filter((w) => !dbWords.has(w));
  const missingInMap = [...dbWords].filter((w) => !GRAMMAR[w]);
  if (missingInDb.length) {
    console.warn('⚠️  en el mapa pero NO en la BD:', missingInDb.join(', '));
  }
  if (missingInMap.length) {
    console.warn('⚠️  en la BD pero SIN entrada en el mapa:', missingInMap.join(', '));
  }

  let updated = 0;
  for (const word of words) {
    const g = GRAMMAR[word];
    if (!dbWords.has(word)) continue;
    const formalLabel = g.formal ? `≈ ${g.formal} (formal)` : '(sin sinónimo)';
    console.log(`• ${word.padEnd(16)} ${g.sep.padEnd(12)} ${formalLabel}`);
    if (APPLY) {
      // Actualiza TODAS las filas con esa palabra (una lema puede tener varias
      // filas por polisemia); el rasgo gramatical aplica a la lema entera.
      const { error: upErr, count } = await supabase
        .from('vocabulary')
        .update(
          { formal_synonym: g.formal, separability: g.sep },
          { count: 'exact' }
        )
        .eq('category', 'phave')
        .eq('word', word);
      if (upErr) {
        console.error(`  ❌ error al actualizar ${word}:`, upErr);
        continue;
      }
      updated += count ?? 1;
    }
  }

  const sepCount = (s: Sep) => words.filter((w) => GRAMMAR[w].sep === s).length;
  const withFormal = words.filter((w) => GRAMMAR[w].formal).length;
  console.log(
    `\nResumen: ${sepCount('separable')} separables, ` +
      `${sepCount('inseparable')} inseparables, ` +
      `${sepCount('intransitive')} intransitivos · ` +
      `${withFormal}/${words.length} con sinónimo formal`
  );
  console.log(
    `\n${APPLY ? `✅ ${updated} filas actualizadas` : 'ℹ️  dry-run. Añade --apply.'}\n`
  );
}

main();
