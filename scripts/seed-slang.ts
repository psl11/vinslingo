#!/usr/bin/env npx tsx
/**
 * Siembra el contenido de SLANG curado (británico + americano) en la tabla
 * `vocabulary` de Supabase, más un puñado de trampas UK↔US como confusing_pair.
 *
 * Registro etiquetado en la traducción: casual (sin nota), "(malsonante)" y
 * "(vulgar)". Se excluyen insultos contra grupos protegidos. Nivel CEFR: B2.
 *
 * Idempotente: en --apply borra primero british_slang/american_slang y las
 * palabras trampa concretas de confusing_pair, y reinserta.
 *
 * Uso:
 *   npx tsx scripts/seed-slang.ts            # dry-run (lista)
 *   npx tsx scripts/seed-slang.ts --apply    # aplica
 * Requiere SUPABASE_SERVICE_ROLE_KEY (.env cargado). Tras aplicar:
 * npm run backup:supabase + revisar diff + commit.
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const APPLY = process.argv.includes('--apply');
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Reg = 'casual' | 'malsonante' | 'vulgar';
interface Slang {
  word: string;
  es: string;
  reg: Reg;
  ex: string;
  exEs: string;
}
const regNote: Record<Reg, string> = { casual: '', malsonante: ' (malsonante)', vulgar: ' (vulgar)' };

const BRITISH: Slang[] = [
  { word: 'knackered', es: 'agotado, hecho polvo', reg: 'casual', ex: "I'm absolutely knackered.", exEs: 'Estoy hecho polvo.' },
  { word: 'shattered', es: 'reventado (de cansado)', reg: 'casual', ex: "I'm shattered after work.", exEs: 'Estoy reventado después del trabajo.' },
  { word: 'gutted', es: 'hundido, muy decepcionado', reg: 'casual', ex: 'I was gutted when we lost.', exEs: 'Me quedé hundido cuando perdimos.' },
  { word: 'chuffed', es: 'encantado, muy contento', reg: 'casual', ex: "I'm well chuffed with this.", exEs: 'Estoy contentísimo con esto.' },
  { word: 'skint', es: 'sin blanca, pelado', reg: 'casual', ex: "I can't come, I'm skint.", exEs: 'No puedo ir, estoy pelado.' },
  { word: 'cheeky', es: 'descarado, pícaro (a veces con cariño)', reg: 'casual', ex: "That's a bit cheeky.", exEs: 'Eso es un poco descarado.' },
  { word: 'dodgy', es: 'sospechoso, chungo, poco fiable', reg: 'casual', ex: 'The deal looked dodgy.', exEs: 'El trato pintaba chungo.' },
  { word: 'gobsmacked', es: 'flipando, boquiabierto', reg: 'casual', ex: 'I was gobsmacked.', exEs: 'Me quedé flipando.' },
  { word: 'faff about', es: 'perder el tiempo, enredar', reg: 'casual', ex: 'Stop faffing about.', exEs: 'Deja de enredar.' },
  { word: 'kip', es: 'siesta, echarse a dormir', reg: 'casual', ex: 'I need a quick kip.', exEs: 'Necesito echarme una siesta.' },
  { word: 'sound', es: 'majo; bien; vale', reg: 'casual', ex: "He's dead sound.", exEs: 'Es muy majo.' },
  { word: 'sorted', es: 'arreglado, listo', reg: 'casual', ex: 'The tickets are sorted.', exEs: 'Las entradas están listas.' },
  { word: 'buzzing', es: 'eufórico, emocionado', reg: 'casual', ex: "I'm buzzing for the weekend.", exEs: 'Estoy emocionadísimo por el finde.' },
  { word: 'mint', es: 'genial, estupendo', reg: 'casual', ex: "That's mint!", exEs: '¡Eso es genial!' },
  { word: 'naff', es: 'hortera, cutre', reg: 'casual', ex: 'It looks a bit naff.', exEs: 'Queda un poco hortera.' },
  { word: 'cheers', es: 'gracias; salud; adiós', reg: 'casual', ex: 'Cheers, mate.', exEs: 'Gracias, tío.' },
  { word: 'mate', es: 'colega, tío', reg: 'casual', ex: 'Alright, mate?', exEs: '¿Qué tal, tío?' },
  { word: 'bloke', es: 'tío, hombre', reg: 'casual', ex: 'Some bloke asked me for directions.', exEs: 'Un tío me preguntó cómo llegar.' },
  { word: 'lad', es: 'chaval, tío', reg: 'casual', ex: "He's a good lad.", exEs: 'Es buen chaval.' },
  { word: 'graft', es: 'currar; curro duro', reg: 'casual', ex: "He's been grafting all week.", exEs: 'Ha estado currando toda la semana.' },
  { word: 'dosh', es: 'pasta (dinero)', reg: 'casual', ex: "He's got loads of dosh.", exEs: 'Tiene un montón de pasta.' },
  { word: 'quid', es: 'libra (£)', reg: 'casual', ex: "It's twenty quid.", exEs: 'Son veinte libras.' },
  { word: 'tenner', es: 'billete de diez libras', reg: 'casual', ex: 'Can you lend me a tenner?', exEs: '¿Me prestas diez libras?' },
  { word: 'gaff', es: 'casa, piso', reg: 'casual', ex: 'Come round my gaff.', exEs: 'Vente a mi casa.' },
  { word: 'chocka', es: 'hasta arriba, abarrotado', reg: 'casual', ex: 'The pub was chocka.', exEs: 'El pub estaba abarrotado.' },
  { word: 'leg it', es: 'salir pitando', reg: 'casual', ex: 'We legged it when it started raining.', exEs: 'Salimos pitando cuando empezó a llover.' },
  { word: 'bottle', es: 'agallas, valor', reg: 'casual', ex: "He didn't have the bottle to ask.", exEs: 'No tuvo agallas para preguntar.' },
  { word: 'gobby', es: 'bocazas', reg: 'malsonante', ex: "She's a bit gobby.", exEs: 'Es un poco bocazas.' },
  { word: 'minging', es: 'asqueroso, feo', reg: 'malsonante', ex: "The weather's minging today.", exEs: 'Hace un tiempo asqueroso hoy.' },
  { word: 'rank', es: 'asqueroso', reg: 'malsonante', ex: 'That smell is rank.', exEs: 'Ese olor es asqueroso.' },
  { word: 'snog', es: 'morrearse', reg: 'malsonante', ex: 'They were snogging in the corner.', exEs: 'Se estaban morreando en un rincón.' },
  { word: 'take the mick', es: 'vacilar, cachondearse; o pasarse', reg: 'malsonante', ex: 'Are you taking the mick?', exEs: '¿Me estás vacilando?' },
  { word: 'bugger', es: '¡mecachis!; o cabrón (a veces cariñoso)', reg: 'malsonante', ex: 'Bugger, I forgot my keys.', exEs: 'Mecachis, olvidé las llaves.' },
  { word: 'git', es: 'capullo, cabrón (leve)', reg: 'malsonante', ex: 'You cheeky git!', exEs: '¡Serás capullo!' },
  { word: "can't be arsed", es: 'no me da la gana, paso', reg: 'malsonante', ex: "I can't be arsed to cook.", exEs: 'Me da pereza cocinar.' },
  { word: 'bollocks', es: 'gilipolleces, tonterías; ojo: «the dog’s bollocks» = genial', reg: 'vulgar', ex: "That's absolute bollocks.", exEs: 'Eso son gilipolleces.' },
  { word: 'wanker', es: 'gilipollas, capullo', reg: 'vulgar', ex: "He's such a wanker.", exEs: 'Es un gilipollas.' },
  { word: 'twat', es: 'imbécil, gilipollas', reg: 'vulgar', ex: "Don't be a twat.", exEs: 'No seas gilipollas.' },
  { word: 'tosser', es: 'gilipollas', reg: 'vulgar', ex: 'What a tosser.', exEs: 'Vaya gilipollas.' },
  { word: 'knobhead', es: 'capullo, gilipollas', reg: 'vulgar', ex: "He's an absolute knobhead.", exEs: 'Es un capullo integral.' },
];

const AMERICAN: Slang[] = [
  { word: 'beat', es: 'agotado', reg: 'casual', ex: "I'm beat.", exEs: 'Estoy agotado.' },
  { word: 'bail', es: 'rajarse, largarse de golpe', reg: 'casual', ex: 'He bailed on us last minute.', exEs: 'Se rajó en el último momento.' },
  { word: 'flaky', es: 'poco fiable (que se raja)', reg: 'casual', ex: "She's too flaky to make plans with.", exEs: 'Es demasiado informal para hacer planes.' },
  { word: 'bummed', es: 'decepcionado, chof', reg: 'casual', ex: "I'm so bummed about it.", exEs: 'Me da mucha pena.' },
  { word: 'salty', es: 'picado, resentido', reg: 'casual', ex: "Don't get salty because you lost.", exEs: 'No te piques por haber perdido.' },
  { word: 'hyped', es: 'muy emocionado', reg: 'casual', ex: "I'm hyped for the concert.", exEs: 'Estoy emocionadísimo por el concierto.' },
  { word: 'ghost', es: 'dejar de responder de golpe', reg: 'casual', ex: 'She ghosted me after one date.', exEs: 'Me dejó en visto tras una cita.' },
  { word: 'chill', es: 'tranqui; relajarse; majo', reg: 'casual', ex: "He's really chill.", exEs: 'Es muy tranqui.' },
  { word: 'bucks', es: 'pavos (dólares)', reg: 'casual', ex: 'It costs five bucks.', exEs: 'Cuesta cinco pavos.' },
  { word: 'veg out', es: 'vaguear, no hacer nada', reg: 'casual', ex: 'I just vegged out all weekend.', exEs: 'Me pasé el finde vagueando.' },
  { word: 'sketchy', es: 'chungo, sospechoso', reg: 'casual', ex: 'That neighborhood is sketchy.', exEs: 'Ese barrio es chungo.' },
  { word: 'shady', es: 'turbio, sospechoso (persona)', reg: 'casual', ex: "He's been acting shady.", exEs: 'Ha estado actuando de forma turbia.' },
  { word: 'bougie', es: 'pijo, de postureo', reg: 'casual', ex: 'This café is so bougie.', exEs: 'Este café es puro postureo.' },
  { word: 'flex', es: 'presumir, alardear', reg: 'casual', ex: 'Stop flexing.', exEs: 'Deja de fardar.' },
  { word: 'lowkey', es: 'un poco, en plan discreto', reg: 'casual', ex: 'I lowkey wanna go home.', exEs: 'En plan, un poco quiero irme a casa.' },
  { word: 'savage', es: 'brutal, sin piedad (elogio)', reg: 'casual', ex: 'That comeback was savage.', exEs: 'Esa respuesta fue brutal.' },
  { word: 'dope', es: 'genial, guay', reg: 'casual', ex: "That's dope.", exEs: 'Eso es genial.' },
  { word: 'hangry', es: 'hambriento e irritable', reg: 'casual', ex: "Sorry, I'm hangry.", exEs: 'Perdona, tengo hambre y estoy de mal humor.' },
  { word: 'crash', es: 'dormir; quedarse a dormir', reg: 'casual', ex: 'Can I crash at your place?', exEs: '¿Puedo quedarme a dormir en tu casa?' },
  { word: 'hang out', es: 'pasar el rato', reg: 'casual', ex: "Let's hang out this weekend.", exEs: 'Quedemos este finde.' },
  { word: 'my bad', es: 'culpa mía, perdón', reg: 'casual', ex: 'My bad, I forgot.', exEs: 'Culpa mía, se me olvidó.' },
  { word: 'props', es: 'reconocimiento, respeto', reg: 'casual', ex: 'Props to you for finishing.', exEs: 'Mis respetos por terminarlo.' },
  { word: 'bounce', es: 'irse, largarse', reg: 'casual', ex: "Let's bounce.", exEs: 'Larguémonos.' },
  { word: 'pumped', es: 'muy motivado', reg: 'casual', ex: "I'm so pumped for this.", exEs: 'Estoy motivadísimo con esto.' },
  { word: 'legit', es: 'de verdad, auténtico', reg: 'casual', ex: "That's legit the best pizza.", exEs: 'Es de verdad la mejor pizza.' },
  { word: 'ride', es: 'coche', reg: 'casual', ex: 'Nice ride.', exEs: 'Bonito coche.' },
  { word: 'score', es: 'pillar, conseguir (algo bueno)', reg: 'casual', ex: 'I scored front-row tickets.', exEs: 'Pillé entradas de primera fila.' },
  { word: 'buzzkill', es: 'aguafiestas', reg: 'casual', ex: "Don't be a buzzkill.", exEs: 'No seas aguafiestas.' },
  { word: 'wack', es: 'malo, cutre', reg: 'casual', ex: 'This is wack.', exEs: 'Esto es una porquería.' },
  { word: 'no cap', es: 'sin mentir, en serio', reg: 'casual', ex: 'No cap, it was amazing.', exEs: 'En serio, fue increíble.' },
  { word: 'sus', es: 'sospechoso', reg: 'casual', ex: 'That sounds sus.', exEs: 'Eso suena sospechoso.' },
  { word: 'wasted', es: 'muy borracho', reg: 'malsonante', ex: 'He got wasted last night.', exEs: 'Anoche se puso ciego.' },
  { word: 'screw up', es: 'cagarla, meter la pata', reg: 'malsonante', ex: 'I really screwed up.', exEs: 'La cagué pero bien.' },
  { word: 'crap', es: 'mierda (suave); porquería', reg: 'malsonante', ex: "I don't give a crap.", exEs: 'Me importa un pimiento.' },
  { word: 'freaking', es: 'versión suave de «fucking» (intensificador)', reg: 'malsonante', ex: "It's freaking cold.", exEs: 'Hace un frío del copón.' },
  { word: 'badass', es: 'chulísimo, impresionante; o un tipo duro', reg: 'malsonante', ex: 'That car is badass.', exEs: 'Ese coche es una pasada.' },
  { word: 'jackass', es: 'imbécil, idiota', reg: 'vulgar', ex: "Don't be a jackass.", exEs: 'No seas imbécil.' },
  { word: 'dumbass', es: 'idiota, memo', reg: 'vulgar', ex: 'What a dumbass move.', exEs: 'Vaya idiotez.' },
  { word: 'asshole', es: 'gilipollas', reg: 'vulgar', ex: "He's a total asshole.", exEs: 'Es un gilipollas de manual.' },
  { word: 'dickhead', es: 'capullo, gilipollas', reg: 'vulgar', ex: 'Total dickhead.', exEs: 'Un capullo integral.' },
];

// Trampas UK↔US (mismo término, sentido distinto). Van como confusing_pair
// (formato "UK = ... | US = ...", que el parser renderiza como comparación).
const TRAPS: { word: string; translation: string }[] = [
  { word: 'pissed (UK vs US)', translation: 'UK = borracho, piripi | US = cabreado, enfadado' },
  { word: 'piss off (UK vs US)', translation: 'UK = ¡lárgate! (vulgar) | US = cabrear; o ¡lárgate! (vulgar)' },
  { word: 'fanny (UK vs US)', translation: 'UK = genitales femeninos (¡vulgar!) | US = trasero (leve)' },
  { word: 'fag (UK vs US)', translation: 'UK = cigarrillo (informal) | US = insulto homófobo grave, NUNCA usar' },
  { word: 'pants (UK vs US)', translation: 'UK = calzoncillos; o «malo, cutre» | US = pantalones' },
  { word: 'rubber (UK vs US)', translation: 'UK = goma de borrar | US = condón (slang)' },
  { word: 'bum (UK vs US)', translation: 'UK = culo, trasero | US = vagabundo' },
];

function slangRow(s: Slang, category: string, rank: number) {
  return {
    id: randomUUID(),
    word: s.word,
    translation: `${s.es}${regNote[s.reg]}`,
    cefr_level: 'B2',
    category,
    frequency_rank: rank,
    example_sentence: s.ex,
    example_translation: s.exEs,
  };
}

async function main() {
  const british = BRITISH.map((s, i) => slangRow(s, 'british_slang', i + 1));
  const american = AMERICAN.map((s, i) => slangRow(s, 'american_slang', i + 1));
  const traps = TRAPS.map((t) => ({
    id: randomUUID(),
    word: t.word,
    translation: t.translation,
    cefr_level: 'B2',
    category: 'confusing_pair',
    example_sentence: null,
    example_translation: null,
  }));

  console.log(`\n${APPLY ? '🔧 APLICANDO' : '🔍 DRY-RUN'}`);
  console.log(`🇬🇧 british_slang: ${british.length} · 🇺🇸 american_slang: ${american.length} · ⚠️ trampas (confusing_pair): ${traps.length}\n`);
  british.concat(american).forEach((r) => console.log(`• [${r.category}] ${r.word.padEnd(16)} → ${r.translation}`));
  traps.forEach((r) => console.log(`• [trap] ${r.word.padEnd(20)} → ${r.translation}`));

  if (!APPLY) {
    console.log('\nℹ️  dry-run. Añade --apply.\n');
    return;
  }

  // Idempotencia: limpiar slang previo y las palabras trampa concretas.
  await supabase.from('vocabulary').delete().in('category', ['british_slang', 'american_slang']);
  await supabase.from('vocabulary').delete().eq('category', 'confusing_pair').in('word', TRAPS.map((t) => t.word));

  const all = [...british, ...american, ...traps];
  const { error } = await supabase.from('vocabulary').insert(all);
  if (error) {
    console.error('❌ Error insertando:', error);
    process.exit(1);
  }
  console.log(`\n✅ Insertadas ${all.length} filas de slang.\n`);
}

main();
