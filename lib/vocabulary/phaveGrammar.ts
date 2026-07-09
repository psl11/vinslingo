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

const SEPARABILITY_NOTES: Record<Separability, string> = {
  separable:
    'Separable: el objeto puede ir en medio (turn the light off / turn it off).',
  inseparable:
    'Inseparable: el objeto va siempre después del phrasal (look after him).',
  intransitive: 'Intransitivo: no lleva objeto (the car broke down).',
};

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

// Nota explicativa completa (para mostrar en la ficha), o null.
export function separabilityNote(sep?: string | null): string | null {
  const key = normalizeSeparability(sep);
  return key ? SEPARABILITY_NOTES[key] : null;
}

// Etiqueta corta ("Separable" / "Inseparable" / "Intransitivo"), o null.
export function separabilityLabel(sep?: string | null): string | null {
  const key = normalizeSeparability(sep);
  return key ? SEPARABILITY_LABELS[key] : null;
}
