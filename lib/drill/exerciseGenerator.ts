import { VocabularyItem } from '../../stores/useStudyStore';
import { translationSummary } from '../vocabulary/translationParser';

// Generador de ejercicios del modo "Entrenamiento" (drill de palabras falladas,
// estilo Duolingo). Cada palabra produce 3 ejercicios que escalan:
//   1. reconocer  → opción múltiple EN→ES
//   2. comprender → completar la frase de ejemplo (o ES→EN si no hay hueco fiable)
//   3. producir   → escribir (TypingCard)
// Los fallos se re-encolan al final; una palabra "se gradúa" al superar sus 3.
// Ver docs/drill-mode.md.

export type DrillExerciseType = 'mc_en_es' | 'mc_es_en' | 'fill_blank' | 'typing';

export interface DrillOption {
  text: string;
  correct: boolean;
}

export interface DrillExercise {
  /** Único por palabra+tipo; un re-encolado reutiliza la misma key. */
  key: string;
  type: DrillExerciseType;
  word: VocabularyItem;
  /** mc_en_es: la palabra · mc_es_en: la traducción · fill_blank: frase con ____ */
  prompt: string;
  /** Traducción del hueco (fill_blank) para mostrarla de apoyo. */
  promptTranslation?: string;
  /** 4 opciones barajadas (solo tipos de elección). */
  options?: DrillOption[];
}

// --- utilidades de texto ---

const STOPWORDS = new Set([
  'de', 'la', 'el', 'en', 'un', 'una', 'que', 'los', 'las', 'del', 'con', 'por',
  'para', 'se', 'su', 'al', 'lo', 'es', 'no', 'te', 'me', 'tu', 'mi', 'mas',
  'muy', 'como', 'algo', 'alguien', 'ser', 'estar', 'hacer', 'dar', 'poner',
]);

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Palabras significativas de una traducción (para detectar solapes de sentido). */
export function senseWords(translation: string): Set<string> {
  const words = normalize(translationSummary(translation))
    .split(/[^a-zñ]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  return new Set(words);
}

/**
 * ¿Es `candidate` un distractor SEGURO para `target`? Rechaza si comparten
 * alguna palabra de sentido en la traducción (con polisemia, una opción
 * "incorrecta" podría ser también válida — intolerable) o si una palabra
 * contiene a la otra (take off / take off on).
 */
export function isSafeDistractor(target: VocabularyItem, candidate: VocabularyItem): boolean {
  if (candidate.id === target.id) return false;
  const tw = normalize(target.word);
  const cw = normalize(candidate.word);
  if (tw === cw || tw.includes(cw) || cw.includes(tw)) return false;
  const ts = senseWords(target.translation);
  for (const w of senseWords(candidate.translation)) {
    if (ts.has(w)) return false;
  }
  return true;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Elige 3 distractores seguros: misma categoría → mismo nivel → cualquiera. */
export function pickDistractors(
  target: VocabularyItem,
  pool: VocabularyItem[],
  n = 3
): VocabularyItem[] {
  // Prioridad: misma categoría Y misma clase de palabra (un sustantivo en el
  // hueco de un verbo delata la respuesta por gramática) → misma categoría →
  // mismo nivel → cualquiera.
  const pos = target.part_of_speech;
  const tiers = [
    pos ? pool.filter((p) => p.category === target.category && p.part_of_speech === pos) : [],
    pool.filter((p) => p.category === target.category),
    pool.filter((p) => p.category !== target.category && p.cefr_level === target.cefr_level),
    pool,
  ];
  const chosen: VocabularyItem[] = [];
  const used = new Set<string>();
  for (const tier of tiers) {
    for (const cand of shuffle(tier)) {
      if (chosen.length >= n) return chosen;
      if (used.has(cand.id)) continue;
      if (!isSafeDistractor(target, cand)) continue;
      // evitar dos distractores con el mismo sentido entre sí (dos "enfadado")
      if (chosen.some((c) => !isSafeDistractor(c, cand))) continue;
      chosen.push(cand);
      used.add(cand.id);
    }
  }
  return chosen; // puede devolver <n si el pool es minúsculo; el caller decide
}

/**
 * Frase de ejemplo con la palabra tapada (____). Solo si la frase contiene la
 * palabra EXACTA en forma base y contigua — con flexiones o separables, las
 * opciones (en forma base) delatarían/romperían la gramática del hueco.
 */
export function buildBlank(word: string, sentence: string): string | null {
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${esc}\\b`, 'i');
  if (!re.test(sentence)) return null;
  return sentence.replace(re, '____');
}

function mcEnEs(word: VocabularyItem, pool: VocabularyItem[]): DrillExercise | null {
  const distractors = pickDistractors(word, pool);
  if (distractors.length < 3) return null;
  return {
    key: `${word.id}:mc_en_es`,
    type: 'mc_en_es',
    word,
    prompt: word.word,
    options: shuffle([
      { text: translationSummary(word.translation), correct: true },
      ...distractors.map((d) => ({ text: translationSummary(d.translation), correct: false })),
    ]),
  };
}

function mcEsEn(word: VocabularyItem, pool: VocabularyItem[]): DrillExercise | null {
  const distractors = pickDistractors(word, pool);
  if (distractors.length < 3) return null;
  return {
    key: `${word.id}:mc_es_en`,
    type: 'mc_es_en',
    word,
    prompt: translationSummary(word.translation),
    options: shuffle([
      { text: word.word, correct: true },
      ...distractors.map((d) => ({ text: d.word, correct: false })),
    ]),
  };
}

function fillBlank(word: VocabularyItem, pool: VocabularyItem[]): DrillExercise | null {
  if (!word.example_sentence) return null;
  const blanked = buildBlank(word.word, word.example_sentence);
  if (!blanked) return null;
  const distractors = pickDistractors(word, pool);
  if (distractors.length < 3) return null;
  return {
    key: `${word.id}:fill_blank`,
    type: 'fill_blank',
    word,
    prompt: blanked,
    promptTranslation: word.example_translation,
    options: shuffle([
      { text: word.word, correct: true },
      ...distractors.map((d) => ({ text: d.word, correct: false })),
    ]),
  };
}

/**
 * Genera la cola del drill: 3 etapas (reconocer → comprender → producir), con
 * las palabras barajadas dentro de cada etapa. `pool` = vocabulario completo
 * para extraer distractores.
 */
export function generateDrill(words: VocabularyItem[], pool: VocabularyItem[]): DrillExercise[] {
  const stage1: DrillExercise[] = [];
  const stage2: DrillExercise[] = [];
  const stage3: DrillExercise[] = [];
  for (const w of words) {
    const mc = mcEnEs(w, pool);
    if (mc) stage1.push(mc);
    const comp = fillBlank(w, pool) ?? mcEsEn(w, pool);
    if (comp) stage2.push(comp);
    stage3.push({ key: `${w.id}:typing`, type: 'typing', word: w, prompt: w.word });
  }
  return [...shuffle(stage1), ...shuffle(stage2), ...shuffle(stage3)];
}
