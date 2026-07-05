import { calculateSM2, getEstimatedIntervals, formatInterval, QUALITY_MAP, Quality } from '../sm2';

describe('calculateSM2', () => {
  describe('respuesta incorrecta (quality < 3)', () => {
    it('resetea repetitions a 0 e interval a 1', () => {
      const result = calculateSM2({ easeFactor: 2.5, interval: 30, repetitions: 5 }, 0);
      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
    });

    it('resetea incluso viniendo de una racha larga', () => {
      const result = calculateSM2({ easeFactor: 2.8, interval: 90, repetitions: 10 }, 2);
      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
    });
  });

  describe('respuesta correcta en tarjeta nueva (repetitions === 0)', () => {
    it('"hard" (quality 3) da 1 día', () => {
      const result = calculateSM2({ repetitions: 0 }, 3);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
    });

    it('"good" (quality 4) da 1 día', () => {
      const result = calculateSM2({ repetitions: 0 }, 4);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
    });

    it('"easy" (quality 5) salta a 4 días, no a 1', () => {
      // Este es el fix explícito: sin él, los 4 botones de respuesta
      // muestran el mismo intervalo en una tarjeta nueva.
      const result = calculateSM2({ repetitions: 0 }, 5);
      expect(result.interval).toBe(4);
      expect(result.repetitions).toBe(1);
    });

    it('usa easeFactor y repetitions por defecto si no se pasan', () => {
      const result = calculateSM2({}, 4);
      expect(result.repetitions).toBe(1);
      expect(result.interval).toBe(1);
    });
  });

  describe('segunda repetición correcta (repetitions === 1)', () => {
    it('siempre da 6 días independientemente del interval previo', () => {
      const result = calculateSM2({ interval: 1, repetitions: 1, easeFactor: 2.5 }, 4);
      expect(result.interval).toBe(6);
      expect(result.repetitions).toBe(2);
    });
  });

  describe('repeticiones posteriores (repetitions >= 2)', () => {
    it('multiplica el interval anterior por el easeFactor', () => {
      const result = calculateSM2({ interval: 6, repetitions: 2, easeFactor: 2.5 }, 4);
      expect(result.interval).toBe(Math.round(6 * 2.5));
      expect(result.repetitions).toBe(3);
    });

    it('redondea el resultado a un entero de días', () => {
      const result = calculateSM2({ interval: 10, repetitions: 3, easeFactor: 1.7 }, 3);
      expect(Number.isInteger(result.interval)).toBe(true);
    });
  });

  describe('easeFactor', () => {
    it('nunca baja de 1.3 aunque falles muchas veces seguidas', () => {
      let card: any = { easeFactor: 1.3, interval: 1, repetitions: 0 };
      for (let i = 0; i < 5; i++) {
        card = calculateSM2(card, 0);
      }
      expect(card.easeFactor).toBeGreaterThanOrEqual(1.3);
    });

    it('sube con respuestas "easy" repetidas', () => {
      const result = calculateSM2({ easeFactor: 2.5 }, 5);
      expect(result.easeFactor).toBeGreaterThan(2.5);
    });

    it('baja con respuestas "hard" repetidas', () => {
      const result = calculateSM2({ easeFactor: 2.5 }, 3);
      expect(result.easeFactor).toBeLessThan(2.5);
    });
  });

  describe('nextReviewAt', () => {
    it('es hoy + interval días', () => {
      const before = Date.now();
      const result = calculateSM2({ repetitions: 1, interval: 6, easeFactor: 2.5 }, 4);
      const expectedMs = before + result.interval * 24 * 60 * 60 * 1000;
      // Margen de un minuto por el tiempo de ejecución del test
      expect(Math.abs(result.nextReviewAt.getTime() - expectedMs)).toBeLessThan(60_000);
    });
  });
});

describe('getEstimatedIntervals', () => {
  it('"again" es siempre 1, independientemente del estado de la tarjeta', () => {
    const intervals = getEstimatedIntervals({ interval: 50, repetitions: 4, easeFactor: 2.9 });
    expect(intervals.again).toBe(1);
  });

  it('devuelve las 4 claves esperadas', () => {
    const intervals = getEstimatedIntervals({ repetitions: 0 });
    expect(Object.keys(intervals).sort()).toEqual(['again', 'easy', 'good', 'hard'].sort());
  });

  it('en tarjeta nueva, "easy" es mayor que "good" y "hard" (el fix de 4 días)', () => {
    const intervals = getEstimatedIntervals({ repetitions: 0 });
    expect(intervals.easy).toBeGreaterThan(intervals.good);
    expect(intervals.easy).toBeGreaterThan(intervals.hard);
  });

  it('usa QUALITY_MAP para traducir las etiquetas simplificadas', () => {
    expect(QUALITY_MAP.again).toBe(1 as Quality);
    expect(QUALITY_MAP.hard).toBe(3 as Quality);
    expect(QUALITY_MAP.good).toBe(4 as Quality);
    expect(QUALITY_MAP.easy).toBe(5 as Quality);
  });
});

describe('formatInterval', () => {
  it.each([
    [0, 'ahora'],
    [1, '1d'],
    [2, '2d'],
    [6, '6d'],
    [7, '1sem'],
    [13, '2sem'],
    [29, '4sem'],
    [30, '1m'],
    [364, '12m'],
    [365, '1a'],
    [730, '2a'],
  ])('formatInterval(%i) === %s', (days, expected) => {
    expect(formatInterval(days)).toBe(expected);
  });
});
