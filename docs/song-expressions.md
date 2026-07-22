# Expresiones de canciones (extractor LLM) — diseño

**Estado: primer lote de 30 canciones cargado** (fases 1–2). 124 fichas
`colloquial` en `vocabulary` (con 93 anclas a `song_vocabulary`) + 36 `song_notes`.
Cargado con [`scripts/load-song-expressions.mjs`](../scripts/load-song-expressions.mjs)
desde mazos generados en sesión. Falta: render de `song_notes` en la ficha
(con verso + tooltips de siglas), modo por canción, y escalar al resto del
catálogo. Complementa [`music-feature.md`](music-feature.md).

## Por qué: el matcher actual va en la dirección equivocada

`match-music.mjs` cruza **BD curada → canciones**: coge las ~700 palabras
curadas y busca cuáles salen en las letras. Eso solo puede enseñar **lo que ya
está en la BD**. Pero lo que un hispanohablante no entiende al leer una letra es,
por definición, **la cola larga que NO está en una lista curada**: contracciones
(*I'ma*, *gonna*, *wadn't*), gramática AAVE (*she don't*, cópula cero, doble
negación), slang no curado (*crib*, *sweat someone*), y referencias culturales
(*Uncle Phil*, *Dreamville*). Ni bajar el suelo CEFR ni añadir C1/C2 captura eso,
porque no está en la BD a ningún nivel.

Medido sobre "No Role Modelz" (J. Cole): el matcher curado encontró **1** palabra
(*for good*); el extractor LLM saca **~31 fichas** de material real. Ese es el
salto.

La solución es **darle la vuelta**: canción → LLM → "qué es difícil aquí + por
qué, en español". La app ya está construida con Claude, así que es natural.

## Dos capas (según la naturaleza del contenido)

Lo extraído es de dos tipos y se tratan distinto:

- **Capa 1 — Coloquial (vocabulario global, estudiable).** Contracciones,
  gramática AAVE, slang, idioms. Es **inglés reutilizable** (*I'ma* sale en
  100 canciones). → tabla `vocabulary`, categoría nueva `colloquial`,
  **deduplicado** (una ficha, anclada a las N canciones donde aparece vía
  `song_vocabulary`). Se estudia como el slang: FSRS, drill, más-falladas, todo
  el aparato existente gratis (el motor trabaja sobre `VocabularyItem`).
- **Capa 2 — Notas de la canción (contextual, por canción).** Referencias
  culturales y juegos de palabras. Es de **una canción concreta**, no vocabulario
  suelto que repases. → tabla ligera nueva `song_notes`, se muestra al estudiar
  esa canción o en el lector, **no entra en el repaso espaciado** (repasar
  "Uncle Phil" cada 3 días no tiene sentido). **Lleva SIEMPRE el verso de
  contexto** (`line_text`): sin él no se entiende POR QUÉ el artista usa esa
  expresión ahí (que Uncle Phil sea el padre que nunca tuvo solo se capta viendo
  el verso). Mismo límite de copyright que el resto: el verso de contexto (hasta
  3 líneas), nunca la letra completa.

## Modelo de datos

- **Capa 1**: filas normales de `vocabulary` con `category='colloquial'`. `word` =
  la expresión; `translation` = `CABECERA — explicación` (mismo formato que el
  parser ya entiende); `example_sentence`/`_translation` = ejemplo **propio**
  (NO el verso), como en el resto. CEFR B1/B2 según dificultad/registro (como el
  slang, que es B2). ID determinista `detId('colloquial:' + word)` para
  idempotencia. Ancla a canciones = filas en `song_vocabulary` (reutiliza
  `line_text`/`highlighted_word`/`line_index`).
- **Capa 2**: `song_notes(id, song_id, kind, term, explanation, line_text)`,
  `kind ∈ {reference, wordplay}`. `line_text` **obligatorio** (el verso de
  contexto, hasta 3 líneas). Añadir a `CONTENT_TABLES` del backup.

### Estándar de redacción de las notas (capa 2)

Escritas para un **no nativo**, con cariño, no como una nota de pie de página
seca. Cada nota debe:

1. **Definir la expresión primero** si es una locución (no dar por sabido qué es
   un "role model": explicar que es un referente, un modelo a seguir).
