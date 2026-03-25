#!/usr/bin/env npx tsx
/**
 * Validation script for Cambridge exercise seed data.
 * Run with: npx tsx scripts/validate-seeds.ts
 *
 * Checks:
 * 1. No duplicate IDs (within or across categories)
 * 2. No duplicate sentences
 * 3. All required fields present and non-empty
 * 4. answer is included in options (when options exist)
 * 5. Sentence contains exactly one gap (___)
 * 6. answer fits the gap in the sentence (basic string check)
 * 7. base_word appears in the answer (Key Word Transformation)
 * 8. Error Correction: base_word (error) is in the original sentence
 * 9. Error Correction: corrected sentence (answer) differs from original
 * 10. CEFR level is valid
 * 11. Difficulty is 1, 2, or 3
 * 12. Options JSON is valid and has exactly 4 items (when present)
 */

import { GAP_FILL_CONNECTORS } from '../lib/database/gapFillSeed';
import { OPEN_CLOZE_EXERCISES } from '../lib/database/openClozeSeed';
import { WORD_FORMATION_EXERCISES } from '../lib/database/wordFormationSeed';
import { KEY_WORD_TRANSFORM_EXERCISES } from '../lib/database/keyWordTransformSeed';
import { ERROR_CORRECTION_EXERCISES } from '../lib/database/errorCorrectionSeed';
import { OFFICIAL_CAMBRIDGE_EXERCISES } from '../lib/database/officialCambridgeSeed';

// ─── Types ───────────────────────────────────────────────────────────
interface GenericExercise {
  id: string;
  sentence: string;
  answer: string;
  options: string | null;
  explanation: string;
  explanation_es: string;
  cefr_level: string;
  category: string;
  difficulty: number;
  base_word?: string | null;
  context_sentence?: string | null;
}

const VALID_CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const VALID_DIFFICULTIES = [1, 2, 3];

let totalErrors = 0;
let totalWarnings = 0;

function error(category: string, id: string, msg: string) {
  console.error(`  ❌ [${category}] ${id}: ${msg}`);
  totalErrors++;
}

function warn(category: string, id: string, msg: string) {
  console.warn(`  ⚠️  [${category}] ${id}: ${msg}`);
  totalWarnings++;
}

// ─── Validators ──────────────────────────────────────────────────────

function validateRequiredFields(ex: GenericExercise, cat: string) {
  if (!ex.id) error(cat, '???', 'Missing id');
  if (!ex.sentence) error(cat, ex.id, 'Missing sentence');
  if (!ex.answer) error(cat, ex.id, 'Missing answer');
  if (!ex.explanation) error(cat, ex.id, 'Missing explanation');
  if (!ex.explanation_es) error(cat, ex.id, 'Missing explanation_es');
  if (!ex.cefr_level) error(cat, ex.id, 'Missing cefr_level');
  if (!ex.category) error(cat, ex.id, 'Missing category');
  if (ex.difficulty == null) error(cat, ex.id, 'Missing difficulty');
}

function validateCefrAndDifficulty(ex: GenericExercise, cat: string) {
  if (!VALID_CEFR.includes(ex.cefr_level)) {
    error(cat, ex.id, `Invalid CEFR level: "${ex.cefr_level}"`);
  }
  if (!VALID_DIFFICULTIES.includes(ex.difficulty)) {
    error(cat, ex.id, `Invalid difficulty: ${ex.difficulty} (must be 1-3)`);
  }
}

function validateGap(ex: GenericExercise, cat: string) {
  const gapCount = (ex.sentence.match(/___/g) || []).length;
  if (gapCount === 0) {
    error(cat, ex.id, `Sentence has no gap (___): "${ex.sentence}"`);
  } else if (gapCount > 1) {
    warn(cat, ex.id, `Sentence has ${gapCount} gaps (expected 1): "${ex.sentence}"`);
  }
}

