// FSRS (Free Spaced Repetition Scheduler) — reemplaza a SM-2 como algoritmo de
// repetición espaciada. Ver docs/fsrs-migration.md.
//
// Este wrapper aísla `ts-fsrs` detrás de una interfaz estable (`SimpleQuality`,
// misma que ya usa la UI de 4 botones) para que el resto de la app no dependa
// directamente de la librería.
import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  State,
  type Card,
  type Grade,
  type ReviewLog,
  type FSRS,
} from 'ts-fsrs';

// Contrato de calidad de la UI (los mismos 4 botones que ya existen).
export type SimpleQuality = 'again' | 'hard' | 'good' | 'easy';

// Mapeo 1:1 a los grados de FSRS.
const GRADE_MAP: Record<SimpleQuality, Grade> = {
  again: Rating.Again, // 1
  hard: Rating.Hard,   // 2
  good: Rating.Good,   // 3
  easy: Rating.Easy,   // 4
};

// Retención objetivo estándar recomendada por FSRS.
export const REQUEST_RETENTION = 0.9;

const MS_PER_DAY = 86_400_000;

// Scheduler único. `enable_short_term: false` → intervalos a nivel de día (sin
// pasos de aprendizaje de minutos), para conservar la UX actual y encajar con
// el desempate por día de `getDueVocabulary`. Ver decisión 4 del .md.
const scheduler: FSRS = fsrs(
  generatorParameters({
    request_retention: REQUEST_RETENTION,
    enable_short_term: false,
  })
);

export { State };
export type { Card, ReviewLog };

// Estado persistido en SQLite/Supabase (columnas planas; fechas en epoch ms).
export interface PersistedFsrsState {
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number; // 0 New | 1 Learning | 2 Review | 3 Relearning
  due: number; // epoch ms
  last_review: number | null; // epoch ms
}

export interface ScheduleResult {
  card: Card;
  log: ReviewLog;
}

/** Crea una tarjeta nueva (estado New, sin repasos). */
export function createNewCard(now: Date = new Date()): Card {
  return createEmptyCard(now);
}

/** Aplica un repaso y devuelve el nuevo estado de la tarjeta + el log. */
export function schedule(
  card: Card,
  quality: SimpleQuality,
  now: Date = new Date()
): ScheduleResult {
  const { card: next, log } = scheduler.next(card, now, GRADE_MAP[quality]);
  return { card: next, log };
}

/** Intervalos estimados (en días) para pintar los 4 botones de respuesta. */
export function getEstimatedIntervals(
  card: Card,
  now: Date = new Date()
): Record<SimpleQuality, number> {
  const out = {} as Record<SimpleQuality, number>;
  (Object.keys(GRADE_MAP) as SimpleQuality[]).forEach((q) => {
    const { card: next } = scheduler.next(card, now, GRADE_MAP[q]);
    out[q] = Math.max(1, Math.round((next.due.getTime() - now.getTime()) / MS_PER_DAY));
  });
  return out;
}

/** Convierte una Card de ts-fsrs a la fila plana que se guarda en BD. */
export function cardToState(card: Card): PersistedFsrsState {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    due: card.due.getTime(),
    last_review: card.last_review ? card.last_review.getTime() : null,
  };
}

/** Reconstruye una Card de ts-fsrs a partir de la fila plana de BD. */
export function stateToCard(s: PersistedFsrsState): Card {
  return {
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state as State,
    due: new Date(s.due),
    last_review: s.last_review != null ? new Date(s.last_review) : undefined,
  };
}

// Campos de estado FSRS tal como llegan de una fila de user_vocabulary. Todos
// opcionales: una tarjeta de lección nueva aún no tiene fila de progreso. El
// campo `state` corresponde a la columna `fsrs_state` (aliaseada en el SELECT).
export interface StudyFsrsFields {
  stability?: number | null;
  difficulty?: number | null;
  elapsed_days?: number | null;
  scheduled_days?: number | null;
  learning_steps?: number | null;
  reps?: number | null;
  lapses?: number | null;
  state?: number | null;
  due?: number | null; // epoch ms
  last_review?: number | null; // epoch ms
}

/**
 * ¿La fila nunca ha sido programada por FSRS? (soft-reset: se trata como
 * tarjeta nueva). Ver docs/fsrs-migration.md, paso 3.
 */
export function isUnscheduled(s: StudyFsrsFields): boolean {
  return s.last_review == null && !s.reps && !s.stability;
}

/**
 * Construye una Card de ts-fsrs desde los campos persistidos de una fila, o una
 * tarjeta nueva si la fila nunca fue programada por FSRS (evita `due` NULL →
 * fecha inválida).
 */
export function cardFromRow(s: StudyFsrsFields, now: Date = new Date()): Card {
  if (isUnscheduled(s)) return createNewCard(now);
  return stateToCard({
    stability: s.stability ?? 0,
    difficulty: s.difficulty ?? 0,
    elapsed_days: s.elapsed_days ?? 0,
    scheduled_days: s.scheduled_days ?? 0,
    learning_steps: s.learning_steps ?? 0,
    reps: s.reps ?? 0,
    lapses: s.lapses ?? 0,
    state: s.state ?? 0,
    due: s.due ?? now.getTime(),
    last_review: s.last_review ?? null,
  });
}

// Fila aplanada para la tabla review_log (fechas en epoch ms).
export interface ReviewLogRow {
  rating: number; // grado FSRS 1-4
  state: number; // estado PREVIO al repaso
  due: number | null; // due previo
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  review: number; // timestamp del repaso
  review_duration_ms: number | null;
}

/** Aplana un ReviewLog de ts-fsrs a la fila que se guarda en review_log. */
export function logToRow(log: ReviewLog, reviewDurationMs: number | null = null): ReviewLogRow {
  return {
    rating: log.rating,
    state: log.state,
    due: log.due ? new Date(log.due).getTime() : null,
    stability: log.stability,
    difficulty: log.difficulty,
    elapsed_days: log.elapsed_days,
    scheduled_days: log.scheduled_days,
    review: new Date(log.review).getTime(),
    review_duration_ms: reviewDurationMs,
  };
}

// Formateo de intervalos para la UI. Genérico (no atado a ningún algoritmo); se
// reubica aquí para poder retirar sm2.ts al final de la migración.
export function formatInterval(days: number): string {
  if (days === 0) return 'ahora';
  if (days === 1) return '1d';
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}sem`;
  if (days < 365) return `${Math.round(days / 30)}m`;
  return `${Math.round(days / 365)}a`;
}
