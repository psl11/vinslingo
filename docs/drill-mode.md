# Entrenamiento (drill de falladas, estilo Duolingo)

Modo de repaso intensivo para las palabras más falladas: cada palabra se
trabaja en **3 formatos que escalan** y los fallos **se repiten al final** hasta
superarlos (la mecánica insignia de Duolingo). Entrada: botón **🏋️ Entrenar** en
"Palabras más falladas" (respeta el toggle todas/no dominadas y el nº de
tarjetas por ronda).

## Ejercicios (v1: los 4 troncales)

Por palabra, en este orden de etapas:

1. **Reconocer** — opción múltiple EN→ES (palabra → 4 traducciones).
2. **Comprender** — **completa la frase**: la frase de ejemplo con la palabra
   tapada (`She ____ a scream`) y 4 opciones. Si la frase no permite un hueco
   fiable (flexión o phrasal separado), cae a opción múltiple ES→EN.
3. **Producir** — **escribir** (reutiliza `TypingCard`, con sus pistas).

Piezas: generador puro en
[`lib/drill/exerciseGenerator.ts`](../lib/drill/exerciseGenerator.ts) (con tests)
y pantalla en [`app/study/drill.tsx`](../app/study/drill.tsx).

## Mecánica de sesión

- La cola inicial trae los 3 ejercicios de cada palabra (barajados por etapa).
- **Fallo → el ejercicio se re-encola al final**; no terminas hasta superarlo.
- La **barra de progreso solo avanza con aciertos** (ejercicios distintos
  superados / total).
- Una palabra **se gradúa** al superar sus 3 formatos.
- Sesión sobria a propósito: barra + resumen final (sin vidas ni rachas de
  combo). Resumen: cada palabra con "✓ a la primera" o su nº de fallos.
- Atajos web: `1-4` elige opción, `Espacio/Enter` continúa.

## FSRS (cuenta como estudio real)

Al graduarse una palabra se guarda una revisión con la misma maquinaria que el
estudio normal (`schedule` + `updateUserVocabularyAfterReview` + sync):

- 0 fallos en sus ejercicios → `good`
- 1 fallo → `hard`
- 2+ fallos → `again` (lapse: FSRS la reprograma pronto)

El tiempo de respuesta acumulado de sus ejercicios va al `review_log`. Al
terminar: XP (10/palabra graduada), racha, minutos y sesión en Supabase, como
cualquier sesión.

## Distractores (calidad, estándar del contenido)

Las opciones falsas se eligen con seguridad **anti-polisemia** en
`pickDistractors`/`isSafeDistractor`:

- Se rechaza cualquier candidato cuya traducción **comparta una palabra de
  sentido** con la del target (si "soltar" aparece en ambas, esa opción también
  sería correcta — intolerable). Comparación sobre `translationSummary`
  normalizado, sin stopwords.
- También se rechazan palabras que se contienen (`take` vs `take off`) y dos
  distractores con el mismo sentido entre sí.
- Prioridad de pool: misma categoría **y misma clase de palabra** (un sustantivo
  en el hueco de un verbo delata la respuesta) → misma categoría → mismo nivel
  CEFR → cualquiera.
- El hueco de "completa la frase" solo se crea si la frase contiene la palabra
  **exacta en forma base y contigua** (con flexiones/separables, las opciones en
  forma base romperían la gramática del hueco).

## Ideas aparcadas (v2)

Completa el verso de tu música 🎵, escucha-y-escribe (TTS), construir el phrasal
con fichas, parejas EN↔ES. El generador está diseñado para añadir tipos sin
tocar la pantalla (cada tipo es un builder que emite `DrillExercise`).