function validateOptions(ex: GenericExercise, cat: string) {
  if (ex.options === null) return; // Open Cloze / KWT — no options expected
  
  let parsed: string[];
  try {
    parsed = JSON.parse(ex.options);
  } catch {
    error(cat, ex.id, `Invalid JSON in options: ${ex.options}`);
    return;
  }

  if (!Array.isArray(parsed)) {
    error(cat, ex.id, 'Options is not an array');
    return;
  }

  if (parsed.length !== 4) {
    warn(cat, ex.id, `Options has ${parsed.length} items (expected 4)`);
  }

  // Check answer is among options
  const normalised = parsed.map(o => o.toLowerCase().trim());
  if (!normalised.includes(ex.answer.toLowerCase().trim())) {
    error(cat, ex.id, `Answer "${ex.answer}" not found in options: ${ex.options}`);
  }

  // Check for duplicate options
  const unique = new Set(normalised);
  if (unique.size !== parsed.length) {
    error(cat, ex.id, `Duplicate options detected: ${ex.options}`);
  }
}

function validateAnswerFitsGap(ex: GenericExercise, cat: string) {
  // Build the full sentence by replacing ___ with the answer
  const filled = ex.sentence.replace('___', ex.answer);
  // Basic: the filled sentence should be different from the original
  if (filled === ex.sentence) {
    error(cat, ex.id, 'Replacing ___ with answer produces the same sentence');
  }
}

function validateKWT(ex: GenericExercise, cat: string) {
  if (!ex.base_word) {
    error(cat, ex.id, 'Key Word Transformation missing base_word (keyword)');
    return;
  }
  if (!ex.context_sentence) {
    error(cat, ex.id, 'Key Word Transformation missing context_sentence (original)');
    return;
  }
  // The keyword (or its stem/inflection) should appear in the answer
  const kw = ex.base_word.toLowerCase();
  const ans = ex.answer.toLowerCase();
  // Check exact match first, then stem (first 4+ chars)
  const stem = kw.length >= 4 ? kw.slice(0, Math.max(4, Math.floor(kw.length * 0.6))) : kw;
  if (!ans.includes(kw) && !ans.includes(stem)) {
    warn(cat, ex.id, `Keyword "${ex.base_word}" (stem: "${stem}") not found in answer "${ex.answer}"`);
  }
}

function validateErrorCorrectionOptions(ex: GenericExercise, cat: string) {
  if (ex.options === null) return;

  let parsed: string[];
  try {
    parsed = JSON.parse(ex.options);
  } catch {
    error(cat, ex.id, `Invalid JSON in options: ${ex.options}`);
    return;
  }

  if (!Array.isArray(parsed)) {
    error(cat, ex.id, 'Options is not an array');
    return;
  }

  if (parsed.length !== 4) {
    warn(cat, ex.id, `Options has ${parsed.length} items (expected 4)`);
  }

  // context_sentence (the correction) should be among options
  if (ex.context_sentence) {
    const normalised = parsed.map(o => o.toLowerCase().trim());
    if (!normalised.includes(ex.context_sentence.toLowerCase().trim())) {
      error(cat, ex.id, `Correction "${ex.context_sentence}" not found in options: ${ex.options}`);
    }
  }

  // The error (base_word) should appear in at least one option (substring match ok)
  if (ex.base_word) {
    const bw = ex.base_word.toLowerCase().trim();
    const found = parsed.some(o => o.toLowerCase().trim().includes(bw) || bw.includes(o.toLowerCase().trim()));
    if (!found) {
      warn(cat, ex.id, `Error word "${ex.base_word}" not found in any option: ${ex.options}`);
    }
  }

  // Check for duplicate options
  const unique = new Set(parsed.map(o => o.toLowerCase().trim()));
  if (unique.size !== parsed.length) {
    error(cat, ex.id, `Duplicate options detected: ${ex.options}`);
  }
}

