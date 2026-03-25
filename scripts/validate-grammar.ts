#!/usr/bin/env npx tsx
/**
 * Linguistic validation for Cambridge exercise seed data.
 * Uses the free LanguageTool API to grammar-check every exercise.
 *
 * Run with: npx tsx scripts/validate-grammar.ts
 *
 * Checks:
 * 1. CORRECT SENTENCE CHECK — The sentence with the answer filled in
 *    should be grammatically correct (no LanguageTool issues).
 * 2. AMBIGUITY CHECK — For exercises with options, only the correct
 *    answer should produce a grammatically valid sentence. If a
 *    distractor also produces a valid sentence, it is flagged.
 * 3. ERROR CORRECTION — The corrected sentence (answer) must be
 *    grammar-clean, and the original (with error) should trigger
 *    at least one LanguageTool issue.
 *
 * Rate-limited to respect the free API (20 req/s max → we use ~5/s).
 */

import { GAP_FILL_CONNECTORS } from '../lib/database/gapFillSeed';
import { OPEN_CLOZE_EXERCISES } from '../lib/database/openClozeSeed';
import { WORD_FORMATION_EXERCISES } from '../lib/database/wordFormationSeed';
import { KEY_WORD_TRANSFORM_EXERCISES } from '../lib/database/keyWordTransformSeed';
import { ERROR_CORRECTION_EXERCISES } from '../lib/database/errorCorrectionSeed';

// ─── LanguageTool API ────────────────────────────────────────────────

const LT_URL = 'https://api.languagetool.org/v2/check';

interface LTMatch {
  message: string;
  shortMessage: string;
  offset: number;
  length: number;
  rule: { id: string; description: string; category: { id: string } };
  replacements: { value: string }[];
}

interface LTResponse {
  matches: LTMatch[];
}

// Rules to ignore (too noisy / false positives for exercise sentences)
const IGNORED_RULES = new Set([
  'UPPERCASE_SENTENCE_START',   // We sometimes start with lowercase
  'PUNCTUATION_PARAGRAPH_END',  // Missing final period
  'EN_QUOTES',                  // Smart quotes
  'COMMA_PARENTHESIS_WHITESPACE',
  'MORFOLOGIK_RULE_EN_GB',     // Sometimes flags proper nouns / rare words
  'MORFOLOGIK_RULE_EN_US',
  'DASH_RULE',
  'WHITESPACE_RULE',
  'EN_UNPAIRED_BRACKETS',
  'SENTENCE_WHITESPACE',
  'UNLIKELY_OPENING_PUNCTUATION',
  'ENGLISH_WORD_REPEAT_BEGINNING_RULE',
  'OXFORD_SPELLING_Z_NOT_S',       // We use British English (Cambridge exams)
  'COMMA_COMPOUND_SENTENCE',       // Comma before "or/and" in compound sentences is optional in BrE
]);

