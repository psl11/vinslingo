// Lógica pura de progreso (racha y nivel de dominio), sin dependencias de
// Supabase/expo-sqlite/expo-network. Separada para poder testearla de forma
// aislada y para evitar la duplicación que existía entre progressService.ts
// y database/queries.ts.

export interface StreakUpdateInput {
  sessionsToday: number;
  lastSessionBeforeToday: Date | null;
  currentStreak: number;
  longestStreak: number;
  now: Date;
}

export interface StreakUpdateResult {
  newStreak: number;
  newLongest: number;
}

// Es la parte que ya ha tenido bugs reales dos veces (fechas/husos horarios),
// aislarla permite cubrir los casos límite con tests unitarios directos.
export function computeStreakUpdate(input: StreakUpdateInput): StreakUpdateResult {
  const { sessionsToday, lastSessionBeforeToday, currentStreak, longestStreak, now } = input;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  let newStreak: number;

  if (sessionsToday > 1) {
    // Ya había estudiado hoy - mantener racha
    newStreak = Math.max(1, currentStreak);
  } else if (lastSessionBeforeToday && lastSessionBeforeToday >= yesterday) {
    // Estudió ayer - incrementar racha
    newStreak = currentStreak + 1;
  } else {
    // Primera sesión, o más de un día sin estudiar - racha empieza en 1
    newStreak = 1;
  }

  const newLongest = Math.max(newStreak, longestStreak);

  return { newStreak, newLongest };
}

// 0 = nueva, 1 = aprendiendo, 2 = repasando, 3 = dominada
export function calculateMasteryLevel(repetitions: number, interval: number): number {
  if (repetitions === 0) return 0;
  if (interval < 7) return 1;
  if (interval < 30) return 2;
  return 3;
}
