import { anchorIcon, anchorIsSong, anchorCredit } from '../anchor';

describe('anchorIcon', () => {
  it('devuelve el icono según el tipo', () => {
    expect(anchorIcon('movie')).toBe('🎬');
    expect(anchorIcon('book')).toBe('📖');
    expect(anchorIcon('song')).toBe('🎵');
  });

  it('sin tipo (canción por defecto) → 🎵', () => {
    expect(anchorIcon(null)).toBe('🎵');
    expect(anchorIcon(undefined)).toBe('🎵');
  });
});

describe('anchorIsSong', () => {
  it('canción o sin tipo → true (muestra Spotify)', () => {
    expect(anchorIsSong('song')).toBe(true);
    expect(anchorIsSong(null)).toBe(true);
    expect(anchorIsSong(undefined)).toBe(true);
  });

  it('película o libro → false', () => {
    expect(anchorIsSong('movie')).toBe(false);
    expect(anchorIsSong('book')).toBe(false);
  });
});

describe('anchorCredit', () => {
  it('solo título', () => {
    expect(anchorCredit('Título')).toBe('Título');
  });

  it('título + autor', () => {
    expect(anchorCredit('Comedown', 'Bush')).toBe('Comedown (Bush)');
  });

  it('título + autor + año', () => {
    expect(anchorCredit('Get Out', 'Jordan Peele', 2017)).toBe('Get Out (Jordan Peele, 2017)');
  });

  it('título + año sin autor → conserva el año (antes se perdía)', () => {
    expect(anchorCredit('Up', null, 2009)).toBe('Up (2009)');
  });

  it('ignora autor/año vacíos', () => {
    expect(anchorCredit('Título', '', undefined)).toBe('Título');
  });
});
