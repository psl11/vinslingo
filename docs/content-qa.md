# QA del contenido (validador)

El contenido del vocabulario **no está estructurado** en la BD: el campo
`translation` lleva formatos convenidos que el parser
([`translationParser.ts`](../lib/vocabulary/translationParser.ts)) interpreta para
maquetar la ficha. Como no hay esquema que lo garantice, el validador es la red
de seguridad.

```bash
npm run validate:content   # tsx scripts/validate-translations.ts
```

Valida el **backup local** (`supabase/backup/vocabulary.json`) con el **mismo
parser que la app**, así que caza los fallos antes de que se vean en la ficha.
Sale con código 1 si hay ERRORES (útil para CI). Ejecuta
`npm run backup:supabase` antes si acabas de editar Supabase.

## Qué comprueba

**Estructura** (rompen la maquetación):
- Texto numerado que no parsea como acepciones (p. ej. `(1) … (2) …` en vez de
  `HEADER — 1) … 2) …`), o nº de acepciones ≠ nº de marcadores `N)`.
- Acepción sin descripción; ejemplo sin inglés.
- Par confuso (`A = x | B = y`) mal formado.
- Comillas o paréntesis descuadrados.

**Artefactos de limpieza** — la explicación de los monosémicos se muestra sin los
ejemplos incrustados (viven en `example_sentence`), así que se vigila que al
quitarlos no quede basura:
- Marcador huérfano al final (`… haciendo algo. Ej`) ← el bug que originó esto.
- Comilla suelta, signo colgante, o explicación sospechosamente corta.

**Ejemplos que ilustran SU palabra** — caza el fallo intolerable de una ficha de
`take off` con un ejemplo de `turn off`. Con lematización (irregulares,
flexiones, grados del adjetivo, phrasals separables). **Conservador a propósito**:
solo comprueba entradas donde la palabra aparece literal (una palabra, o
phrasal verbo+partícula). Las expresiones/idioms son plantillas
(*"I'm fed up with"* → *"She's fed up with…"*) que el ejemplo adapta
legítimamente, así que comprobarlas solo daría falsos positivos.

## Regla de la mini-gramática (polisemia)

Un phrasal **polisémico** debe ir en formato de **acepciones numeradas** y tener
`formal_synonym` y `separability` **a `null`**: un valor único engañaría, porque
depende de la acepción (ver [`features.md`](features.md)). El validador caza el
síntoma típico: una numeración huérfana (`1)` sin `2)`) hace que un polisémico
parsee como monosémico y la ficha le muestre una mini-gramática que no toca.

## Arreglos aplicados

[`scripts/fix-content-issues.mjs`](../scripts/fix-content-issues.mjs) (dry-run /
`--apply`, idempotente) corrigió los 6 errores de la primera pasada: `turn on` y
`wipe out` (polisémicos con `1)` huérfano → acepciones + mini-gramática a null),
`kick off` y `hang out` (andamiaje suelto → prosa limpia), `tight` (formato
`(N)`; corregido también en [`seed-slang.ts`](../scripts/seed-slang.ts) para que
no revierta al re-sembrar) y `honor` (ejemplo con la grafía británica *honour*).

Tras tocar contenido: `npm run backup:supabase` + `npm run validate:content` +
commit (ver regla de backup en [`CLAUDE.md`](../CLAUDE.md)).
