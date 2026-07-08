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
  // Segunda tanda (detectadas al revisar el modo escribir).
  'take up':
    'EMPEZAR / OCUPAR — 1) Empezar un hobby o actividad: "I took up tennis" = empecé a jugar tenis. 2) Ocupar espacio o tiempo: "It takes up too much time" = ocupa demasiado tiempo.',
  'put in':
    'INVERTIR / METER — 1) Invertir tiempo o esfuerzo: "She put in a lot of work" = invirtió mucho trabajo. 2) Meter o introducir algo: "Put your card in the machine" = mete la tarjeta en el cajero.',
  'get in':
    'SUBIRSE / LLEGAR — 1) Subirse a un vehículo: "Get in the car!" = ¡súbete al coche! 2) Llegar a un sitio: "What time did you get in?" = ¿a qué hora llegaste?',
  'work out':
    'HACER EJERCICIO / RESOLVER / FUNCIONAR — 1) Hacer ejercicio: "I work out daily" = hago ejercicio a diario. 2) Resolver o calcular: "I need to work out this problem" = necesito resolver este problema. 3) Salir bien o funcionar: "It\'ll work out" = saldrá bien.',
  // take off: la 3ª acepción (TRIUNFAR) no tenía ejemplo en los datos; se añade
  // uno estándar ("Her career took off") para que cada acepción tenga el suyo.
  'take off':
    'DESPEGAR / QUITARSE / TRIUNFAR — 1) Despegar un avión: "The plane took off" = el avión despegó. 2) Quitarse ropa: "Take off your shoes" = quítate los zapatos. 3) Triunfar o despegar (figurado): "Her career took off" = su carrera despegó.',
  // make up venía en prosa ("Tres usos: ..."). La 3ª acepción (MAQUILLARSE) no
  // tenía ejemplo; se añade uno estándar ("She makes up before going out").
  'make up':
    'INVENTAR / RECONCILIARSE / MAQUILLARSE — 1) Inventar algo: "Did you make up that story?" = ¿te inventaste esa historia? 2) Hacer las paces: "They kissed and made up" = hicieron las paces. 3) Maquillarse: "She makes up before going out" = se maquilla antes de salir.',
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
