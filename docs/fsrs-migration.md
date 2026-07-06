# Migración del SRS: SM-2 → FSRS

Documento vivo de la migración del algoritmo de repetición espaciada de **SM-2**
(SuperMemo 2, 1988) a **FSRS** (Free Spaced Repetition Scheduler), el estado del
arte actual (algoritmo por defecto de Anki).

## Por qué

- FSRS logra la misma retención que SM-2 con ~20-30 % menos repasos.
- Elimina el *ease hell* de SM-2 (tarjetas atascadas en intervalos cortos).
- Permite fijar una **retención objetivo** explícita.
- La UI de 4 botones (Otra vez / Difícil / Bien / Fácil) ya mapea 1:1 a los
  grados de FSRS (Again/Hard/Good/Easy), así que la migración es casi toda interna.

## Alcance

Solo el SRS de **flashcards** (`user_vocabulary`). Los ejercicios de huecos /
transformación seguirán con su tracker binario aparte (`user_gap_fill`): no son
SRS y no se tocan.

## Decisiones tomadas

1. **Retención objetivo:** `0.9` (estándar recomendado por FSRS).
2. **Sembrado de datos existentes:** **soft-reset**. La app apenas se ha usado,
   así que no invertimos esfuerzo en aproximar el estado FSRS desde el estado
   SM-2 previo: se reinician los calendarios con FSRS desde cero, conservando
   `mastery_level` donde tenga sentido. (Migración simple, sin script de mapeo.)
3. **`review_log`:** **sí**, se añade desde ya. Es lo único que permitirá
   **optimizar los parámetros de FSRS** al historial real del usuario en el
   futuro. Como es un usuario único y a largo plazo, registrar los repasos desde
   el principio es lo más valioso del plan.
4. **`enable_short_term: false`** (decisión de ingeniería, no del usuario):
   desactivamos los "learning steps" de minutos de FSRS para conservar la UX
   actual a **nivel de día** y encajar con el desempate por día de
   `getDueVocabulary`. Con esto, una tarjeta nueva da Again→1d, Hard→2d, Good→3d,
   Easy→8d (intervalos monótonos en días). Es un flag que se puede reactivar más
   adelante si se quiere repaso intra-sesión.

## Librería

`ts-fsrs` v5.4.1 (port oficial en TypeScript, MIT, JS puro sin módulos nativos →
corre en Expo/Hermes). API usada: `fsrs()`, `generatorParameters()`,
`createEmptyCard()`, `Rating`, `State`, `next()`.

## Modelo de datos (estado FSRS por tarjeta)

FSRS no usa `ease_factor` / `interval_days` / `repetitions`. Estado nuevo por
tarjeta (columnas planas en `user_vocabulary`, fechas en epoch ms):

| Columna          | Tipo    | Notas                                   |
|------------------|---------|-----------------------------------------|
| `stability`      | REAL    | Estabilidad de memoria                  |
| `difficulty`     | REAL    | Dificultad (1-10)                       |
| `elapsed_days`   | INTEGER | Días desde el último repaso             |
| `scheduled_days` | INTEGER | Intervalo programado                    |
| `learning_steps` | INTEGER | Paso de aprendizaje                     |
| `reps`           | INTEGER | Nº de repasos                           |
| `lapses`         | INTEGER | Nº de fallos                            |
| `state`          | INTEGER | 0 New / 1 Learning / 2 Review / 3 Relearn |
| `due`            | INTEGER | epoch ms (reemplaza `next_review_at`)   |
| `last_review`    | INTEGER | epoch ms, nullable                      |

Nueva tabla `review_log` (para optimización futura): `vocabulary_id`, `rating`
(1-4, enum FSRS), `state` (estado *previo* al repaso), `due`, `stability`,
`difficulty`, `scheduled_days`, `review` (timestamp epoch ms) y
`review_duration_ms` (nullable). La app ya mide `responseTimeMs` en cada
respuesta (`useStudyStore.answerCard`) — se persiste aquí, es gratis y el
optimizador de FSRS puede aprovecharlo.

`user_vocabulary` es dato de usuario → **fuera** del backup de contenido
(CLAUDE.md). No hay cambio de backup; sí migración de esquema en Supabase.

## Riesgos y detalles detectados en revisión

Hallazgos de una segunda pasada sobre el código real que el plan original
resumía. Ninguno invalida el plan; todos afectan al paso 4 o al 7.

