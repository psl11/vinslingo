import {
  isSafeDistractor,
  pickDistractors,
  buildBlank,
  senseWords,
  generateDrill,
} from '../exerciseGenerator';
import type { VocabularyItem } from '../../../stores/useStudyStore';

const v = (over: Partial<VocabularyItem>): VocabularyItem =>
  ({
    id: over.id ?? Math.random().toString(36).slice(2),
    word: 'placeholder',
    translation: 'traducción',
    cefr_level: 'B1',
    category: 'phave',
    ...over,
  } as VocabularyItem);

describe('senseWords', () => {
  it('extrae palabras significativas de la traducción, sin stopwords', () => {
    const s = senseWords('SOLTAR / DEJAR ESCAPAR — "She let out a scream" = soltó un grito');
    expect(s.has('soltar')).toBe(true);
    expect(s.has('dejar')).toBe(true);
    expect(s.has('un')).toBe(false);
  });

  it('normaliza acentos (surgió ≈ surgio)', () => {
    const s = senseWords('SURGIR — algo surgió');
    expect(s.has('surgir')).toBe(true);
  });
});

describe('isSafeDistractor (anti-polisemia)', () => {
  const target = v({ id: 't', word: 'let out', translation: 'SOLTAR / DEJAR ESCAPAR' });

  it('rechaza un candidato cuya traducción comparte sentido', () => {
    const cand = v({ id: 'c1', word: 'release', translation: 'SOLTAR / LIBERAR' });
    expect(isSafeDistractor(target, cand)).toBe(false);
  });

  it('acepta un candidato con sentido disjunto', () => {
    const cand = v({ id: 'c2', word: 'pick up', translation: 'RECOGER / APRENDER ALGO' });
    expect(isSafeDistractor(target, cand)).toBe(true);
  });

  it('rechaza palabras que se contienen (take off vs take off on)', () => {
    const t2 = v({ id: 't2', word: 'take off', translation: 'DESPEGAR' });
    const cand = v({ id: 'c3', word: 'take', translation: 'TOMAR' });
    expect(isSafeDistractor(t2, cand)).toBe(false);
  });

  it('rechaza el propio target', () => {
    expect(isSafeDistractor(target, target)).toBe(false);
  });
});

describe('pickDistractors', () => {
  it('prefiere la misma categoría y nunca devuelve inseguras', () => {
    const target = v({ id: 't', word: 'let out', translation: 'SOLTAR', category: 'phave' });
    const pool = [
      v({ id: 'a', word: 'give up', translation: 'RENDIRSE', category: 'phave' }),
      v({ id: 'b', word: 'find out', translation: 'DESCUBRIR', category: 'phave' }),
      v({ id: 'c', word: 'set free', translation: 'SOLTAR A ALGUIEN', category: 'phave' }), // insegura
      v({ id: 'd', word: 'run out', translation: 'AGOTARSE', category: 'phave' }),
      v({ id: 'e', word: 'kidney', translation: 'RIÑÓN', category: 'ngsl' }),
    ];
    const picked = pickDistractors(target, pool);
    expect(picked).toHaveLength(3);
    expect(picked.map((p) => p.id)).not.toContain('c');
    expect(picked.every((p) => p.category === 'phave')).toBe(true);
  });

  it('evita dos distractores con el mismo sentido entre sí', () => {
    const target = v({ id: 't', word: 'let out', translation: 'SOLTAR' });
    const pool = [
      v({ id: 'a', word: 'give up', translation: 'RENDIRSE' }),
      v({ id: 'b', word: 'surrender', translation: 'RENDIRSE ANTE ALGO' }), // duplicaría sentido con 'a'
      v({ id: 'd', word: 'run out', translation: 'AGOTARSE' }),
      v({ id: 'e', word: 'find out', translation: 'DESCUBRIR' }),
    ];
    const picked = pickDistractors(target, pool);
    const senses = picked.map((p) => [...senseWords(p.translation)].sort().join(','));
    expect(new Set(senses).size).toBe(picked.length);
  });
});

describe('buildBlank', () => {
  it('tapa la palabra exacta en forma base (multipalabra contigua)', () => {
    expect(buildBlank('let out', 'She let out a scream.')).toBe('She ____ a scream.');
  });

  it('devuelve null si la frase solo tiene una flexión', () => {
    expect(buildBlank('let out', 'She lets out a scream.')).toBeNull();
  });

  it('devuelve null si el phrasal va separado', () => {
    expect(buildBlank('take off', 'Take your shoes off.')).toBeNull();
  });

  it('no confunde subcadenas (in vs going)', () => {
    expect(buildBlank('in', 'Going home now.')).toBeNull();
  });
});

describe('generateDrill', () => {
  it('genera 3 etapas por palabra y escala reconocer→comprender→producir', () => {
    const pool = [
      v({ id: 'a', word: 'give up', translation: 'RENDIRSE', example_sentence: 'Never give up.' }),
      v({ id: 'b', word: 'find out', translation: 'DESCUBRIR', example_sentence: 'I found out late.' }),
      v({ id: 'c', word: 'run out', translation: 'AGOTARSE', example_sentence: 'We run out of milk.' }),
      v({ id: 'd', word: 'let out', translation: 'SOLTAR', example_sentence: 'She let out a scream.' }),
      v({ id: 'e', word: 'pick up', translation: 'RECOGER', example_sentence: 'Pick up the phone.' }),
    ];
    const words = [pool[0], pool[3]];
    const drill = generateDrill(words, pool);
    // 3 ejercicios por palabra
    expect(drill).toHaveLength(6);
    // etapa 1 primero (mc_en_es), typing al final
    expect(drill.slice(0, 2).every((e) => e.type === 'mc_en_es')).toBe(true);
    expect(drill.slice(4).every((e) => e.type === 'typing')).toBe(true);
    // los de elección llevan exactamente 4 opciones con 1 correcta
    for (const ex of drill.filter((e) => e.options)) {
      expect(ex.options).toHaveLength(4);
      expect(ex.options!.filter((o) => o.correct)).toHaveLength(1);
    }
  });

  it('cae a mc_es_en cuando la frase no permite hueco', () => {
    const pool = [
      v({ id: 'a', word: 'give up', translation: 'RENDIRSE' }),
      v({ id: 'b', word: 'find out', translation: 'DESCUBRIR' }),
      v({ id: 'c', word: 'run out', translation: 'AGOTARSE' }),
      v({ id: 'd', word: 'let out', translation: 'SOLTAR', example_sentence: 'She lets out a scream.' }),
    ];
    const drill = generateDrill([pool[3]], pool);
    expect(drill.map((e) => e.type)).toEqual(['mc_en_es', 'mc_es_en', 'typing']);
  });
});
