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
- **Conector colgante** (`Similar a .`, `… Opuesto`): la explicación remitía a algo
  entrecomillado —otro phrasal, un ejemplo— y la limpieza se llevó la referencia,
  dejando el conector solo. Misma familia que el `Ej`, pero sin marcador.
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

[`scripts/enrich-thin-explanations.mjs`](../scripts/enrich-thin-explanations.mjs)
(dry-run / `--apply`, idempotente) reescribió 10 phrasal verbs cuya explicación
era una etiqueta sin contenido: `carry on` y `move out` estaban **rotos** por el
conector colgante de arriba; `bring about` y `call for` tenían de explicación
entera `"Formal."`; y `look at`, `go up`, `go down`, `sit down`, `come in`,
`go out` traían una línea que no decía nada que la cabecera no dijera ya
(*"Se usa para descensos."* bajo *BAJAR / REDUCIRSE*).

**Al redactar una explicación:**

- **Sin comillas.** Los ejemplos viven en `example_sentence`; todo lo entrecomillado
  desaparece al maquetar la ficha, y lo que remita a ello queda colgando.
- **Dentro de la acepción actual.** Ampliar el significado vuelve polisémica la
  entrada y obliga a anular su mini-gramática (ver la regla de arriba).
- Explicar **cuándo y cómo** se usa (registro, matiz, contraste con un sinónimo,
  la preposición que pide), no repetir la cabecera.
- Una explicación **vacía es válida**: si los ejemplos ya cargan el significado,
  mejor nada que una etiqueta de relleno.

[`scripts/fix-confusing-pair-examples.mjs`](../scripts/fix-confusing-pair-examples.mjs)
puso ejemplos a las 7 trampas UK↔US de `confusing_pair` (*pissed*, *piss off*,
*fanny*, *fag*, *bum*, *pants*, *rubber*) que salían con la comparación a secas,
mientras que las otras 50 de la categoría sí los traían. Convención: ej1 = uso
británico, ej2 = uso americano. **`fag` se queda sin ejemplo americano a
propósito**: ese sentido es un insulto homófobo y la ficha existe para avisar de
que no se use, así que un ejemplo de uso sería contraproducente.

[`scripts/delete-duplicate-entries.mjs`](../scripts/delete-duplicate-entries.mjs)
borró dos fichas que salían dos veces al estudiar: `hang out` [`american_slang`]
(duplicaba la de `phave`, que trae explicación y mini-gramática — y además no es
jerga, es un phrasal mainstream; quitada también de
[`seed-slang.ts`](../scripts/seed-slang.ts) para que no vuelva al re-sembrar) y
`keep in mind` [`expression`] (duplicaba la de `collocation`, que es donde
encaja). Antes de borrar comprueba que no haya filas en `user_vocabulary`,
`song_vocabulary` ni `quote_vocabulary`, y aborta si las hay.

**Un borrado tarda hasta 7 días en verse en el dispositivo**: el sync es
incremental por `updated_at` y no detecta filas borradas en el servidor; se
propaga en el siguiente full resync (ver [`CLAUDE.md`](../CLAUDE.md)).

## Curado del contenido no-ngsl (694 entradas)

Barrido de calidad sobre las 9 categorías editoriales (`phave`, los dos slang,
`confusing_pair`, `idiom`, `collocation`, `expression`, `false_friend`,
`connector`). Lo que el validador **no** mira, porque no rompe la maquetación:

- Campos vacíos (ejemplo, traducción del ejemplo, pronunciación) por categoría.
- Ejemplo 1 == ejemplo 2, y palabras repetidas en más de una categoría.
- Coherencia de formato dentro de cada categoría (`raw` / `term` / `senses` /
  `comparison`).

Estado tras el curado: sin fichas sin ejemplo, sin ejemplos duplicados, y ninguna
polisémica con mini-gramática. Dos cosas que **son deliberadas y no hay que
"arreglar"**:

- **Palabra en varias categorías** (~75): casi todas a propósito — un `connector`
  o un `false_friend` comparte palabra con `ngsl` justo para enseñar otro
  sentido (*college*, *actually*, *sick*, *fire*).
- **67 entradas sin pronunciación**: jerga que el dataset `ipa-dict` no recoge
  (*rizz*, *bussin*, *mandem*, *gobby*) y los títulos con sufijo
  (*"pissed (UK vs US)"*). Es la política de
  [`pronunciation.md`](pronunciation.md): mejor nada que a medias.

Tras tocar contenido: `npm run backup:supabase` + `npm run validate:content` +
commit (ver regla de backup en [`CLAUDE.md`](../CLAUDE.md)).