1. **Trampa del `isCorrect` numérico.** En `app/study/[id].tsx` las estadísticas
   se calculan con `isCorrect: qualityNum >= 3`, usando la escala SM-2
   (again=1, hard=3, good=4, easy=5). La escala de FSRS es distinta
   (Again=1, **Hard=2**, Good=3, Easy=4): si se reutiliza el `>= 3` tal cual,
   "Difícil" pasaría silenciosamente a contar como fallo y contaminaría
   `times_correct/incorrect` y el accuracy. **Regla al migrar:** basar
   `isCorrect` en la etiqueta (`quality !== 'again'`), nunca en el número.

2. **La cadena de persistencia entera está cableada a SM-2, no solo los 3
   llamadores.** `updateUserVocabularyAfterReview` (`lib/database/queries.ts`),
   `syncVocabularyProgress` (`lib/services/progressService.ts`) y — fácil de
   olvidar — el **payload de la cola de sync offline** (`addToSyncQueue`, que
   serializa `ease_factor`/`interval_days`/`repetitions` como JSON) escriben
   columnas SM-2 con nombre propio. El paso 4 debe incluir estas funciones, y
   al desplegar hay que **vaciar/migrar la cola de sync pendiente** para no
   reproducir payloads SM-2 sobre el esquema nuevo.

3. **Doble repaso el mismo día por el reintento en sesión.** Al responder
   "Otra vez", la tarjeta se guarda en BD **y** se re-encola al final de la
   sesión; al responderla de nuevo se guarda otra vez (dos `next()` de FSRS el
   mismo día, el segundo con `elapsed_days = 0`). FSRS lo tolera (la
   estabilidad apenas se mueve y el cap de calidad `good→hard` en reintentos ya
   contiene la inflación), así que **se mantiene el comportamiento**, pero
   queda documentado como decisión: ambos repasos se escriben también en
   `review_log` porque ambos son repasos reales (el optimizador trata los
   repasos same-day según su propia convención; no hay que filtrarlos aquí).

4. **`getDueVocabulary` también cambia su SELECT, no solo el ORDER BY.** Hoy
   selecciona `uv.ease_factor, uv.interval_days as interval, uv.repetitions`
   para hidratar las tarjetas de la sesión (el store las re-encola con esos
   campos). En el paso 6 hay que sustituirlos por las columnas FSRS y
   actualizar el tipo de tarjeta que viaja por `useStudyStore`.

Mejoras opcionales (no bloqueantes):

- **Fuzz de intervalos** (`enable_fuzz: true`): sin él, las tarjetas aprendidas
  juntas quedan sincronizadas para siempre y vencen en bloque (Anki lo activa
  por defecto). Coste casi nulo; único cuidado: los tests del scheduler deben
  tolerar el ±5 % o fijar la semilla.
- **Export periódico de `review_log`.** Es dato de usuario (fuera del backup de
  contenido del repo, correctamente), pero dado el historial de caídas de
  Supabase del proyecto y que este historial es lo que permite optimizar
  parámetros en el futuro, conviene un export local ocasional (CSV/JSON privado,
  no versionado en git).

## Cómo se cierra el círculo de la optimización

`ts-fsrs` **no incluye** el optimizador de parámetros; solo programa. El flujo
futuro será: exportar `review_log` → correr el optimizador oficial
(`fsrs-optimizer`, Python, o su port en Rust) → obtener los ~21 pesos `w` →
pasarlos a `generatorParameters({ w })` en `lib/srs/fsrs.ts`. Hasta entonces se
usan los pesos por defecto (ya mejores que SM-2). Merece la pena con unos
cuantos miles de repasos registrados; antes, no.

## Pasos

1. **[HECHO]** Dependencia + wrapper `lib/srs/fsrs.ts` + tests. Aislado, no toca
   la app en producción.
2. Migración de esquema (SQLite `lib/database/schema.ts` + Supabase): añadir
   columnas FSRS a `user_vocabulary` + tabla `review_log`.
3. Soft-reset del `user_vocabulary` existente. **Ya cubierto por el paso 2 sin
   script aparte:** las filas antiguas quedan con estado FSRS en ceros
   (`stability=0`, `reps=0`, `fsrs_state=0` (New), `due` NULL), conservando
   `times_correct/incorrect` y `mastery_level` para las estadísticas. Regla que
   el paso 4 debe respetar al leer: una fila con `last_review IS NULL` (o
   `reps=0 AND stability=0`) es una tarjeta nueva → usar `createNewCard()`, no
   `stateToCard()` (evita `due` NULL → fecha inválida).