async function checkGrammar(text: string): Promise<LTMatch[]> {
  const params = new URLSearchParams({
    text,
    language: 'en-GB',
    disabledRules: Array.from(IGNORED_RULES).join(','),
  });

  const res = await fetch(LT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    throw new Error(`LanguageTool API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as LTResponse;
  return data.matches.filter(m => !IGNORED_RULES.has(m.rule.id));
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Types ───────────────────────────────────────────────────────────

interface GenericExercise {
  id: string;
  sentence: string;
  answer: string;
  options: string | null;
  explanation: string;
  category: string;
  base_word?: string | null;
  context_sentence?: string | null;
}

// ─── Counters ────────────────────────────────────────────────────────

let totalErrors = 0;
let totalWarnings = 0;
let totalChecked = 0;

function error(cat: string, id: string, msg: string) {
  console.error(`  ❌ [${cat}] ${id}: ${msg}`);
  totalErrors++;
}

function warn(cat: string, id: string, msg: string) {
  console.warn(`  ⚠️  [${cat}] ${id}: ${msg}`);
  totalWarnings++;
}

function formatMatches(matches: LTMatch[]): string {
  return matches
    .map(m => `"${m.message}" [${m.rule.id}]`)
    .join('; ');
}

// ─── Check functions ─────────────────────────────────────────────────

/** Fill the gap and check the resulting sentence */
async function checkFilledSentence(ex: GenericExercise, cat: string) {
  const filled = ex.sentence.replace('___', ex.answer);
  const matches = await checkGrammar(filled);

  if (matches.length > 0) {
    error(cat, ex.id, `Grammar issues in correct sentence: "${filled}" → ${formatMatches(matches)}`);
  }
}

/** For exercises with options, check if distractors also produce valid sentences */
async function checkAmbiguity(ex: GenericExercise, cat: string) {
  if (!ex.options) return;

  let opts: string[];
  try { opts = JSON.parse(ex.options); } catch { return; }

  const distractors = opts.filter(
    o => o.toLowerCase().trim() !== ex.answer.toLowerCase().trim()
  );

  for (const d of distractors) {
    const filled = ex.sentence.replace('___', d);
    const matches = await checkGrammar(filled);
    await sleep(200);

    if (matches.length === 0) {
      warn(
        cat,
        ex.id,
        `Distractor "${d}" also produces a grammatically valid sentence: "${filled}"`
      );
    }
  }
}

/** Error Correction: corrected must be clean, original should have errors */
async function checkErrorCorrection(ex: GenericExercise, cat: string) {
  // 1. Corrected sentence should be clean
  const correctedMatches = await checkGrammar(ex.answer);
  if (correctedMatches.length > 0) {
    error(
      cat,
      ex.id,
      `Corrected sentence has grammar issues: "${ex.answer}" → ${formatMatches(correctedMatches)}`
    );
  }

  await sleep(200);

  // 2. Original sentence should have at least one issue
  const originalMatches = await checkGrammar(ex.sentence);
  if (originalMatches.length === 0) {
    warn(
      cat,
      ex.id,
      `LanguageTool did NOT detect any error in the "wrong" sentence: "${ex.sentence}"`
    );
  }
}

// ─── Main runner ─────────────────────────────────────────────────────

async function validateCategory(
  exercises: GenericExercise[],
  catName: string,
  isErrorCorrection = false,
  checkDistractors = false,
) {
  console.log(`\n── ${catName} (${exercises.length} exercises) ──`);

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    totalChecked++;

    if (isErrorCorrection) {
      await checkErrorCorrection(ex, catName);
    } else {
      await checkFilledSentence(ex, catName);
    }

    // Ambiguity check only for exercises with options
    if (checkDistractors && ex.options) {
      await checkAmbiguity(ex, catName);
    }

    // Rate limiting: ~4 requests per second
    await sleep(250);

    // Progress indicator every 20 exercises
    if ((i + 1) % 20 === 0) {
      process.stdout.write(`  ... checked ${i + 1}/${exercises.length}\n`);
    }
  }
}

async function main() {
  console.log('🔍 Linguistic validation via LanguageTool API...');
  console.log('   (this will take a few minutes — rate-limited to respect the free API)\n');

  // Test API connectivity first
  try {
    await checkGrammar('This is a test sentence.');
    console.log('✓ LanguageTool API reachable\n');
  } catch (e) {
    console.error('✗ Cannot reach LanguageTool API. Check your internet connection.');
    console.error(e);
    process.exit(1);
  }

  // 1. Connectors — has options, check distractors
  await validateCategory(
    GAP_FILL_CONNECTORS as GenericExercise[],
    'Connectors',
    false,
    true,
  );

  // 2. Open Cloze — no options
  await validateCategory(
    OPEN_CLOZE_EXERCISES as GenericExercise[],
    'Open Cloze',
    false,
    false,
  );

  // 3. Word Formation — has options, check distractors
  await validateCategory(
    WORD_FORMATION_EXERCISES as GenericExercise[],
    'Word Formation',
    false,
    true,
  );

  // 4. Key Word Transformation — no options
  await validateCategory(
    KEY_WORD_TRANSFORM_EXERCISES as GenericExercise[],
    'Key Word Transformation',
    false,
    false,
  );

  // 5. Error Correction — special handling
  await validateCategory(
    ERROR_CORRECTION_EXERCISES as GenericExercise[],
    'Error Correction',
    true,
    false,
  );

  // ─── Summary ─────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log(`  Exercises checked: ${totalChecked}`);
  console.log(`  Grammar errors:    ${totalErrors}`);
  console.log(`  Ambiguity warns:   ${totalWarnings}`);
  console.log('════════════════════════════════════════');

  if (totalErrors > 0) {
    console.log('\n💥 Linguistic validation found ERRORS — review above.');
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log('\n⚠️  Passed with warnings — review ambiguity/detection issues above.');
    process.exit(0);
  } else {
    console.log('\n✅ All exercises are grammatically correct!');
    process.exit(0);
  }
}

main();
