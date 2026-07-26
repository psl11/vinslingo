import { hasScript, scriptKey, countScriptsByArtist } from '../scriptIndex';

describe('scriptIndex', () => {
  it('encuentra un guion que existe', () => {
    expect(hasScript('Wonderwall', 'Oasis')).toBe(true);
  });

  it('normaliza acentos, apóstrofos y signos', () => {
    expect(hasScript("D'You Know What I Mean?", 'Oasis')).toBe(true);
    expect(hasScript('dyou know what i mean', 'oasis')).toBe(true);
  });

  it('usa solo el artista principal cuando viene compuesto', () => {
    // El catálogo trae "Jay-Z, Kanye West"; el guion se escribe para el primero.
    expect(hasScript('99 Problems', 'JAY-Z, Kanye West')).toBe(true);
  });

  it('devuelve false para lo que no tiene guion', () => {
    expect(hasScript('Canción Inventada', 'Oasis')).toBe(false);
    expect(hasScript('Wonderwall', 'The Beatles')).toBe(false);
  });

  it('aguanta título o artista vacíos', () => {
    expect(hasScript(undefined, 'Oasis')).toBe(false);
    expect(hasScript('Wonderwall', null)).toBe(false);
  });

  it('scriptKey produce la clave título|artista normalizada', () => {
    expect(scriptKey('Hey Jude', 'The Beatles')).toBe('heyjude|thebeatles');
  });

  it('cuenta guiones por artista', () => {
    // Oasis está completo, así que es el que más tiene.
    expect(countScriptsByArtist('Oasis')).toBeGreaterThan(20);
    expect(countScriptsByArtist('Artista Inexistente')).toBe(0);
    expect(countScriptsByArtist(null)).toBe(0);
  });
});
