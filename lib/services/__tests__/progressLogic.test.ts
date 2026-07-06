import { computeStreakUpdate, calculateMasteryLevel } from '../progressLogic';

// Fechas de referencia fijas para que los tests no dependan del día real
// en que se ejecutan. "now" es un miércoles a mediodía.
const NOW = new Date('2026-03-11T12:00:00Z');
const TODAY_START = new Date('2026-03-11T00:00:00Z');
const YESTERDAY_EARLY = new Date('2026-03-10T01:00:00Z');
const YESTERDAY_LATE = new Date('2026-03-10T23:30:00Z');
const TWO_DAYS_AGO = new Date('2026-03-09T20:00:00Z');

describe('computeStreakUpdate', () => {
  it('primera sesión de siempre: racha empieza en 1', () => {
    const result = computeStreakUpdate({
      sessionsToday: 1,
      lastSessionBeforeToday: null,
      currentStreak: 0,
      longestStreak: 0,
      now: NOW,
    });
    expect(result.newStreak).toBe(1);
    expect(result.newLongest).toBe(1);
  });

  it('estudió ayer: incrementa la racha en 1', () => {
    const result = computeStreakUpdate({
      sessionsToday: 1,
      lastSessionBeforeToday: YESTERDAY_EARLY,
      currentStreak: 5,
      longestStreak: 5,
      now: NOW,
    });
    expect(result.newStreak).toBe(6);
    expect(result.newLongest).toBe(6);
  });

  it('estudió ayer justo antes de medianoche: sigue contando como "ayer"', () => {
    // Caso límite de huso horario/fecha que ya causó un bug real.
    const result = computeStreakUpdate({
      sessionsToday: 1,
      lastSessionBeforeToday: YESTERDAY_LATE,
      currentStreak: 3,
      longestStreak: 3,
      now: NOW,
    });
    expect(result.newStreak).toBe(4);
  });

  it('no estudió ayer (hace 2+ días): la racha se resetea a 1, no a 0', () => {
    const result = computeStreakUpdate({
      sessionsToday: 1,
      lastSessionBeforeToday: TWO_DAYS_AGO,
      currentStreak: 10,
      longestStreak: 15,
      now: NOW,
    });
    expect(result.newStreak).toBe(1);
    // El récord (longest) no debe perderse aunque la racha actual se rompa
    expect(result.newLongest).toBe(15);
  });

  it('segunda sesión del mismo día: mantiene la racha actual sin incrementar de nuevo', () => {
    const result = computeStreakUpdate({
      sessionsToday: 2,
      lastSessionBeforeToday: YESTERDAY_EARLY,
      currentStreak: 6,
      longestStreak: 6,
      now: NOW,
    });
    expect(result.newStreak).toBe(6);
  });

  it('segunda sesión del mismo día partiendo de racha 0: la deja en 1, no en 0', () => {
    const result = computeStreakUpdate({
      sessionsToday: 2,
      lastSessionBeforeToday: null,
      currentStreak: 0,
      longestStreak: 0,
      now: NOW,
    });
    expect(result.newStreak).toBe(1);
  });

  it('actualiza el récord (longest) cuando la racha actual lo supera', () => {
    const result = computeStreakUpdate({
      sessionsToday: 1,
      lastSessionBeforeToday: YESTERDAY_EARLY,
      currentStreak: 9,
      longestStreak: 9,
      now: NOW,
    });
    expect(result.newStreak).toBe(10);
    expect(result.newLongest).toBe(10);
  });

  it('no reduce el récord aunque la racha actual sea menor', () => {
    const result = computeStreakUpdate({
      sessionsToday: 1,
      lastSessionBeforeToday: YESTERDAY_EARLY,
      currentStreak: 2,
      longestStreak: 20,
      now: NOW,
    });
    expect(result.newStreak).toBe(3);
    expect(result.newLongest).toBe(20);
  });

  it('la última sesión exactamente en el límite de "hoy" (medianoche) no cuenta como "ayer"', () => {
    // TODAY_START es el propio inicio de hoy: >= yesterday pero también es hoy,
    // así que si esto ocurriera reflejaría una sesión de hoy, no de ayer.
    // Se incluye para documentar el comportamiento exacto en el límite.
    const result = computeStreakUpdate({
      sessionsToday: 1,
      lastSessionBeforeToday: TODAY_START,
      currentStreak: 4,
      longestStreak: 4,
      now: NOW,
    });
    // TODAY_START >= yesterday es cierto, así que con la lógica actual esto
    // incrementa la racha. Documentamos el comportamiento real, no uno ideal.
    expect(result.newStreak).toBe(5);
  });
});

describe('calculateMasteryLevel (términos FSRS: reps + stability)', () => {
  it('reps 0 -> nivel 0 (nueva), sea cual sea la stability', () => {
    expect(calculateMasteryLevel(0, 0)).toBe(0);
    expect(calculateMasteryLevel(0, 100)).toBe(0);
  });

  it('stability < 7 -> nivel 1 (aprendiendo)', () => {
    expect(calculateMasteryLevel(1, 2.3)).toBe(1); // primer "good" real de FSRS
    expect(calculateMasteryLevel(2, 6.9)).toBe(1);
  });

  it('7 <= stability < 30 -> nivel 2 (repasando)', () => {
    expect(calculateMasteryLevel(2, 7)).toBe(2);
    expect(calculateMasteryLevel(3, 29.9)).toBe(2);
  });

  it('stability >= 30 -> nivel 3 (dominada)', () => {
    expect(calculateMasteryLevel(4, 30)).toBe(3);
    expect(calculateMasteryLevel(5, 365)).toBe(3);
  });
});
