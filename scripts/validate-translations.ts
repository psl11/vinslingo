#!/usr/bin/env npx tsx
/**
 * Valida que todas las traducciones del vocabulario parsean bien con el MISMO
 * parser que usa la app (lib/vocabulary/translationParser). Así, si algún día se
 * edita/añade contenido en Supabase con un formato roto (numeración mal puesta,
 * ejemplo sin "= español", par confuso mal separado…), esto lo caza antes de que
 * se vea mal en la ficha o el buscador — sin necesidad de estructurar la BD.
 *
 * Valida el backup local (supabase/backup/vocabulary.json), que es la copia
 * versionada del contenido. Ejecuta `npm run backup:supabase` antes si acabas de
 * editar Supabase.
 *
 * Uso:  npx tsx scripts/validate-translations.ts
 * Sale con código 1 si hay ERRORES (útil para CI).
 */
import * as fs from 'fs';
import * as path from 'path';
import { analyzeTranslation } from '../lib/vocabulary/translationParser';

interface Row {
  word: string;
  translation: string;
  category: string;
  example_sentence?: string | null;
  example_translation?: string | null;
  example_sentence_2?: string | null;
  example_translation_2?: string | null;
}

// --- Lematización mínima para comprobar que un ejemplo usa SU propia palabra ---
// (mismo espíritu que el matcher de música: formas irregulares + flexiones +
// phrasals separables). Ver docs/content-qa.md.
const IRREG: Record<string, string[]> = {
  be: ['am', 'is', 'are', 'was', 'were', 'been', 'being'],
  run: ['ran', 'running'], get: ['got', 'gotten', 'getting'], give: ['gave', 'given', 'giving'],
  take: ['took', 'taken', 'taking'], make: ['made', 'making'], go: ['went', 'gone', 'going', 'goes'],
  come: ['came', 'coming'], see: ['saw', 'seen', 'seeing'], find: ['found', 'finding'],
  hold: ['held', 'holding'], keep: ['kept', 'keeping'], bring: ['brought', 'bringing'],
  break: ['broke', 'broken', 'breaking'], blow: ['blew', 'blown', 'blowing'],
  throw: ['threw', 'thrown', 'throwing'], fall: ['fell', 'fallen', 'falling'],
  catch: ['caught', 'catching'], put: ['putting'], cut: ['cutting'], let: ['letting'],
  set: ['setting'], hit: ['hitting'], shut: ['shutting'], lose: ['lost', 'losing'],
  leave: ['left', 'leaving'], feel: ['felt', 'feeling'], tell: ['told', 'telling'],
  think: ['thought', 'thinking'], stand: ['stood', 'standing'], wake: ['woke', 'woken', 'waking'],
  pay: ['paid', 'paying'], lay: ['laid', 'laying'], buy: ['bought', 'buying'],
  sell: ['sold', 'selling'], draw: ['drew', 'drawn', 'drawing'], drive: ['drove', 'driven', 'driving'],
  write: ['wrote', 'written', 'writing'], ride: ['rode', 'ridden', 'riding'],
  eat: ['ate', 'eaten', 'eating'], speak: ['spoke', 'spoken', 'speaking'], sit: ['sat', 'sitting'],
  do: ['does', 'did', 'done', 'doing'], have: ['has', 'had', 'having'],
  say: ['said', 'saying'], know: ['knew', 'known', 'knowing'],
  hang: ['hung', 'hanged', 'hanging'], grow: ['grew', 'grown', 'growing'],
  send: ['sent', 'sending'], build: ['built', 'building'], steal: ['stole', 'stolen', 'stealing'],
  bite: ['bit', 'bitten', 'biting'], spend: ['spent', 'spending'], sing: ['sang', 'sung', 'singing'],
  drink: ['drank', 'drunk', 'drinking'], swim: ['swam', 'swum', 'swimming'],
  begin: ['began', 'begun', 'beginning'], ring: ['rang', 'rung', 'ringing'],
  meet: ['met', 'meeting'], read: ['reading'], feed: ['fed', 'feeding'], lead: ['led', 'leading'],
  sleep: ['slept', 'sleeping'], teach: ['taught', 'teaching'], seek: ['sought', 'seeking'],
  fight: ['fought', 'fighting'], win: ['won', 'winning'], wear: ['wore', 'worn', 'wearing'],
  tear: ['tore', 'torn', 'tearing'], choose: ['chose', 'chosen', 'choosing'],
  freeze: ['froze', 'frozen', 'freezing'], forget: ['forgot', 'forgotten', 'forgetting'],
  hide: ['hid', 'hidden', 'hiding'], shake: ['shook', 'shaken', 'shaking'],
  stick: ['stuck', 'sticking'], strike: ['struck', 'striking'], bend: ['bent', 'bending'],
  lend: ['lent', 'lending'], understand: ['understood', 'understanding'],
  fly: ['flew', 'flown', 'flying'], drop: ['dropped', 'dropping'],
};

