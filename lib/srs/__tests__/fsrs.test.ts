import {
  createNewCard,
  schedule,
  getEstimatedIntervals,
  cardToState,
  stateToCard,
  cardFromRow,
  isUnscheduled,
  logToRow,
  formatInterval,
  REQUEST_RETENTION,
  State,
  type SimpleQuality,
} from '../fsrs';

const T0 = new Date('2026-07-06T10:00:00Z');
const daysUntil = (due: Date, from: Date) =>
  Math.round((due.getTime() - from.getTime()) / 86_400_000);

describe('createNewCard', () => {
  it('crea una tarjeta en estado New, sin repasos ni fallos', () => {
    const card = createNewCard(T0);
    expect(card.state).toBe(State.New);
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(0);
  });
});

describe('schedule', () => {
  it('en tarjeta nueva, intervalos monótonos: easy >= good >= hard >= again', () => {
    const card = createNewCard(T0);
    const again = daysUntil(schedule(card, 'again', T0).card.due, T0);
    const hard = daysUntil(schedule(card, 'hard', T0).card.due, T0);
    const good = daysUntil(schedule(card, 'good', T0).card.due, T0);
    const easy = daysUntil(schedule(card, 'easy', T0).card.due, T0);
    expect(easy).toBeGreaterThanOrEqual(good);
    expect(good).toBeGreaterThanOrEqual(hard);
    expect(hard).toBeGreaterThanOrEqual(again);
  });

  it('una respuesta correcta pasa la tarjeta a Review, incrementa reps y da stability > 0', () => {
    const { card } = schedule(createNewCard(T0), 'good', T0);
    expect(card.state).toBe(State.Review);
    expect(card.reps).toBe(1);
    expect(card.stability).toBeGreaterThan(0);
  });

  it('los intervalos crecen al repasar correctamente de forma repetida', () => {
    let card = schedule(createNewCard(T0), 'good', T0).card;
    const firstInterval = daysUntil(card.due, T0);
    const reviewAt = new Date(card.due);
    const next = schedule(card, 'good', reviewAt).card;
    const secondInterval = daysUntil(next.due, reviewAt);
    expect(secondInterval).toBeGreaterThan(firstInterval);
  });

  it('fallar ("again") una tarjeta madura incrementa lapses y registra el grado', () => {
    let card = schedule(createNewCard(T0), 'good', T0).card;
    card = schedule(card, 'good', new Date(card.due)).card;
    const before = card.lapses;
    const { card: failed, log } = schedule(card, 'again', new Date(card.due));
    expect(failed.lapses).toBe(before + 1);
    expect(log.rating).toBe(1); // Rating.Again
  });

  it('registra un log con el timestamp del repaso', () => {
    const { log } = schedule(createNewCard(T0), 'good', T0);
    expect(new Date(log.review).getTime()).toBe(T0.getTime());
  });
});

describe('getEstimatedIntervals', () => {
  it('devuelve las 4 claves esperadas', () => {
    const intervals = getEstimatedIntervals(createNewCard(T0), T0);
    expect(Object.keys(intervals).sort()).toEqual(
      (['again', 'easy', 'good', 'hard'] as SimpleQuality[]).sort()
    );
  });

  it('en tarjeta nueva, "easy" es mayor que "good" y "hard"', () => {
    const intervals = getEstimatedIntervals(createNewCard(T0), T0);
    expect(intervals.easy).toBeGreaterThan(intervals.good);
    expect(intervals.easy).toBeGreaterThan(intervals.hard);
  });

  it('todos los intervalos son al menos 1 día (sin pasos de minutos)', () => {
    const intervals = getEstimatedIntervals(createNewCard(T0), T0);
    (Object.values(intervals) as number[]).forEach((d) => expect(d).toBeGreaterThanOrEqual(1));
  });
});

describe('cardToState / stateToCard', () => {
  it('round-trip preserva los campos y convierte fechas a epoch ms', () => {
    const { card } = schedule(createNewCard(T0), 'good', T0);
    const state = cardToState(card);
    expect(state.due).toBe(card.due.getTime());
    expect(state.last_review).toBe(card.last_review!.getTime());
    expect(state.state).toBe(card.state);

    const back = stateToCard(state);
    expect(back.stability).toBe(card.stability);
    expect(back.difficulty).toBe(card.difficulty);
    expect(back.reps).toBe(card.reps);
    expect(back.lapses).toBe(card.lapses);
    expect(back.due.getTime()).toBe(card.due.getTime());
    expect(back.last_review?.getTime()).toBe(card.last_review!.getTime());
  });

  it('maneja last_review nulo (tarjeta nueva sin repasar)', () => {
    const state = cardToState(createNewCard(T0));
    expect(state.last_review).toBeNull();
    const back = stateToCard(state);
    expect(back.last_review).toBeUndefined();
  });
});

describe('isUnscheduled / cardFromRow (soft-reset)', () => {
  it('una fila sin repasos (last_review null, reps/stability 0) es tarjeta nueva', () => {
    expect(isUnscheduled({ last_review: null, reps: 0, stability: 0 })).toBe(true);
    const card = cardFromRow({ last_review: null, reps: 0, stability: 0 }, T0);
    expect(card.state).toBe(State.New);
    expect(card.reps).toBe(0);
  });

  it('una fila vacía (campos undefined) también se trata como nueva', () => {
    expect(isUnscheduled({})).toBe(true);
    expect(cardFromRow({}, T0).state).toBe(State.New);
  });

  it('una fila ya programada reconstruye su estado exacto', () => {
    const { card } = schedule(createNewCard(T0), 'good', T0);
    const row = cardToState(card); // fila persistida (state/due/... como números)
    expect(isUnscheduled(row)).toBe(false);
    const rebuilt = cardFromRow(row, T0);
    expect(rebuilt.stability).toBe(card.stability);
    expect(rebuilt.reps).toBe(card.reps);
    expect(rebuilt.due.getTime()).toBe(card.due.getTime());
  });
});

describe('logToRow', () => {
  it('aplana el ReviewLog a números (epoch ms) e incluye la duración', () => {
    const { log } = schedule(createNewCard(T0), 'good', T0);
    const row = logToRow(log, 4200);
    expect(row.rating).toBe(3); // Good
    expect(row.state).toBe(State.New); // estado PREVIO al repaso
    expect(row.review).toBe(T0.getTime());
    expect(row.review_duration_ms).toBe(4200);
    expect(typeof row.stability).toBe('number');
  });

  it('review_duration_ms es null si no se pasa', () => {
    const { log } = schedule(createNewCard(T0), 'again', T0);
    expect(logToRow(log).review_duration_ms).toBeNull();
  });
});

describe('REQUEST_RETENTION', () => {
  it('usa la retención objetivo estándar 0.9', () => {
    expect(REQUEST_RETENTION).toBe(0.9);
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
