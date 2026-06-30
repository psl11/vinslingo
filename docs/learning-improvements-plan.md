# Plan de mejoras de aprendizaje — VinsLingo

Hoja de ruta de mejoras pedagógicas para la app. Ordenadas por relación
impacto/esfuerzo. El estado refleja lo ya integrado en el branch.

## ✅ Hecho

### 1. Auto-pronunciación de flashcards
- **Qué:** al mostrar la cara frontal de una flashcard se reproduce la palabra
  automáticamente (TTS nativo vía `expo-speech`), respetando los ajustes
  `autoPlayAudio` y `soundEnabled`.
- **Por qué:** la doble codificación (ver + oír) mejora la retención y la
  pronunciación. Activa un ajuste que existía pero no hacía nada.
- **Archivos:** `components/cards/FlashCard.tsx`, `lib/services/audioService.ts`.

### 2. Repaso de "Palabras difíciles" (leeches)
- **Qué:** sección dedicada en *Repasar* que drillea las palabras que el usuario
  falla más de lo que acierta (`times_incorrect > times_correct`), en modo
  tarjetas o escritura. Cuenta con badge en vivo.
- **Por qué:** concentrar esfuerzo en los puntos débiles es la palanca de mayor
  impacto en retención de un sistema SRS.
- **Archivos:** `lib/services/vocabularyService.ts` (`getDifficultVocabulary`,
  `getDifficultVocabularyCount`), `app/study/[id].tsx` (ruta `difficult`),
  `app/(tabs)/review.tsx`.

---

## 🔜 Propuestas (pendientes de validar en ejecución)

### 3. Sesiones mixtas (interleaving) — **alto impacto**
- **Qué:** mezclar en una misma sesión palabras nuevas + repasos pendientes en
  lugar de bloques puros (hoy *Aprender* = solo nuevas, *Repasar* = solo due).
  P. ej. 70% repaso / 30% nuevas, configurable.
- **Por qué:** el interleaving y la práctica espaciada mezclada están entre las
  técnicas con más evidencia para el aprendizaje a largo plazo.
- **Enfoque:** nuevo loader `getMixedSession(limit, ratio, cefrLevels)` que
  combine `getDueVocabulary` + `getNewVocabulary`, baraje y devuelva la mezcla.
  Botón "Sesión inteligente" en *Inicio*.
- **Esfuerzo:** medio. **Riesgo:** medio (cambia el flujo principal de estudio).
- **Archivos:** `vocabularyService.ts`, `app/study/[id].tsx` (ruta `smart`),
  `app/(tabs)/index.tsx`.

### 4. Modo escucha (listening) — **alto impacto, novedoso**
- **Qué:** ejercicio inverso: se reproduce la palabra/oración en inglés (TTS) y
  el usuario escribe o elige lo que oyó. Reutiliza la integración de
  `expo-speech` ya añadida.
- **Por qué:** entrena comprensión auditiva, una habilidad que la app hoy no
  ejercita.
- **Enfoque:** nueva tarjeta `ListeningCard` + modo `mode=listening` en el flujo
  de estudio; botón de "repetir audio".
- **Esfuerzo:** medio. **Riesgo:** bajo (aditivo).

### 5. Recuerdo por contexto (cloze de ejemplos) — **alto impacto**
- **Qué:** en vez de mostrar solo la palabra, presentar la *frase de ejemplo*
  con la palabra en hueco para que el usuario la recuerde en contexto.
- **Por qué:** recordar en contexto produce memoria más robusta y transferible
  que la traducción aislada. Los datos de ejemplo ya existen en el vocabulario.
- **Enfoque:** variante de `FlashCard`/`TypingCard` que use `example_sentence`
  con la palabra enmascarada (ya hay lógica de enmascarado en `TypingCard`).
- **Esfuerzo:** medio. **Riesgo:** bajo.

### 6. Meta de palabras nuevas/día + recordatorio — **impacto medio**
- **Qué:** límite configurable de palabras nuevas por día (evita sobrecarga) y
  notificación diaria a `reminderTime` (ya existe el ajuste, sin efecto hoy).
- **Por qué:** dosificar la introducción de material y la constancia diaria son
  claves en SRS; los recordatorios elevan la adherencia.
- **Enfoque:** respetar `cardsPerSession`/nuevo `newCardsPerDay` en los loaders;
  integrar `expo-notifications` para el recordatorio local.
- **Esfuerzo:** medio (requiere `expo-notifications` + permisos).

### 7. Panel de progreso por palabra y categoría — **impacto medio**
- **Qué:** vista de detalle con historial de aciertos/fallos, nivel de dominio y
  próxima revisión por palabra; mapa de calor de categorías.
- **Por qué:** la visibilidad del progreso motiva y orienta el estudio.
- **Esfuerzo:** medio. **Riesgo:** bajo (solo lectura).

### 8. Mecánica de racha mejorada (streak freeze) — **impacto bajo-medio**
- **Qué:** "congelar" la racha un día perdido (1-2 por semana) y recordatorio
  cuando la racha está en riesgo.
- **Por qué:** reduce el abandono por romper la racha, principal causa de churn
  en apps de hábitos.
- **Esfuerzo:** bajo-medio. **Riesgo:** bajo.

---

## Deuda técnica relacionada (no pedagógica, pero conviene)
- Migrar de TTS por endpoint no oficial a `expo-speech`: **hecho**.
- `AuthProvider` único en lugar de `useAuth` por componente: **hecho**.
- Considerar `expo-notifications` para 6 y 8.
