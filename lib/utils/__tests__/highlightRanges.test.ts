import { highlightRanges } from '../highlight';

describe('highlightRanges', () => {
  it('devuelve los rangos ordenados por posición', () => {
    const line = 'Slowly walking down the hall, faster than a cannonball';
    expect(highlightRanges(line, ['cannonball', 'walking'])).toEqual([
      [7, 14],
      [44, 54],
    ]);
  });

  it('descarta el término que se solaparía con otro ya encontrado', () => {
    // "give up" y "give" pisan el mismo trozo: solapar rompería el troceado.
    const r = highlightRanges('Never give up on it', ['give up', 'give']);
    expect(r).toEqual([[6, 13]]);
  });

  it('ignora los términos que no aparecen', () => {
    expect(highlightRanges('Live forever', ['forever', 'nope'])).toEqual([[5, 12]]);
  });

  it('prefiere la ocurrencia con límite de palabra, no la subcadena', () => {
    // "ill" está dentro de "Fulfilled" (índice 4) y suelto al final (índice 18).
    // Debe elegir el suelto, que es el comportamiento heredado de highlightRange.
    expect(highlightRanges('Fulfilled, I feel ill', ['ill'])).toEqual([[18, 21]]);
  });

  it('aguanta una lista vacía o con nulos', () => {
    expect(highlightRanges('Anything', [])).toEqual([]);
    expect(highlightRanges('Anything', [null, undefined])).toEqual([]);
  });
});
