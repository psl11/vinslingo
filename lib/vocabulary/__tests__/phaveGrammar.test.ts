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
  it('construye el ejemplo con el verbo de la PROPIA palabra', () => {
    // El ejemplo debe usar "take off", no un phrasal genérico ajeno.
    expect(separabilityNote('separable', 'take off')).toBe(
      'Separable: el objeto puede ir en medio (take it off).'
    );
    expect(separabilityNote('separable', 'put together')).toBe(
      'Separable: el objeto puede ir en medio (put it together).'
    );
  });

  it('en inseparables pone "it" después de todo el phrasal', () => {
    expect(separabilityNote('inseparable', 'look after')).toBe(
      'Inseparable: el objeto va siempre después (look after it).'
    );
    expect(separabilityNote('INSEPARABLE', 'look forward to')).toContain(
      'look forward to it'
    );
  });

  it('en intransitivos no muestra ejemplo con objeto', () => {
    expect(separabilityNote('intransitive', 'break down')).toBe(
      'Intransitivo: no lleva objeto directo.'
    );
  });

  it('sin verbo+partícula cae a la etiqueta sin ejemplo', () => {
    expect(separabilityNote('separable', 'run')).toBe(
      'Separable: el objeto puede ir en medio.'
    );
    expect(separabilityNote('separable')).toBe(
      'Separable: el objeto puede ir en medio.'
    );
  });

  it('devuelve null para valores desconocidos o vacíos', () => {
    expect(separabilityNote(null, 'take off')).toBeNull();
    expect(separabilityNote('', 'take off')).toBeNull();
    expect(separabilityNote('maybe', 'take off')).toBeNull();
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
