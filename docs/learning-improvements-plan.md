# Plan de mejoras de aprendizaje — VinsLingo

Hoja de ruta de mejoras pedagógicas, ordenadas por relación impacto/esfuerzo.
El estado refleja lo integrado en el branch.

## ✅ Hecho

### 1. Auto-pronunciación de flashcards
Al mostrar la cara frontal de una flashcard se reproduce la palabra (TTS nativo
vía `expo-speech`), respetando `autoPlayAudio` y `soundEnabled`. La doble
codificación (ver + oír) mejora la retención y la pronunciación.
- `components/cards/FlashCard.tsx`, `lib/services/audioService.ts`.

### 2. Repaso de "Palabras difíciles" (leeches)
Sección en *Repasar* que drillea las palabras que el usuario falla más de lo que
acierta (`times_incorrect > times_correct`), en modo tarjetas o escritura, con
badge de conteo. Concentrar esfuerzo en los puntos débiles es la mayor palanca
de retención de un SRS.
- `vocabularyService.ts`, `app/study/[id].tsx` (ruta `difficult`), `app/(tabs)/review.tsx`.

### 3. Sesiones mixtas (interleaving)
`getSmartSession` combina ~70% repasos due + 30% palabras nuevas, barajados
(Fisher-Yates). La práctica espaciada mezclada supera a estudiar bloques puros.
Botón "⚡ Sesión Inteligente" en *Inicio*, ruta `/study/smart`.
- `vocabularyService.ts`, `app/study/[id].tsx`, `app/(tabs)/index.tsx`.

### 4. Modo escucha (listening)
`ListeningCard` reproduce la palabra (TTS) y el usuario escribe lo que oye
(dictado, con fuzzy match). Entrena comprensión auditiva y ortografía.
Accesible desde *Repasar* → "🎧 Escuchar".
- `components/cards/ListeningCard.tsx`, `app/study/[id].tsx`, `app/(tabs)/review.tsx`.

### 5. Recuerdo por contexto (cloze de ejemplos)
`ClozeCard` muestra la frase de ejemplo con la palabra en hueco y la traducción
como pista. Recordar en contexto produce memoria más robusta y transferible.
Accesible desde *Repasar* → "📄 Contexto"; cae a modo escritura si la palabra
no tiene frase de ejemplo.
- `components/cards/ClozeCard.tsx`, `app/study/[id].tsx`, `app/(tabs)/review.tsx`.

---

## 🔜 Propuestas pendientes

### 6. Meta de palabras nuevas/día + recordatorio — **impacto medio**
- **Qué:** límite configurable de palabras nuevas por día (evita sobrecarga) y
  notificación diaria a `reminderTime` (el ajuste existe pero no tiene efecto).
- **Por qué:** dosificar el material nuevo y la constancia diaria son claves en
  SRS; los recordatorios elevan la adherencia.
- **Enfoque:** respetar un `newCardsPerDay` en los loaders (contar nuevas
  introducidas hoy); integrar `expo-notifications` para el recordatorio local.
- **Esfuerzo:** medio (requiere `expo-notifications` + permisos).

### 7. Panel de progreso por palabra y categoría — **impacto medio**
- **Qué:** detalle con historial de aciertos/fallos, nivel de dominio y próxima
  revisión por palabra; mapa de calor por categoría.
- **Por qué:** la visibilidad del progreso motiva y orienta el estudio.
- **Esfuerzo:** medio. **Riesgo:** bajo (solo lectura).

### 8. Mecánica de racha mejorada (streak freeze) — **impacto bajo-medio**
- **Qué:** "congelar" la racha un día perdido (1-2/semana) y avisar cuando la
  racha está en riesgo.
- **Por qué:** reduce el abandono por romper la racha.
- **Esfuerzo:** bajo-medio. **Riesgo:** bajo.

### 9. Modos escucha/contexto también en lecciones nuevas — **impacto bajo**
- Hoy están en *Repasar*. Ofrecerlos también al aprender palabras nuevas desde
  *Aprender* ampliaría su uso (cuidando no saturar la UI de botones).

---

## Deuda técnica (hecha)
- TTS por `expo-speech` en vez de endpoint no oficial: ✅
- `AuthProvider` único en vez de `useAuth` por componente: ✅
- Integridad de `user_vocabulary` (UNIQUE + dedup) y paginación de sync: ✅
- Limpieza de código muerto (`createUserVocabulary`, `getUnsyncedRecords`,
  `markAsSynced`, `checkNeedsResync`): ✅

## Notas
- Las pantallas y el audio nativo no se pueden ejecutar en el entorno de
  desarrollo remoto (sin device ni claves Supabase); todo está verificado por
  tipos y sigue las APIs oficiales de SDK 54. Conviene una prueba en
  dispositivo/EAS antes de publicar.
