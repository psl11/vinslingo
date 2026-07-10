# Features de aprendizaje

Resumen de las funcionalidades de estudio recientes y cómo están montadas, para
tener el contexto sin leer todo el código. Ver también
[`docs/design-system.md`](design-system.md) (UI) y
[`docs/fsrs-migration.md`](fsrs-migration.md) (scheduler).

## Palabras más falladas

Pantalla [`app/failed-words.tsx`](../app/failed-words.tsx) para ver y repasar las
palabras que más se te resisten. Entrada: tarjeta "🔥 Palabras más falladas" en
el tab Aprender.

- Listado de palabras con ≥1 fallo, ordenadas por nº de fallos ↓, con un tag
  "❌ N". Reutiliza [`VocabResultCard`](../components/vocabulary/VocabResultCard.tsx)
  (la misma ficha del buscador, con `headerBadge`).
- Arriba: toggle de alcance (**Todas** / **Solo no dominadas**), selector de
  "tarjetas por ronda" y dos CTA (**Tarjetas** / **Escribir**) que lanzan un
  cuestionario con esas palabras.
- Respeta el filtro de nivel CEFR del perfil. Se recarga al enfocar (refleja los
  fallos tras un cuestionario).
- Datos: `getMostFailedVocabulary({ onlyNotMastered, cefrLevels, limit })` en
  [`vocabularyService`](../lib/services/vocabularyService.ts) —
  `times_incorrect > 0`, orden DESC. "No dominada" = `mastery_level < 3`.
- El cuestionario entra por `/study/failed`; el motor lee `id === 'failed'` y el
  `scope` del toggle (ver [`app/study/[id].tsx`](../app/study/[id].tsx)).

## Estudiar por partícula (phrasal verbs)

Agrupa los phrasal verbs por su partícula (UP, OUT, OFF…) para reforzar el
patrón metafórico de la partícula (enfoque cognitivo de Rudzka-Ostyn). Fila de
chips de partícula en la tarjeta de Phrasal Verbs del tab Aprender → lanza
`/study/phave?particle=up`.

- `extractParticle(word)` y `KNOWN_PARTICLES` en
  [`particleHints.ts`](../lib/vocabulary/particleHints.ts).
- `getVocabularyByParticle(particle, limit, cefrLevels)` en `vocabularyService`.

## Mini-gramática de phrasal verbs (sinónimo formal + separabilidad)

En el reverso de la ficha de un phrasal verb se muestra:

- **Sinónimo formal** de una palabra (`put off ≈ postpone`), primando el cognado
  latino que el hispanohablante reconoce (enseña significado + registro).
- **Separabilidad**: separable / inseparable / intransitivo, con un ejemplo
  construido con el PROPIO verbo de la ficha (`take it off`, `look after it`).

Reglas importantes (ver [`phaveGrammar.ts`](../lib/vocabulary/phaveGrammar.ts)):

- **Solo se muestra en phrasals MONOSÉMICOS.** En un polisémico (`take off` =
  despegar/quitarse/triunfar) tanto el sinónimo como la separabilidad dependen de
  la acepción, así que un único valor engañaría. La polisemia se detecta con
  `analyzeTranslation(...).kind === 'senses'` (≥2 acepciones numeradas).
- Columnas en Supabase: `vocabulary.formal_synonym` y `vocabulary.separability`
  (solo pobladas para los monosémicos; los 89 polisémicos quedan en `null`).
- Contenido generado con [`scripts/set-phave-grammar.ts`](../scripts/set-phave-grammar.ts)
  (dry-run / `--apply`). Tras aplicar: `npm run backup:supabase` + commit (ver
  regla de backup en [`CLAUDE.md`](../CLAUDE.md)).

## Slang británico y americano

Dos categorías de vocabulario, **`british_slang`** y **`american_slang`** (~40
cada una), con la jerga del día a día etiquetada por registro en la traducción:
casual (sin nota), `(malsonante)` y `(vulgar)`. Nivel CEFR B2. Se excluyen
insultos contra grupos protegidos; sí se incluye profanidad común con aviso.
Además, un puñado de **trampas UK↔US** (mismo término, sentido distinto:
*pissed*, *fanny*, *fag*, *pants*, *rubber*, *bum*, *piss off*) como
`confusing_pair`.

- Contenido curado contra bibliografía de referencia (Green's Dictionary of
  Slang, New Partridge, corpora COCA/BNC/GloWbE para vigencia y región).
- Generado con [`scripts/seed-slang.ts`](../scripts/seed-slang.ts) (dry-run /
  `--apply`; idempotente). Tras aplicar: `npm run backup:supabase` + commit.
- Las categorías están cableadas en el tab Aprender, Repasar y el buscador.

## Ancla (canción/película/libro)

Cada phrasal verb puede llevar un "ancla": un título famoso que contiene el
phrasal, para memorizar. Se prima la fama del ancla sobre la coincidencia exacta
del título. Columnas `song_title`/`song_artist`/`anchor_type`/`anchor_year`;
helpers en [`anchor.ts`](../lib/vocabulary/anchor.ts); contenido en
[`scripts/set-phrasal-anchors.ts`](../scripts/set-phrasal-anchors.ts).