function validateErrorCorrection(ex: GenericExercise, cat: string) {
  if (!ex.base_word) {
    error(cat, ex.id, 'Error Correction missing base_word (the error)');
    return;
  }
  // The error should appear in the incorrect sentence
  if (!ex.sentence.includes(ex.base_word)) {
    warn(cat, ex.id, `Error "${ex.base_word}" not found in sentence: "${ex.sentence}"`);
  }
  // The corrected sentence should be different
  if (ex.sentence === ex.answer) {
    error(cat, ex.id, 'Corrected sentence is identical to original');
  }
  // context_sentence (correction) should appear in answer
  if (ex.context_sentence && ex.context_sentence.length > 0) {
    if (!ex.answer.toLowerCase().includes(ex.context_sentence.toLowerCase())) {
      warn(cat, ex.id, `Correction "${ex.context_sentence}" not found in corrected sentence: "${ex.answer}"`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────

function validateCategory(
  exercises: GenericExercise[],
  catName: string,
  extra?: (ex: GenericExercise, cat: string) => void
) {
  const isErrorCorrection = catName.includes('Error Correction');
  console.log(`\n── ${catName} (${exercises.length} exercises) ──`);

  const ids = new Set<string>();
  const sentences = new Set<string>();

  for (const ex of exercises) {
    // Duplicate ID
    if (ids.has(ex.id)) {
      error(catName, ex.id, 'Duplicate ID');
    }
    ids.add(ex.id);

    // Duplicate sentence
    const normSentence = ex.sentence.toLowerCase().trim();
    if (sentences.has(normSentence)) {
      warn(catName, ex.id, `Duplicate sentence: "${ex.sentence}"`);
    }
    sentences.add(normSentence);

    validateRequiredFields(ex, catName);
    validateCefrAndDifficulty(ex, catName);

    if (isErrorCorrection) {
      // Error Correction: no gap expected, special validation
      validateErrorCorrectionOptions(ex, catName);
    } else {
      validateGap(ex, catName);
      validateOptions(ex, catName);
      validateAnswerFitsGap(ex, catName);
    }

    if (extra) extra(ex, catName);
  }
}

console.log('🔍 Validating Cambridge exercise seed data...\n');

// Also check for cross-category duplicate IDs
const allIds = new Set<string>();
const allExercises: GenericExercise[] = [
  ...GAP_FILL_CONNECTORS as GenericExercise[],
  ...OPEN_CLOZE_EXERCISES as GenericExercise[],
  ...WORD_FORMATION_EXERCISES as GenericExercise[],
  ...KEY_WORD_TRANSFORM_EXERCISES as GenericExercise[],
  ...ERROR_CORRECTION_EXERCISES as GenericExercise[],
  ...OFFICIAL_CAMBRIDGE_EXERCISES as GenericExercise[],
];

for (const ex of allExercises) {
  if (allIds.has(ex.id)) {
    error('GLOBAL', ex.id, 'Duplicate ID across categories');
  }
  allIds.add(ex.id);
}

// Per-category validation
validateCategory(GAP_FILL_CONNECTORS as GenericExercise[], 'Connectors');
validateCategory(OPEN_CLOZE_EXERCISES as GenericExercise[], 'Open Cloze');
validateCategory(WORD_FORMATION_EXERCISES as GenericExercise[], 'Word Formation');
validateCategory(
  KEY_WORD_TRANSFORM_EXERCISES as GenericExercise[],
  'Key Word Transformation',
  validateKWT
);
validateCategory(
  ERROR_CORRECTION_EXERCISES as GenericExercise[],
  'Error Correction',
  validateErrorCorrection
);

// Official Cambridge — split by category for proper validation
const offConn = OFFICIAL_CAMBRIDGE_EXERCISES.filter(e => e.category === 'connector');
const offOC = OFFICIAL_CAMBRIDGE_EXERCISES.filter(e => e.category === 'open_cloze');
const offWF = OFFICIAL_CAMBRIDGE_EXERCISES.filter(e => e.category === 'word_formation');
const offKWT = OFFICIAL_CAMBRIDGE_EXERCISES.filter(e => e.category === 'key_word_transformation');
const offEC = OFFICIAL_CAMBRIDGE_EXERCISES.filter(e => e.category === 'error_correction');

validateCategory(offConn as GenericExercise[], 'Official — Connectors');
validateCategory(offOC as GenericExercise[], 'Official — Open Cloze');
validateCategory(offWF as GenericExercise[], 'Official — Word Formation');
validateCategory(offKWT as GenericExercise[], 'Official — Key Word Transformation', validateKWT);
validateCategory(offEC as GenericExercise[], 'Official — Error Correction', validateErrorCorrection);

// ─── Summary ─────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════');
console.log(`  Total exercises: ${allExercises.length}`);
console.log(`  Errors:   ${totalErrors}`);
console.log(`  Warnings: ${totalWarnings}`);
console.log('════════════════════════════════════════');

if (totalErrors > 0) {
  console.log('\n💥 Validation FAILED — fix the errors above.');
  process.exit(1);
} else if (totalWarnings > 0) {
  console.log('\n⚠️  Validation PASSED with warnings — review them above.');
  process.exit(0);
} else {
  console.log('\n✅ All exercises passed validation!');
  process.exit(0);
}
