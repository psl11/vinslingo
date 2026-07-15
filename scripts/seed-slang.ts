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
import { createHash } from 'crypto';

/**
 * ID determinista (UUID v5-like) derivado de `categoría:word`. Clave para que
 * re-ejecutar el seed NO cambie los id: el borrado+reinserción produce los
 * mismos id, así que el sync incremental del cliente los actualiza en su sitio
 * y nunca deja filas huérfanas/duplicadas. Debe seguir siendo estable: no
 * cambiar la fórmula ni la clave sin forzar un full-resync.
 */
function detId(key: string): string {
  const h = createHash('sha1').update(key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

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
  { word: 'gaffer', es: 'jefe (en el curro)', reg: 'casual', ex: 'The gaffer wants a word.', exEs: 'El jefe quiere hablar contigo.' },
  { word: 'cracking', es: 'estupendo, genial', reg: 'casual', ex: 'It was a cracking match.', exEs: 'Fue un partidazo.' },
  { word: 'proper', es: 'de verdad, muy (intensificador)', reg: 'casual', ex: "I'm proper hungry.", exEs: 'Tengo un hambre de verdad.' },
  { word: 'jammy', es: 'con potra, suertudo', reg: 'casual', ex: 'You jammy git, you won again!', exEs: '¡Qué potra tienes, has vuelto a ganar!' },
  { word: 'minted', es: 'forrado (de dinero)', reg: 'casual', ex: 'Her family is minted.', exEs: 'Su familia está forrada.' },
  { word: 'blinding', es: 'genial, brutal', reg: 'casual', ex: 'That was a blinding goal.', exEs: 'Fue un golazo brutal.' },
  { word: 'lush', es: 'delicioso; genial', reg: 'casual', ex: 'This cake is lush.', exEs: 'Este pastel está buenísimo.' },
  { word: 'bevvy', es: 'bebida (alcohólica)', reg: 'casual', ex: 'Fancy a bevvy?', exEs: '¿Te apetece una copa?' },
  { word: 'sesh', es: 'sesión de fiesta/copas', reg: 'casual', ex: 'We had a big sesh last night.', exEs: 'Anoche nos pegamos una buena juerga.' },
  { word: 'banter', es: 'cachondeo, pique amistoso', reg: 'casual', ex: "Relax, it's just banter.", exEs: 'Tranquilo, es solo cachondeo.' },
  { word: 'peckish', es: 'con algo de hambre', reg: 'casual', ex: "I'm feeling a bit peckish.", exEs: 'Tengo algo de hambre.' },
  { word: 'wonky', es: 'torcido, que cojea/falla', reg: 'casual', ex: 'This table is a bit wonky.', exEs: 'Esta mesa cojea un poco.' },
  { word: 'skive off', es: 'escaquearse, hacer pellas', reg: 'casual', ex: 'He skived off work today.', exEs: 'Hoy se escaqueó del trabajo.' },
  { word: 'barmy', es: 'chiflado, majara', reg: 'casual', ex: "That's a barmy idea.", exEs: 'Esa idea es una locura.' },
  { word: 'daft', es: 'tonto, bobo', reg: 'casual', ex: "Don't be daft.", exEs: 'No seas bobo.' },
  { word: 'fit', es: 'atractivo, buenorro', reg: 'casual', ex: "He's well fit.", exEs: 'Está buenísimo.' },
  { word: 'plastered', es: 'muy borracho', reg: 'casual', ex: 'He got plastered at the party.', exEs: 'Se puso ciego en la fiesta.' },
  { word: 'knees-up', es: 'fiestón, juerga', reg: 'casual', ex: 'We had a proper knees-up.', exEs: 'Nos montamos un fiestón.' },
  { word: 'nosh', es: 'comida, papeo', reg: 'casual', ex: "Let's get some nosh.", exEs: 'Vamos a por algo de papeo.' },
  { word: 'brolly', es: 'paraguas', reg: 'casual', ex: "Take a brolly, it's chucking it down.", exEs: 'Llévate el paraguas, está diluviando.' },
  { word: 'telly', es: 'la tele', reg: 'casual', ex: "There's nothing on the telly.", exEs: 'No hay nada en la tele.' },
  { word: 'loo', es: 'el váter, el baño', reg: 'casual', ex: "Where's the loo?", exEs: '¿Dónde está el baño?' },
  { word: 'bin', es: 'tirar a la basura', reg: 'casual', ex: 'Just bin it.', exEs: 'Tíralo a la basura.' },
  { word: 'porkies', es: 'mentiras (de «porky pies» = lies)', reg: 'casual', ex: 'Stop telling porkies.', exEs: 'Deja de contar mentiras.' },
  { word: 'codswallop', es: 'tonterías, paparruchas', reg: 'casual', ex: 'What a load of codswallop.', exEs: 'Menuda sarta de tonterías.' },
  { word: 'gormless', es: 'pasmado, atontado', reg: 'casual', ex: 'He gave me a gormless look.', exEs: 'Me miró con cara de pasmado.' },
  { word: 'numpty', es: 'zoquete, inútil (cariñoso)', reg: 'casual', ex: "You numpty, that's the wrong one.", exEs: 'Zoquete, ese no es.' },
  { word: 'muppet', es: 'inútil, memo (cariñoso)', reg: 'casual', ex: "He's a bit of a muppet.", exEs: 'Es un poco memo.' },
  { word: 'div', es: 'tonto, idiota', reg: 'casual', ex: "Don't be such a div.", exEs: 'No seas tan tonto.' },
  { word: 'throw a wobbly', es: 'coger una pataleta/berrinche', reg: 'casual', ex: 'She threw a wobbly over nothing.', exEs: 'Cogió una pataleta por nada.' },
  { word: 'chinwag', es: 'charla, cotorreo', reg: 'casual', ex: 'We had a good chinwag.', exEs: 'Nos echamos una buena charla.' },
  { word: 'moreish', es: 'que engancha (comida)', reg: 'casual', ex: 'These crisps are so moreish.', exEs: 'Estas patatas enganchan que no veas.' },
  { word: 'mardy', es: 'enfurruñado, gruñón', reg: 'casual', ex: "Don't be so mardy.", exEs: 'No te enfurruñes.' },
  { word: 'cushty', es: 'genial, de lujo', reg: 'casual', ex: 'Sorted? Cushty.', exEs: '¿Listo? De lujo.' },
  { word: 'lairy', es: 'chulesco, alborotador', reg: 'malsonante', ex: 'He gets lairy after a few drinks.', exEs: 'Se pone chulesco tras unas copas.' },
  { word: 'pillock', es: 'idiota, memo', reg: 'malsonante', ex: 'You absolute pillock!', exEs: '¡Serás memo!' },
  { word: 'arsehole', es: 'gilipollas', reg: 'vulgar', ex: "He's being an arsehole.", exEs: 'Se está portando como un gilipollas.' },
  { word: 'bellend', es: 'gilipollas, capullo', reg: 'vulgar', ex: 'What an absolute bellend.', exEs: 'Menudo gilipollas.' },
  { word: 'shite', es: 'mierda (variante de shit)', reg: 'vulgar', ex: 'This film is shite.', exEs: 'Esta peli es una mierda.' },
  { word: 'minger', es: 'feo, callo (ofensivo, sobre el aspecto físico)', reg: 'casual', ex: "That's a bit of a minger.", exEs: 'Eso es bastante feo.' },
  { word: 'innit', es: '¿no?, ¿verdad? (coletilla)', reg: 'casual', ex: 'Cold today, innit?', exEs: 'Hace frío hoy, ¿eh?' },
  { word: 'reckon', es: 'creer, pensar', reg: 'casual', ex: 'I reckon we should leave.', exEs: 'Creo que deberíamos irnos.' },
  { word: 'ta', es: 'gracias (informal)', reg: 'casual', ex: 'Ta very much.', exEs: 'Muchas gracias.' },
  { word: 'grand', es: 'mil (libras)', reg: 'casual', ex: 'It cost five grand.', exEs: 'Costó cinco mil libras.' },
  { word: 'bonkers', es: 'loco, chiflado', reg: 'casual', ex: 'That plan is bonkers.', exEs: 'Ese plan es una locura.' },
  { word: 'grim', es: 'desagradable, chungo', reg: 'casual', ex: "The weather's proper grim.", exEs: 'Hace un tiempo asqueroso.' },
  { word: 'whinge', es: 'quejarse, lloriquear', reg: 'casual', ex: 'Stop whinging.', exEs: 'Deja de quejarte.' },
  { word: 'brill', es: 'genial (de brilliant)', reg: 'casual', ex: "That's brill!", exEs: '¡Genial!' },
  { word: 'ace', es: 'genial, estupendo', reg: 'casual', ex: 'The gig was ace.', exEs: 'El concierto fue genial.' },
  { word: 'smashing', es: 'estupendo, genial', reg: 'casual', ex: "That's a smashing idea.", exEs: 'Es una idea estupenda.' },
  { word: 'posh', es: 'pijo, elegante', reg: 'casual', ex: 'They eat at posh restaurants.', exEs: 'Comen en restaurantes pijos.' },
  { word: 'wally', es: 'bobo, memo', reg: 'casual', ex: "Don't be a wally.", exEs: 'No seas bobo.' },
  { word: 'berk', es: 'idiota (leve)', reg: 'casual', ex: 'You proper berk.', exEs: 'Serás idiota.' },
  { word: 'plonker', es: 'memo, idiota', reg: 'casual', ex: 'You plonker!', exEs: '¡Serás memo!' },
  { word: 'waffle', es: 'enrollarse (hablar sin decir nada)', reg: 'casual', ex: 'He waffled on for ages.', exEs: 'Se enrolló un montón.' },
  { word: 'merry', es: 'achispado, piripi', reg: 'casual', ex: 'I was a bit merry by then.', exEs: 'Para entonces estaba ya piripi.' },
  { word: 'nippy', es: 'fresquito (frío)', reg: 'casual', ex: "It's a bit nippy out.", exEs: 'Hace fresquito fuera.' },
  { word: 'bare', es: 'mucho, un montón (jerga urbana)', reg: 'casual', ex: 'There were bare people there.', exEs: 'Había un montón de gente.' },
  { word: 'long', es: 'pesado, un rollo (jerga urbana)', reg: 'casual', ex: 'Going all that way is long.', exEs: 'Ir hasta allí es un rollo.' },
  { word: 'peak', es: 'una faena, chungo (jerga urbana)', reg: 'casual', ex: "That's peak, man.", exEs: 'Qué faena, tío.' },
  { word: 'allow it', es: 'déjalo, olvídalo (jerga urbana)', reg: 'casual', ex: "Allow it, it's not worth it.", exEs: 'Déjalo, no merece la pena.' },
  { word: 'gassed', es: 'emocionado; o creído (jerga urbana)', reg: 'casual', ex: "He's well gassed about it.", exEs: 'Está emocionadísimo con eso.' },
  { word: 'vexed', es: 'cabreado (jerga urbana)', reg: 'casual', ex: "I'm so vexed right now.", exEs: 'Estoy súper cabreado ahora mismo.' },
  { word: 'fam', es: 'colega, hermano (jerga urbana)', reg: 'casual', ex: 'You good, fam?', exEs: '¿Todo bien, hermano?' },
  { word: 'mandem', es: 'el grupo de colegas (jerga urbana)', reg: 'casual', ex: 'me and the mandem', exEs: 'los colegas y yo' },
  { word: 'ends', es: 'el barrio (jerga urbana)', reg: 'casual', ex: 'back in my ends', exEs: 'de vuelta en mi barrio' },
  { word: 'wasteman', es: 'inútil, pringado (jerga urbana)', reg: 'casual', ex: "He's a total wasteman.", exEs: 'Es un pringado total.' },
  { word: 'buff', es: 'atractivo, buenorro (jerga urbana)', reg: 'casual', ex: "She's proper buff.", exEs: 'Está buenísima.' },
  { word: 'calm', es: 'tranqui; guay; vale (jerga urbana)', reg: 'casual', ex: "Yeah, it's calm.", exEs: 'Sí, tranqui.' },
  { word: 'jokes', es: 'divertidísimo, la monda', reg: 'casual', ex: 'That night was jokes.', exEs: 'Esa noche fue la monda.' },
  { word: 'safe', es: 'guay; gracias; majo (jerga urbana)', reg: 'casual', ex: 'Safe, bro.', exEs: 'Guay, tío. / Gracias, tío.' },
  { word: 'link up', es: 'quedar (o liarse con alguien)', reg: 'casual', ex: "Let's link up later.", exEs: 'Quedamos luego.' },
  { word: 'swear down', es: 'te lo juro (jerga urbana)', reg: 'casual', ex: "Swear down, it's true.", exEs: 'Te lo juro, es verdad.' },
  { word: 'ledge', es: 'crack, figura (de legend)', reg: 'casual', ex: 'You absolute ledge!', exEs: '¡Eres un crack!' },
  { word: 'tipple', es: 'copa, bebida', reg: 'casual', ex: 'Fancy a wee tipple?', exEs: '¿Te apetece una copita?' },
  { word: 'slag off', es: 'poner a parir, criticar duramente', reg: 'malsonante', ex: 'They slagged him off.', exEs: 'Lo pusieron a parir.' },
  { word: 'bugger all', es: 'nada de nada', reg: 'malsonante', ex: "There's bugger all to do here.", exEs: 'Aquí no hay nada que hacer.' },
  { word: 'sod off', es: '¡lárgate!, ¡vete a paseo!', reg: 'malsonante', ex: 'Sod off and leave me alone.', exEs: 'Lárgate y déjame en paz.' },
  { word: 'tit', es: 'idiota, memo (leve)', reg: 'malsonante', ex: 'I felt a right tit.', exEs: 'Me sentí como un idiota.' },
  { word: 'knob', es: 'capullo, gilipollas', reg: 'vulgar', ex: 'Stop being a knob.', exEs: 'Deja de ser un capullo.' },
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
  { word: "y'all", es: 'vosotros, todos (sur de EE. UU.)', reg: 'casual', ex: "Are y'all coming tonight?", exEs: '¿Venís todos esta noche?' },
  { word: 'gnarly', es: 'brutal; o chungo, feo', reg: 'casual', ex: 'That was a gnarly crash.', exEs: 'Fue un accidente muy bestia.' },
  { word: 'stoked', es: 'encantado, emocionado', reg: 'casual', ex: "I'm so stoked for the trip.", exEs: 'Estoy emocionadísimo por el viaje.' },
  { word: 'bummer', es: 'qué faena, qué pena', reg: 'casual', ex: 'No tickets left? Bummer.', exEs: '¿No quedan entradas? Qué faena.' },
  { word: 'gig', es: 'bolo; curro puntual', reg: 'casual', ex: 'I picked up a weekend gig.', exEs: 'Pillé un curro para el finde.' },
  { word: 'rip-off', es: 'timo, estafa', reg: 'casual', ex: 'Twenty bucks? What a rip-off.', exEs: '¿Veinte pavos? Menudo timo.' },
  { word: 'cheesy', es: 'cursi, hortera', reg: 'casual', ex: "It's a cheesy rom-com.", exEs: 'Es una comedia romántica muy cursi.' },
  { word: 'corny', es: 'cursi, malo (chiste)', reg: 'casual', ex: 'That joke was so corny.', exEs: 'Ese chiste fue malísimo.' },
  { word: 'lame', es: 'soso, patético', reg: 'casual', ex: 'The party was kinda lame.', exEs: 'La fiesta fue un poco sosa.' },
  { word: 'wing it', es: 'improvisar', reg: 'casual', ex: "I didn't study, I'll just wing it.", exEs: 'No estudié, ya improvisaré.' },
  { word: 'hit up', es: 'contactar; pasarse por', reg: 'casual', ex: "Hit me up when you're free.", exEs: 'Escríbeme cuando estés libre.' },
  { word: 'grub', es: 'comida, papeo', reg: 'casual', ex: "Let's grab some grub.", exEs: 'Vamos a por algo de papeo.' },
  { word: 'dough', es: 'pasta (dinero)', reg: 'casual', ex: "I'm low on dough.", exEs: 'Ando corto de pasta.' },
  { word: 'loaded', es: 'forrado (de dinero)', reg: 'casual', ex: 'His parents are loaded.', exEs: 'Sus padres están forrados.' },
  { word: 'broke', es: 'sin blanca, pelado', reg: 'casual', ex: "I'm totally broke.", exEs: 'Estoy sin un duro.' },
  { word: 'tight', es: 'tacaño; o muy amigos; o genial (según contexto)', reg: 'casual', ex: "We've been tight since school.", exEs: 'Somos muy amigos desde el cole.' },
  { word: 'buzzed', es: 'achispado', reg: 'casual', ex: "I'm a little buzzed.", exEs: 'Estoy un poco achispado.' },
  { word: 'tipsy', es: 'piripi, achispado', reg: 'casual', ex: 'She got tipsy after one glass.', exEs: 'Se puso piripi con una copa.' },
  { word: 'dip', es: 'largarse, irse', reg: 'casual', ex: "It's late, let's dip.", exEs: 'Es tarde, larguémonos.' },
  { word: 'hooked', es: 'enganchado', reg: 'casual', ex: "I'm hooked on this show.", exEs: 'Estoy enganchado a esta serie.' },
  { word: 'binge', es: 'darse un atracón (ver/comer)', reg: 'casual', ex: 'We binged the whole season.', exEs: 'Nos ventilamos la temporada entera.' },
  { word: 'crush', es: 'estar colado por alguien', reg: 'casual', ex: 'I have a crush on her.', exEs: 'Estoy colado por ella.' },
  { word: 'cringe', es: 'vergüenza ajena', reg: 'casual', ex: "That's so cringe.", exEs: 'Eso da mucha vergüenza ajena.' },
  { word: 'vibe', es: 'rollo, buena onda', reg: 'casual', ex: 'I love the vibe here.', exEs: 'Me encanta el rollo de aquí.' },
  { word: 'slay', es: 'arrasar, bordarlo', reg: 'casual', ex: 'You totally slayed that.', exEs: 'Lo bordaste totalmente.' },
  { word: 'bet', es: 'vale, hecho (afirmación)', reg: 'casual', ex: 'Wanna go? — Bet.', exEs: '¿Vamos? — Hecho.' },
  { word: 'deadass', es: 'en serio, de verdad', reg: 'casual', ex: 'Deadass, it really happened.', exEs: 'En serio, pasó de verdad.' },
  { word: 'extra', es: 'exagerado, dramático', reg: 'casual', ex: "She's being so extra.", exEs: 'Está siendo súper exagerada.' },
  { word: 'basic', es: 'del montón, poco original', reg: 'casual', ex: 'That outfit is so basic.', exEs: 'Ese look es súper del montón.' },
  { word: 'simp', es: 'baboso (que se rebaja por alguien)', reg: 'casual', ex: 'Stop being a simp.', exEs: 'Deja de hacer el baboso.' },
  { word: 'glow up', es: 'mejora notable (de aspecto)', reg: 'casual', ex: 'He had a serious glow up.', exEs: 'Ha pegado un cambiazo tremendo.' },
  { word: 'beef', es: 'bronca, rencilla', reg: 'casual', ex: 'Those two have beef.', exEs: 'Esos dos tienen movida.' },
  { word: 'throw shade', es: 'soltar pullas, criticar de reojo', reg: 'casual', ex: "She's throwing shade at me.", exEs: 'Me está soltando pullas.' },
  { word: 'hustle', es: 'currar duro; buscarse la vida', reg: 'casual', ex: "He's got a side hustle.", exEs: 'Tiene un curro extra por su cuenta.' },
  { word: 'kickass', es: 'genial, con caña', reg: 'casual', ex: 'That was a kickass show.', exEs: 'Fue un conciertazo brutal.' },
  { word: 'hell yeah', es: '¡claro que sí!, ¡toma ya!', reg: 'casual', ex: 'Free pizza? Hell yeah!', exEs: '¿Pizza gratis? ¡Toma ya!' },
  { word: 'jerk', es: 'imbécil, idiota (leve)', reg: 'casual', ex: "Don't be a jerk.", exEs: 'No seas imbécil.' },
  { word: 'douchebag', es: 'imbécil, creído', reg: 'vulgar', ex: 'What a douchebag.', exEs: 'Menudo imbécil.' },
  { word: 'prick', es: 'capullo, gilipollas', reg: 'vulgar', ex: "He's such a prick.", exEs: 'Es un capullo.' },
  { word: 'son of a bitch', es: 'hijo de puta, cabrón', reg: 'vulgar', ex: 'That son of a bitch lied to me.', exEs: 'Ese cabrón me mintió.' },
  { word: 'dude', es: 'tío, tronco', reg: 'casual', ex: "Dude, that's awesome.", exEs: 'Tío, eso es genial.' },
  { word: 'bro', es: 'hermano, colega', reg: 'casual', ex: 'Thanks, bro.', exEs: 'Gracias, tío.' },
  { word: 'buddy', es: 'colega, amigo', reg: 'casual', ex: 'Hey, buddy, you okay?', exEs: 'Oye, colega, ¿estás bien?' },
  { word: 'spill the tea', es: 'contar el chisme/cotilleo', reg: 'casual', ex: 'Come on, spill the tea!', exEs: '¡Venga, suelta el cotilleo!' },
  { word: 'awesome', es: 'genial, alucinante', reg: 'casual', ex: 'That concert was awesome.', exEs: 'Ese concierto fue alucinante.' },
  { word: 'sick', es: 'genial, brutal (jerga)', reg: 'casual', ex: 'That trick was sick!', exEs: '¡Ese truco fue brutal!' },
  { word: 'fire', es: 'genial, buenísimo', reg: 'casual', ex: 'This song is fire.', exEs: 'Esta canción es una pasada.' },
  { word: 'GOAT', es: 'el mejor de todos (greatest of all time)', reg: 'casual', ex: "He's the GOAT.", exEs: 'Es el mejor de todos los tiempos.' },
  { word: 'rizz', es: 'labia, carisma (para ligar)', reg: 'casual', ex: "He's got serious rizz.", exEs: 'Tiene una labia impresionante.' },
  { word: 'mid', es: 'mediocre, del montón', reg: 'casual', ex: 'The movie was kinda mid.', exEs: 'La peli fue bastante mediocre.' },
  { word: 'slaps', es: 'está genial (música/comida)', reg: 'casual', ex: 'This song absolutely slaps.', exEs: 'Esta canción está buenísima.' },
  { word: 'shook', es: 'impactado, flipando', reg: 'casual', ex: "I'm honestly shook.", exEs: 'La verdad es que estoy flipando.' },
  { word: 'based', es: 'auténtico, sin miedo al qué dirán', reg: 'casual', ex: "Honestly? That's based.", exEs: '¿Sinceramente? Eso es de admirar.' },
  { word: 'W', es: 'victoria, un acierto (win)', reg: 'casual', ex: "That's a huge W.", exEs: 'Menudo acierto.' },
  { word: 'take the L', es: 'palmar, asumir la derrota', reg: 'casual', ex: 'Just take the L and move on.', exEs: 'Asume la derrota y pasa página.' },
  { word: 'hella', es: 'muy, un montón (California)', reg: 'casual', ex: "It's hella good.", exEs: 'Está buenísimo.' },
  { word: 'epic', es: 'épico, brutal', reg: 'casual', ex: 'That trip was epic.', exEs: 'Ese viaje fue épico.' },
  { word: 'snack', es: 'persona atractiva', reg: 'casual', ex: "He's a whole snack.", exEs: 'Está buenísimo.' },
  { word: 'thirsty', es: 'desesperado (por atención)', reg: 'casual', ex: "She's being so thirsty.", exEs: 'Está siendo súper desesperada.' },
  { word: 'FOMO', es: 'miedo a perderse algo (fear of missing out)', reg: 'casual', ex: "I've got serious FOMO.", exEs: 'Tengo un miedo tremendo a perdérmelo.' },
  { word: 'squad', es: 'grupo de amigos, cuadrilla', reg: 'casual', ex: "The whole squad's coming.", exEs: 'Viene toda la cuadrilla.' },
  { word: 'munchies', es: 'hambre de picar algo', reg: 'casual', ex: "I've got the munchies.", exEs: 'Me ha entrado el gusanillo.' },
  { word: 'chug', es: 'beber de un trago', reg: 'casual', ex: 'Chug it, chug it!', exEs: '¡De un trago, de un trago!' },
  { word: 'pig out', es: 'ponerse morado (comer)', reg: 'casual', ex: 'We pigged out on pizza.', exEs: 'Nos pusimos morados de pizza.' },
  { word: 'freak out', es: 'rayarse, entrar en pánico', reg: 'casual', ex: "Don't freak out, it's fine.", exEs: 'No te rayes, no pasa nada.' },
  { word: 'heads up', es: 'aviso, un chivatazo', reg: 'casual', ex: 'Thanks for the heads up.', exEs: 'Gracias por el aviso.' },
  { word: 'ballpark', es: 'aproximado, a ojo', reg: 'casual', ex: 'Give me a ballpark figure.', exEs: 'Dame una cifra aproximada.' },
  { word: 'geek', es: 'friki, empollón', reg: 'casual', ex: "He's a total tech geek.", exEs: 'Es un friki de la tecnología.' },
  { word: 'nerd', es: 'friki, empollón', reg: 'casual', ex: "I'm a bit of a nerd.", exEs: 'Soy un poco friki.' },
  { word: 'creep', es: 'tipo raro, siniestro', reg: 'casual', ex: 'That guy is such a creep.', exEs: 'Ese tío es un siniestro.' },
  { word: 'weirdo', es: 'bicho raro', reg: 'casual', ex: "Don't be a weirdo.", exEs: 'No seas raro.' },
  { word: 'noob', es: 'novato, pardillo', reg: 'casual', ex: "I'm a total noob at this.", exEs: 'Soy un pardillo total en esto.' },
  { word: 'kudos', es: 'mérito, reconocimiento', reg: 'casual', ex: 'Kudos to the whole team.', exEs: 'Mérito para todo el equipo.' },
  { word: 'clout', es: 'influencia, fama', reg: 'casual', ex: "He's just chasing clout.", exEs: 'Solo va buscando notoriedad.' },
  { word: 'bussin', es: 'buenísimo (sobre todo comida)', reg: 'casual', ex: 'This food is bussin.', exEs: 'Esta comida está buenísima.' },
  { word: 'suck', es: 'ser una mierda, dar asco', reg: 'malsonante', ex: 'This totally sucks.', exEs: 'Esto es una mierda.' },
  { word: 'damn', es: '¡joder!, maldito (leve)', reg: 'malsonante', ex: "Damn, that's expensive.", exEs: 'Joder, qué caro.' },
  { word: 'moron', es: 'imbécil, subnormal', reg: 'malsonante', ex: 'What a moron.', exEs: 'Menudo imbécil.' },
  { word: 'bullshit', es: 'gilipolleces, chorradas', reg: 'vulgar', ex: "That's complete bullshit.", exEs: 'Eso son gilipolleces.' },
  { word: 'shit', es: 'mierda', reg: 'vulgar', ex: 'This is a load of shit.', exEs: 'Esto es una mierda.' },
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
    id: detId(`${category}:${s.word}`),
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
    id: detId(`confusing_pair:${t.word}`),
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
