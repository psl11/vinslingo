import { analyzeTranslation, translationSummary } from '../translationParser';

describe('analyzeTranslation', () => {
  describe('texto simple (raw)', () => {
    it('una palabra suelta es "raw"', () => {
      const a = analyzeTranslation('productivo');
      expect(a.kind).toBe('raw');
      if (a.kind === 'raw') expect(a.text).toBe('productivo');
    });

    it('traducción con "/" pero sin " — " sigue siendo raw (no separa sinónimos)', () => {
      // Un idiom/expression tipo "de repente / de la nada" no debe tratarse como acepciones.
      const a = analyzeTranslation('de repente / de la nada');
      expect(a.kind).toBe('raw');
    });
  });

  describe('término + explicación (monosémico)', () => {
    it('separa el título de la explicación por el em dash', () => {
      const a = analyzeTranslation(
        'SEGUIR / CONTINUAR — Se usa para pedir que alguien siga hablando.'
      );
      expect(a.kind).toBe('term');
      if (a.kind === 'term') {
        expect(a.term).toBe('SEGUIR / CONTINUAR');
        expect(a.explanation).toBe('Se usa para pedir que alguien siga hablando.');
      }
    });

    it('una sola acepción numerada ("1)" sin "2)") NO es multi-acepción', () => {
      // turn on / wipe out: llevan "1)" pero una única acepción.
      const a = analyzeTranslation('ENCENDER — 1) Poner en marcha: "Turn on the TV" = enciende la tele.');
      expect(a.kind).toBe('term');
    });
  });

  describe('varias acepciones numeradas (senses)', () => {
    const t =
      'DEJAR (a alguien o algo) / QUEDARSE DORMIDO — 1) Llevar y dejar en un sitio: "I\'ll drop you off at the station" = te dejo en la estación. "drop off the kids at school" = dejar a los niños en el cole. 2) Quedarse dormido sin querer: "I dropped off in front of the TV" = me quedé frito delante de la tele. (Ventas que "drop off" = que bajan.)';

    it('detecta el tipo y el nº de acepciones', () => {
      const a = analyzeTranslation(t);
      expect(a.kind).toBe('senses');
      if (a.kind !== 'senses') return;
      expect(a.header).toBe('DEJAR (a alguien o algo) / QUEDARSE DORMIDO');
      expect(a.senses).toHaveLength(2);
    });

    it('cada acepción lleva su descripción y sus ejemplos EN/ES', () => {
      const a = analyzeTranslation(t);
      if (a.kind !== 'senses') throw new Error('esperaba senses');
      expect(a.senses[0].n).toBe('1');
      expect(a.senses[0].desc).toBe('Llevar y dejar en un sitio');
      expect(a.senses[0].examples).toEqual([
        { en: "I'll drop you off at the station", es: 'te dejo en la estación' },
        { en: 'drop off the kids at school', es: 'dejar a los niños en el cole' },
      ]);
      expect(a.senses[1].examples).toEqual([
        { en: 'I dropped off in front of the TV', es: 'me quedé frito delante de la tele' },
      ]);
    });

    it('extrae la nota final entre paréntesis fuera de las acepciones', () => {
      const a = analyzeTranslation(t);
      if (a.kind !== 'senses') throw new Error('esperaba senses');
      expect(a.note).toBe('(Ventas que "drop off" = que bajan.)');
      // La nota no debe quedar pegada al último ejemplo.
      expect(a.senses[1].examples[0].es).toBe('me quedé frito delante de la tele');
    });

    it('recorta una nota tras el ejemplo que empieza con mayúscula (no la mete en el español)', () => {
      // "take apart": ... = la película. Opuesto: "put together".
      const t2 =
        'DESMONTAR / HACER TRIZAS — 1) Separar en piezas: "He took apart the engine" = desmontó el motor. 2) Hacer trizas: "The critics took the film apart" = la crítica hizo trizas la película. Opuesto: "put together".';
      const a = analyzeTranslation(t2);
      if (a.kind !== 'senses') throw new Error('esperaba senses');
      expect(a.senses[1].examples[0].es).toBe('la crítica hizo trizas la película');
    });

    it('conserva signos de interrogación en el español del ejemplo', () => {
      const t3 =
        'OPINAR / PENSAR EN — 1) Opinar sobre algo: "What do you think of this?" = ¿qué opinas de esto? 2) Considerar: "I\'m thinking of leaving" = estoy pensando en irme.';
      const a = analyzeTranslation(t3);
      if (a.kind !== 'senses') throw new Error('esperaba senses');
      expect(a.senses[0].examples[0].es).toBe('¿qué opinas de esto?');
    });
  });

  describe('pares confusos (comparison)', () => {
    it('separa por " | " en términos = definición', () => {
      const a = analyzeTranslation(
        'LEND = prestar (gratis) | RENT = alquilar (largo plazo) | HIRE = contratar/alquilar (corto)'
      );
      expect(a.kind).toBe('comparison');
      if (a.kind !== 'comparison') return;
      expect(a.items).toEqual([
        { term: 'LEND', def: 'prestar (gratis)' },
        { term: 'RENT', def: 'alquilar (largo plazo)' },
        { term: 'HIRE', def: 'contratar/alquilar (corto)' },
      ]);
    });

    it('soporta el formato "TÉRMINO + patrón" (sin "=")', () => {
      const a = analyzeTranslation('DURING + sustantivo | WHILE + oración');
      if (a.kind !== 'comparison') throw new Error('esperaba comparison');
      expect(a.items[0]).toEqual({ term: 'DURING + sustantivo', def: null });
      expect(a.items[1]).toEqual({ term: 'WHILE + oración', def: null });
    });
  });
});

describe('translationSummary', () => {
  it('raw: devuelve el texto tal cual', () => {
    expect(translationSummary('productivo')).toBe('productivo');
  });

  it('term: devuelve el título', () => {
    expect(translationSummary('SEGUIR / CONTINUAR — Se usa para...')).toBe('SEGUIR / CONTINUAR');
  });

  it('senses: devuelve el título (header)', () => {
    expect(
      translationSummary('RECOGER / APRENDER — 1) Recoger: "I\'ll pick you up" = te recojo. 2) Aprender: "I picked up Spanish" = aprendí español.')
    ).toBe('RECOGER / APRENDER');
  });

  it('comparison: junta las definiciones', () => {
    expect(
      translationSummary('LEND = prestar | RENT = alquilar | HIRE = contratar')
    ).toBe('prestar · alquilar · contratar');
  });
});
