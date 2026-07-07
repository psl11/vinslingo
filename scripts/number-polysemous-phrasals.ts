#!/usr/bin/env npx tsx
/**
 * Convierte al formato numerado ("1) ... 2) ...") las entradas de phrasal verbs
 * que eran genuinamente polisémicas pero venían con las acepciones sin separar
 * (título "A / B" + ejemplos sueltos). Así la ficha las maqueta como diccionario
 * (cada acepción en su bloque con su ejemplo), igual que las ya numeradas.
 *
 * Solo se incluyen entradas con acepciones REALMENTE distintas (no sinónimos
 * como TUMBARSE/ECHARSE o FALLECER/MORIR, que se dejan como están). El contenido
 * se REESTRUCTURA a partir del ya existente; no se inventan ejemplos (en `take on`
 * y `get back` solo se completa la traducción del 2º ejemplo, que ya estaba en la
 * frase inglesa pero sin su "= español").
 *
 * Uso:
 *   npx tsx scripts/number-polysemous-phrasals.ts           # dry-run
 *   npx tsx scripts/number-polysemous-phrasals.ts --apply    # aplica
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en el entorno (cargar .env).
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// word (categoría phave) -> nueva traducción numerada
const CONVERSIONS: Record<string, string> = {
  'stand up':
    'LEVANTARSE / DEFENDER — 1) Ponerse de pie: "Stand up!" = ¡levántate! 2) Defender (con "for"): "Stand up for yourself" = defiéndete.',
  'break down':
    'AVERIARSE / DERRUMBARSE — 1) Estropearse una máquina o vehículo: "My car broke down" = mi coche se averió. 2) Derrumbarse emocionalmente: "She broke down crying" = se derrumbó llorando.',
  'come out':
    'SALIR / RESULTAR — 1) Publicarse o estrenarse: "The book comes out tomorrow" = el libro sale mañana. 2) Resultar de cierta manera: "It came out well" = salió bien.',
  'open up':
    'ABRIR / ABRIRSE (emocionalmente) — 1) Surgir o abrirse algo: "New opportunities are opening up" = se abren nuevas oportunidades. 2) Sincerarse con alguien: "He opened up to me" = se sinceró conmigo.',
  'pick up':
    'RECOGER / APRENDER — 1) Recoger a alguien o algo: "I\'ll pick you up" = te recojo. 2) Aprender algo rápido: "I picked up Spanish quickly" = aprendí español rápido.',
  'look up':
    'BUSCAR / MEJORAR — 1) Buscar información: "Look it up online" = búscalo en internet. 2) Mejorar una situación: "Things are looking up" = las cosas mejoran.',
  'hold up':
    'RETRASAR / ATRACAR — 1) Retrasar o demorar: "Traffic held us up" = el tráfico nos retrasó. 2) Atracar a mano armada: "They held up the bank" = atracaron el banco.',
  'think of':
    'OPINAR / PENSAR EN — 1) Opinar sobre algo: "What do you think of this?" = ¿qué opinas de esto? 2) Considerar o plantearse: "I\'m thinking of leaving" = estoy pensando en irme.',
  'give up':
    'RENDIRSE / DEJAR DE — 1) Rendirse o abandonar: "Don\'t give up!" = ¡no te rindas! 2) Dejar de hacer algo: "I gave up smoking" = dejé de fumar.',
  'bring up':
    'CRIAR / SACAR (un tema) — 1) Criar o educar: "I was brought up in Spain" = me criaron en España. 2) Mencionar o sacar un tema: "Don\'t bring that up" = no saques ese tema.',
  'take on':
    'ASUMIR / CONTRATAR — 1) Asumir una tarea o responsabilidad: "She took on more work" = asumió más trabajo. 2) Contratar personal: "We\'re taking on new staff" = estamos contratando personal.',
  'get back':
    'VOLVER / RECUPERAR — 1) Volver o regresar: "When did you get back?" = ¿cuándo volviste? 2) Recuperar algo: "I need to get my money back" = necesito recuperar mi dinero.',
};

async function main() {
  console.log(`\n${APPLY ? '🔧 APLICANDO' : '🔍 DRY-RUN'} — ${Object.keys(CONVERSIONS).length} entradas\n`);

  const words = Object.keys(CONVERSIONS);
  const { data: rows, error } = await supabase
    .from('vocabulary')
    .select('id, word, translation, category')
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
    const next = CONVERSIONS[word];
    if (row.translation === next) {
      console.log(`= sin cambios: ${word}`);
      continue;
    }
    console.log(`\n• ${word}`);
    console.log(`  ANTES: ${row.translation}`);
    console.log(`  AHORA: ${next}`);

    if (APPLY) {
      const { error: upErr } = await supabase
        .from('vocabulary')
        .update({ translation: next })
        .eq('id', row.id);
      if (upErr) {
        console.error(`  ❌ error al actualizar ${word}:`, upErr);
        continue;
      }
      updated++;
    }
  }

  console.log(`\n${APPLY ? `✅ ${updated} entradas actualizadas` : 'ℹ️  dry-run: no se escribió nada. Añade --apply para aplicar.'}\n`);
}

main();