// Partículas de phrasal verb (para decidir si una entrada de 2 palabras es un
// phrasal comprobable frente a una expresión con plantilla).
const PARTICLES = new Set([
  'up', 'out', 'off', 'on', 'in', 'down', 'away', 'back', 'over', 'through',
  'about', 'around', 'along', 'across', 'after', 'for', 'into', 'onto', 'with',
  'from', 'by', 'apart', 'together', 'forward', 'ahead', 'aside', 'behind',
]);

/**
 * Solo comprobamos el ejemplo en entradas donde la palabra aparece LITERAL:
 * una sola palabra o un phrasal verbo+partícula. Las expresiones/idioms son
 * plantillas ("I'm fed up with", "take it with a grain of salt") que el ejemplo
 * adapta legítimamente (pronombres, tiempos, objetos), así que comprobarlas solo
 * daría falsos positivos.
 */
function isCheckableWord(word: string, category: string): boolean {
  if (category === 'confusing_pair') return false;
  const w = word.toLowerCase().trim();
  if (/[/?!",]/.test(w)) return false; // variantes ("kind of / sort of"), plantillas
  if (/\b(i|i'm|you|he|she|it|it's|we|they|someone|somebody|something|one's|your|my|his|her|their|that)\b/.test(w)) return false;
  if (/^to\s/.test(w)) return false; // "to get rid of"
  const toks = w.split(/\s+/);
  if (toks.length === 1) return true;
  if (toks.length === 2 && PARTICLES.has(toks[1])) return true;
  return false;
}

function verbForms(w: string): string[] {
  const base = w.toLowerCase();
  const forms = new Set([base]);
  (IRREG[base] || []).forEach((f) => forms.add(f));
  forms.add(base + 's');
  if (/(s|x|z|ch|sh|o)$/.test(base)) forms.add(base + 'es');
  if (/[^aeiou]y$/.test(base)) {
    forms.add(base.slice(0, -1) + 'ies');
    forms.add(base.slice(0, -1) + 'ied');
  } else {
    forms.add(base + 'ed');
  }
  forms.add(base + 'ing');
  // grados del adjetivo (smart → smarter/smartest, easy → easier/easiest)
  if (/[^aeiou]y$/.test(base)) {
    forms.add(base.slice(0, -1) + 'ier');
    forms.add(base.slice(0, -1) + 'iest');
  } else {
    forms.add(base + 'er');
    forms.add(base + 'est');
  }
  if (base.endsWith('e')) {
    forms.add(base.slice(0, -1) + 'ing');
    forms.add(base + 'd');
    forms.add(base + 'r');
    forms.add(base + 'st');
  }
  if (/[^aeiou][aeiou][^aeiouwxy]$/.test(base)) {
    const d = base + base.slice(-1);
    forms.add(d + 'ing');
    forms.add(d + 'ed');
  }
  return [...forms];
}

const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ¿La frase usa la palabra de la ficha (con flexiones / phrasal separable)? */
function exampleUsesWord(word: string, sentence: string): boolean {
  const w = word.toLowerCase().replace(/\s*\(uk vs us\)\s*$/, '').replace(/[’]/g, "'").trim();
  const s = sentence.toLowerCase().replace(/[’]/g, "'");
  if (!w) return true;
  const toks = w.split(/\s+/);
  const first = `(?:${verbForms(toks[0]).map(escRe).join('|')})`;
  if (toks.length === 1) return new RegExp(`\\b${first}\\b`).test(s);
  const rest = toks.slice(1).map(escRe).join('\\s+');
  // contiguo, o separable (objeto en medio, hasta 3 palabras): "take it off"
  const contiguous = new RegExp(`\\b${first}\\s+${rest}\\b`);
  const separable = new RegExp(`\\b${first}(?:\\s+\\w+){1,3}\\s+${escRe(toks[toks.length - 1])}\\b`);
  return contiguous.test(s) || separable.test(s);
}

const BACKUP = path.join(__dirname, '..', 'supabase', 'backup', 'vocabulary.json');

type Level = 'ERROR' | 'WARN';
interface Issue {
  level: Level;
  word: string;
  category: string;
  msg: string;
}

function validate(row: Row): Issue[] {
  const issues: Issue[] = [];
  const t = row.translation || '';
  const add = (level: Level, msg: string) => issues.push({ level, word: row.word, category: row.category, msg });

  const a = analyzeTranslation(t);
  const body = t.includes(' — ') ? t.slice(t.indexOf(' — ') + 3) : t;
  const numMarkers = (body.match(/\d\)/g) || []).length;

  // El texto parece numerado (2+ marcadores) pero no se detectó como acepciones.
  if (numMarkers >= 2 && a.kind !== 'senses') {
    add('ERROR', `parece numerado (${numMarkers} marcadores) pero no se parsea como acepciones`);
  }

  if (a.kind === 'senses') {
    if (a.senses.length !== numMarkers) {
      add('ERROR', `nº de acepciones parseadas (${a.senses.length}) ≠ marcadores "N)" (${numMarkers})`);
    }
    a.senses.forEach((s) => {
      if (!s.desc) add('ERROR', `acepción ${s.n} sin descripción`);
      if (s.examples.length === 0) add('WARN', `acepción ${s.n} ("${s.desc}") sin ningún ejemplo`);
      s.examples.forEach((ex, i) => {
        if (!ex.en) add('ERROR', `acepción ${s.n}, ejemplo ${i + 1} sin inglés`);
        if (!ex.es) add('WARN', `acepción ${s.n}, ejemplo "${ex.en}" sin traducción (falta "= español")`);
      });
    });
  }

  if (a.kind === 'comparison') {
    if (a.items.length < 2) add('ERROR', `par confuso con menos de 2 elementos`);
    a.items.forEach((it, i) => {
      if (!it.term) add('ERROR', `par confuso, elemento ${i + 1} sin término`);
    });
  }

  // Contiene " | " (marca de par confuso) pero no se detectó como tal.
  if (t.includes(' | ') && a.kind !== 'comparison') {
    add('ERROR', `contiene " | " pero no se parsea como par confuso`);
  }

  // Comillas descuadradas: rompen la extracción de ejemplos (un ejemplo se
  // "comería" el resto del texto o quedaría colgado).
  const quotes = (t.match(/"/g) || []).length;
  if (quotes % 2 !== 0) add('ERROR', `comillas descuadradas (${quotes})`);

  // Explicación (monosémicos): tras quitar los ejemplos incrustados no debe
  // quedar basura — el caso "…haciendo algo. Ej" que se veía en la ficha.
  if (a.kind === 'term') {
    const e = a.explanation;
    if (e) {
      if (e.includes('"')) add('ERROR', `explicación con comilla suelta tras limpiar ejemplos: "${e}"`);
      if (/\b(como|tipo|ej|ejemplo|ejemplos|p\.?\s*ej|es decir|o sea|osea|por ejemplo)\b\.?:?$/i.test(e)) {
        add('ERROR', `explicación termina en marcador huérfano: "${e}"`);
      }
      if (/[,;:]$/.test(e)) add('WARN', `explicación termina en signo colgante: "${e}"`);
      // Conector colgante: el texto remitía a algo entrecomillado que la
      // limpieza se llevó ("Similar a ." ← Similar a "go on"; "… Opuesto" ←
      // Opuesto: "move in"). Misma familia que el "Ej", pero sin marcador.
      if (
        /(?:^|[\s.])(?:similar a|parecido a|opuesto|contrario|sinónimos?|antónimos?|equivale a|igual que|véase|a diferencia de)\s*\.?$/i.test(e) ||
        /\s(?:a|de|en|con|que|como|por|para|entre|sobre)\s*\.?$/i.test(e)
      ) {
        add('ERROR', `explicación termina en conector colgante, ¿se llevó un ejemplo?: "${e}"`);
      }
      if (e.length < 10) add('WARN', `explicación muy corta, ¿fragmento?: "${e}"`);
      const opens = (e.match(/\(/g) || []).length;
      const closes = (e.match(/\)/g) || []).length;
      if (opens !== closes) add('ERROR', `paréntesis descuadrados en la explicación: "${e}"`);
    }
  }

  // Los ejemplos deben ilustrar SU palabra (el fallo intolerable: la ficha de
  // "take off" con un ejemplo de "turn off").
  const skipExampleCheck = !isCheckableWord(row.word, row.category);
  const examples: [string | null | undefined, string | null | undefined, string][] = [
    [row.example_sentence, row.example_translation, 'ejemplo 1'],
    [row.example_sentence_2, row.example_translation_2, 'ejemplo 2'],
  ];
  for (const [en, es, label] of examples) {
    if (!en) continue;
    if (!skipExampleCheck && !exampleUsesWord(row.word, en)) {
      add('ERROR', `${label} no usa la palabra: "${en}"`);
    }
    if (!es) add('WARN', `${label} sin traducción al español`);
  }
  if (!row.example_sentence && row.example_sentence_2) {
    add('WARN', `tiene ejemplo 2 pero no ejemplo 1`);
  }

  return issues;
}

function main() {
  const rows: Row[] = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
  const all: Issue[] = [];
  for (const r of rows) all.push(...validate(r));

  const errors = all.filter((i) => i.level === 'ERROR');
  const warns = all.filter((i) => i.level === 'WARN');

  const print = (list: Issue[]) => {
    const byCat: Record<string, Issue[]> = {};
    for (const i of list) (byCat[i.category] ||= []).push(i);
    for (const [cat, items] of Object.entries(byCat)) {
      console.log(`\n  [${cat}]`);
      for (const i of items) console.log(`    ${i.word}: ${i.msg}`);
    }
  };

  console.log(`\nValidadas ${rows.length} entradas.\n`);
  if (errors.length) {
    console.log(`❌ ${errors.length} ERRORES (rompen la maquetación):`);
    print(errors);
  }
  if (warns.length) {
    console.log(`\n⚠️  ${warns.length} AVISOS (renderiza, pero revisar):`);
    print(warns);
  }
  if (!errors.length && !warns.length) {
    console.log('✅ Todo el contenido parsea correctamente.');
  }
  console.log('');
  process.exit(errors.length ? 1 : 0);
}

main();
