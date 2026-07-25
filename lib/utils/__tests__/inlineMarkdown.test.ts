import { parseInline, stripInline } from '../inlineMarkdown';

describe('parseInline', () => {
  it('deja el texto plano en un solo segmento', () => {
    expect(parseInline('sin marcas')).toEqual([{ text: 'sin marcas' }]);
  });

  it('reconoce negrita y cursiva', () => {
    expect(parseInline('un **grupo** de *rock*')).toEqual([
      { text: 'un ' },
      { text: 'grupo', bold: true },
      { text: ' de ' },
      { text: 'rock', italic: true },
    ]);
  });

  it('no parte la negrita en dos cursivas', () => {
    // El fallo clásico: `*` casando con el primer asterisco de `**`.
    expect(parseInline('**Ficha técnica**')).toEqual([{ text: 'Ficha técnica', bold: true }]);
  });

  it('mantiene los asteriscos sueltos tal cual', () => {
    expect(stripInline('2 * 3 = 6')).toBe('2 * 3 = 6');
  });

  it('stripInline quita las marcas y conserva el texto', () => {
    expect(stripInline('**Se llamaba *Wishing Stone*.**')).toBe('Se llamaba Wishing Stone.');
  });

  it('aguanta una cadena vacía', () => {
    expect(stripInline('')).toBe('');
  });
});
