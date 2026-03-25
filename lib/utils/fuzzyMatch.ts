// Levenshtein distance for fuzzy matching user input
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

export type MatchResult = 'exact' | 'close' | 'wrong';

export interface MatchInfo {
  result: MatchResult;
  distance: number;
  normalizedInput: string;
  normalizedAnswer: string;
}

// Normalize text for comparison: lowercase, trim, collapse whitespace
function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['']/g, "'"); // normalize quotes
}

// Compare user input against the correct answer
// For multi-word answers (e.g. "make a decision"), also accepts without articles
export function matchAnswer(input: string, correctAnswer: string): MatchInfo {
  const normalizedInput = normalize(input);
  
  // The correct answer might contain slashes for alternatives (e.g. "hacer / realizar")
  // or parenthetical clarifications. We check against the primary word.
  const alternatives = correctAnswer
    .split('/')
    .map(s => s.trim())
    .map(normalize);

  let bestDistance = Infinity;
  let bestNormalized = alternatives[0];

  for (const alt of alternatives) {
    // Strip parenthetical content for matching: "en realidad (NO actualmente)" -> "en realidad"
    const cleaned = alt.replace(/\(.*?\)/g, '').trim();
    const dist = levenshtein(normalizedInput, cleaned);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestNormalized = cleaned;
    }
  }

  // Determine threshold based on answer length
  const len = bestNormalized.length;
  const closeThreshold = len <= 4 ? 1 : len <= 8 ? 2 : 3;

  let result: MatchResult;
  if (bestDistance === 0) {
    result = 'exact';
  } else if (bestDistance <= closeThreshold) {
    result = 'close';
  } else {
    result = 'wrong';
  }

  return {
    result,
    distance: bestDistance,
    normalizedInput,
    normalizedAnswer: bestNormalized,
  };
}
