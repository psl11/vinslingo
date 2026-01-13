// SM-2 Spaced Repetition Algorithm
// Based on SuperMemo 2 algorithm by Piotr Wozniak

export interface SM2Card {
  easeFactor: number;      // 1.3 - 2.5+
  interval: number;        // días hasta próxima revisión
  repetitions: number;     // veces respondida correctamente en fila
  nextReviewAt: Date;
}

// Quality ratings (0-5)
// 0 = Complete blackout
// 1 = Incorrect, but upon seeing correct answer, remembered
// 2 = Incorrect, but correct answer seemed easy to recall
// 3 = Correct with serious difficulty
// 4 = Correct after hesitation
// 5 = Perfect response
export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

// Simplified quality for UI (maps to SM2 quality)
export type SimpleQuality = 'again' | 'hard' | 'good' | 'easy';

export const QUALITY_MAP: Record<SimpleQuality, Quality> = {
  again: 1,  // Incorrect
  hard: 3,   // Correct with difficulty
  good: 4,   // Correct
  easy: 5,   // Perfect
};

export interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: Date;
}

export function calculateSM2(
  card: Partial<SM2Card>,
  quality: Quality
): SM2Result {
  let easeFactor = card.easeFactor ?? 2.5;
  let interval = card.interval ?? 0;
  let repetitions = card.repetitions ?? 0;

  if (quality < 3) {
    // Respuesta incorrecta: resetear
    repetitions = 0;
    interval = 1;
  } else {
    // Respuesta correcta
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions++;
  }

  // Actualizar factor de facilidad
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // Mínimo 1.3
  easeFactor = Math.max(1.3, easeFactor);

  // Calcular fecha de próxima revisión
  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + interval);

  return {
    easeFactor,
    interval,
    repetitions,
    nextReviewAt,
  };
}

// Helper para calcular intervalo estimado según calidad
export function getEstimatedIntervals(card: Partial<SM2Card>): Record<SimpleQuality, number> {
  return {
    again: 1,
    hard: calculateSM2(card, QUALITY_MAP.hard).interval,
    good: calculateSM2(card, QUALITY_MAP.good).interval,
    easy: calculateSM2(card, QUALITY_MAP.easy).interval,
  };
}

// Formatear intervalo para mostrar en UI
export function formatInterval(days: number): string {
  if (days === 0) return 'ahora';
  if (days === 1) return '1d';
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}sem`;
  if (days < 365) return `${Math.round(days / 30)}m`;
  return `${Math.round(days / 365)}a`;
}