2. **Explicar la ironía/el juego de forma explícita**, no insinuarla. Mal:
   "el título es irónico". Bien: "dice que NO tiene modelos, pero acto seguido
   enumera a las mujeres que sí admira — ahí está la ironía".
3. **Anclarse al verso** (`line_text`): referir qué dice el verso y por qué esa
   palabra ahí (Uncle Phil → "el único padre que conoció", por eso es su figura
   paterna). El verso se muestra junto a la nota.

## Generación: en sesión, sin API

**No se usa la API de Claude.** El contenido es **estático y reutilizable**: una
vez extraído de una canción, no cambia nunca. Pagar llamadas de API en tiempo de
ejecución para regenerar siempre lo mismo no tiene sentido. La extracción la hace
**Claude en la propia sesión de Claude Code** (la suscripción que ya se paga),
leyendo las letras offline, por lotes, una sola vez. El resultado se persiste en
Supabase y de ahí se sincroniza a todos los dispositivos: se genera una vez, se
reutiliza siempre.

Flujo por lote (~10 canciones):

1. Un script extrae de `letras-playlist.txt` (local, **gitignored**) las N
   canciones del lote a ficheros de trabajo (no se vuelca letra al chat).
2. Claude (esta sesión) analiza cada una y produce el mazo:
   `{expresión, tipo, registro, explicación_es, ejemplo_en, ejemplo_es, verso}`.
3. Un script de carga (idempotente, `detId`, dry-run / `--apply`) dedup-a la
   capa 1, separa capa 1 / capa 2 por `tipo`, ancla la capa 1 a `song_vocabulary`
   y sube todo → `npm run backup:supabase` → `npm run validate:content`.

Idempotente, IDs deterministas (no churn de IDs, ver `music-feature.md`).

## Siglas: glosario + tooltip

Las explicaciones usan siglas útiles (AAVE, RIP, MLE…). En vez de gastar texto
repitiendo la expansión, se marca la sigla **subrayada** y al pinchar/hover
aparece un globito con el significado (p. ej. AAVE → "African American Vernacular
English · el inglés vernáculo afroamericano"). Se mantiene un glosario pequeño
`term → expansión` y el render de ficha/nota subraya las coincidencias. Fallback
accesible: la expansión también entre paréntesis la primera vez si no hay hover
(móvil sin puntero → tap).

## Reglas duras de contenido (no negociables)

1. **Filtro de slurs**: nada contra grupos protegidos. El n-word, omnipresente en
   el rap, **nunca** se convierte en ficha (misma regla que
   [`seed-slang.ts`](../scripts/seed-slang.ts)).
2. **Registro heredado**: lo malsonante/vulgar entra con su nota, como el slang.
3. **Copyright**: explicación + línea corta de contexto, **nunca la letra
   completa** (misma política que toda la feature de música). La capa 2 ni
   siquiera necesita verso.
4. **Provenance separada**: `category='colloquial'` distinta de las curadas a
   mano, para no contaminar el estándar de curación. Revisable y regenerable.

## UI: dentro del hub "Aprende con tu música"

La capa 1, al ser `vocabulary` anclada a canciones, **aparece sola** en el hub
(nuevo tipo "Coloquial 🗣️" en Top recurrentes / Por tipo / Por artista) y admite
los ejercicios del drill; el de **huecos** encaja especialmente. La capa 2 se
muestra en el (futuro) modo por canción y como contexto al estudiar. No hay
pantallas nuevas de nivel superior: el contenido nace de las canciones y se
estudia junto a ellas.

## Fases

1. **Primer lote (~10 canciones, en sesión)**: Claude extrae, se revisa el
   estándar de redacción, se carga capa 1 + capa 2 en la BD.
2. **Siguientes lotes** hasta ~30 para validar calidad por géneros (rock, pop
   melódico, slang UK, no solo rap).
3. **UI**: tipo "Coloquial" en el hub (capa 1, sale solo) + render de notas
   (capa 2) con verso y tooltips de siglas.
4. **Modo por canción**: elige canción → fichas coloquiales + notas → drill.
5. **Escalar** al resto del catálogo por lotes, en sesión, tras validar calidad.
