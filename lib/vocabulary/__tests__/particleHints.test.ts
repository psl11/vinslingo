import { getParticleHint } from '../particleHints';

describe('getParticleHint', () => {
  it('devuelve la pista de la partícula final (give up → UP)', () => {
    const h = getParticleHint('give up');
    expect(h).toContain('UP');
  });

  it('reconoce distintas partículas', () => {
    expect(getParticleHint('turn off')).toContain('OFF');
    expect(getParticleHint('find out')).toContain('OUT');
    expect(getParticleHint('calm down')).toContain('DOWN');
    expect(getParticleHint('run into')).toContain('INTO');
    expect(getParticleHint('take apart')).toContain('APART');
  });

  it('no toma la primera palabra (el verbo) como partícula', () => {
    // "back up": la partícula es "up", no "back".
    expect(getParticleHint('back up')).toContain('UP');
    // "out of the blue" empieza por "out" pero no debe dar pista de OUT (es token 0).
    expect(getParticleHint('out of the blue')).toBeNull();
  });

  it('devuelve null para palabras simples o sin partícula conocida', () => {
    expect(getParticleHint('productive')).toBeNull();
    expect(getParticleHint('make a decision')).toBeNull();
    expect(getParticleHint('look forward to')).toBeNull();
  });
});
