// Mini-gramática de phrasal verbs para la ficha: sinónimo formal (cognado
// latino) + separabilidad. Lógica pura, testeable, fuera del componente.
//
// El sinónimo formal aprovecha que casi todo phrasal verb tiene un equivalente
// de una palabra de origen latino que el hispanohablante reconoce al instante
// (put off ≈ postpone ≈ posponer). Enseñarlos juntos fija el significado y, de
// paso, el registro: el phrasal es coloquial, el latino es formal.

// "≈ postpone (formal)" o null si no hay sinónimo.
export function formalSynonymLabel(synonym?: string | null): string | null {
  const s = synonym?.trim();
  return s ? `≈ ${s} (formal)` : null;
}

export type Separability = 'separable' | 'inseparable' | 'intransitive';

const SEPARABILITY_LABELS: Record<Separability, string> = {
  separable: 'Separable',
  inseparable: 'Inseparable',
  intransitive: 'Intransitivo',
};

function normalizeSeparability(sep?: string | null): Separability | null {
  const key = sep?.trim().toLowerCase();
  return key === 'separable' || key === 'inseparable' || key === 'intransitive'
    ? key
    : null;
}

// Nota explicativa completa para la ficha, con un ejemplo construido a partir
// del PROPIO phrasal (no uno genérico que no cuadre con la palabra). El
// pronombre "it" es la prueba de separabilidad: en los separables va en medio
// (take it off), en los inseparables va detrás (look after it). Devuelve null
// si la separabilidad no se reconoce o falta la palabra.
export function separabilityNote(sep?: string | null, word?: string): string | null {
  const key = normalizeSeparability(sep);
  if (!key) return null;
  const tokens = (word || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (key === 'intransitive') {
    return 'Intransitivo: no lleva objeto directo.';
  }
  if (tokens.length < 2) {
    // Sin verbo+partícula no podemos dar un ejemplo fiable: solo la etiqueta.
    return key === 'separable'
      ? 'Separable: el objeto puede ir en medio.'
      : 'Inseparable: el objeto va siempre después del phrasal.';
  }
  if (key === 'separable') {
    // "it" se intercala entre el verbo y el resto de la partícula.
    const ex = `${tokens[0]} it ${tokens.slice(1).join(' ')}`;
    return `Separable: el objeto puede ir en medio (${ex}).`;
  }
  // Inseparable: el objeto va después de todo el phrasal.
  return `Inseparable: el objeto va siempre después (${tokens.join(' ')} it).`;
}

// Etiqueta corta ("Separable" / "Inseparable" / "Intransitivo"), o null.
export function separabilityLabel(sep?: string | null): string | null {
  const key = normalizeSeparability(sep);
  return key ? SEPARABILITY_LABELS[key] : null;
}
