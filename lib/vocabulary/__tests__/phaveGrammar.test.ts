import {
  formalSynonymLabel,
  separabilityNote,
  separabilityLabel,
} from '../phaveGrammar';

describe('formalSynonymLabel', () => {
  it('formatea el sinónimo con la marca de registro', () => {
    expect(formalSynonymLabel('postpone')).toBe('≈ postpone (formal)');
  });

  it('recorta espacios', () => {
    expect(formalSynonymLabel('  cancel  ')).toBe('≈ cancel (formal)');
  });

  it('devuelve null si no hay sinónimo', () => {
    expect(formalSynonymLabel(null)).toBeNull();
    expect(formalSynonymLabel(undefined)).toBeNull();
    expect(formalSynonymLabel('')).toBeNull();
    expect(formalSynonymLabel('   ')).toBeNull();
  });
});

describe('separabilityNote', () => {
  it('devuelve la nota según el tipo (insensible a mayúsculas)', () => {
    expect(separabilityNote('separable')).toContain('en medio');
    expect(separabilityNote('INSEPARABLE')).toContain('siempre después');
    expect(separabilityNote('intransitive')).toContain('no lleva objeto');
  });

  it('devuelve null para valores desconocidos o vacíos', () => {
    expect(separabilityNote(null)).toBeNull();
    expect(separabilityNote('')).toBeNull();
    expect(separabilityNote('maybe')).toBeNull();
  });
});

describe('separabilityLabel', () => {
  it('devuelve la etiqueta corta traducida', () => {
    expect(separabilityLabel('separable')).toBe('Separable');
    expect(separabilityLabel('inseparable')).toBe('Inseparable');
    expect(separabilityLabel('intransitive')).toBe('Intransitivo');
  });

  it('devuelve null para valores desconocidos', () => {
    expect(separabilityLabel('foo')).toBeNull();
    expect(separabilityLabel(undefined)).toBeNull();
  });
});