4. Cambiar los llamadores detrás de la interfaz `SimpleQuality`
   (`stores/useStudyStore.ts`, `app/study/[id].tsx`, `hooks/useStudy.ts`) **y la
   cadena de persistencia** (`updateUserVocabularyAfterReview`,
   `syncVocabularyProgress` y el payload de `addToSyncQueue`). `isCorrect` pasa
   a derivarse de la etiqueta (`quality !== 'again'`), no del número — ver
   riesgo 1. Escribir cada repaso en `review_log` (con `review_duration_ms`).
5. Redefinir `calculateMasteryLevel` (`lib/services/progressLogic.ts`) en
   términos FSRS (umbrales de `stability` / `state`) + sus tests.
6. Apuntar el orden de `getDueVocabulary` a la columna `due` (el desempate suave
   por frecuencia por día se mantiene idéntico) **y cambiar su SELECT**: hoy
   hidrata las tarjetas con `ease_factor/interval_days/repetitions`; deben ser
   las columnas FSRS, actualizando el tipo de tarjeta de `useStudyStore`.
7. Sync (`progressService.ts` / `syncService.ts`) + esquema Supabase, incluyendo
   `review_log`.
8. Retirar SM-2 (`lib/srs/sm2.ts` + tests) una vez verificado.

## Estado actual

- **Paso 1 completado:** `ts-fsrs` instalado; `lib/srs/fsrs.ts` con el scheduler
  (retención 0.9, día-nivel), mapeo de grados, `schedule`, `getEstimatedIntervals`,
  conversores `cardToState`/`stateToCard` y `formatInterval`; tests en
  `lib/srs/__tests__/fsrs.test.ts`. SM-2 sigue en uso hasta el paso 4.
- **Paso 2 completado (esquema, aditivo):**
  - SQLite (`lib/database/schema.ts`): columnas FSRS en `user_vocabulary`
    (`stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps,
    lapses, fsrs_state, due, last_review`), índice `idx_user_vocab_due`, y tabla
    `review_log`.
  - Migración idempotente para instalaciones existentes en
    `lib/database/client.ts` (`ALTER TABLE ... ADD COLUMN` guardado por
    `PRAGMA table_info`); `review_log` se crea vía `CREATE TABLE IF NOT EXISTS`.
  - Supabase: `supabase/migrations/003_fsrs_schema.sql` (aditivo e idempotente
    con `add column if not exists`; `review_log` con RLS por usuario).
    **Pendiente de aplicar a mano en el SQL Editor de Supabase** (no se puede
    hacer DDL desde el cliente JS).
  - **Paso 3 (soft-reset) queda absorbido:** ver nota en el paso 3.
- **Paso 4 completado (FSRS en producción):**
  - Motor: `stores/useStudyStore.ts` (`answerCard`) y `app/study/[id].tsx`
    (`saveCardProgress`) programan con FSRS; `getEstimatedIntervals` de los 4
    botones también. `isRetry` mantiene el cap `good→hard`.
  - **Trampa del `isCorrect` corregida:** se deriva de `quality !== 'again'`.
  - Persistencia: `updateUserVocabularyAfterReview` escribe columnas FSRS +
    `review_log` (local); `syncVocabularyProgress` y el payload de la cola
    offline llevan las columnas FSRS. `next_review_at`/`repetitions` se
    mantienen en sync con `due`/`reps` (compat hasta el paso 6).
  - `getDueVocabulary` hidrata las tarjetas con estado FSRS (`fsrs_state AS
    state`). El ORDER BY sigue por `next_review_at` (se cambia en el paso 6).
  - `mastery_level` usa `calculateMasteryLevel(reps, scheduled_days)` como
    puente (se redefine en el paso 5).
  - Código muerto SM-2 retirado: `hooks/useStudy.ts` (borrado) y
    `saveStudyResult` (`studyService.ts`). SM-2 (`lib/srs/sm2.ts`) solo lo usan
    ya sus propios tests, hasta el paso 8.
  - **Diferido a propósito:** el sync de `review_log` a Supabase (se escribe
    local con `needs_sync=1`; sube en el paso 7).
  - Verificado: typecheck limpio, 83 tests, y simulación SQL de INSERT/UPDATE +
    `review_log`. Falta la prueba en dispositivo (runtime), que es manual.
- **Siguiente:** paso 5 (redefinir `calculateMasteryLevel` en términos FSRS).
