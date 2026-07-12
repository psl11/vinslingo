# Aprende con tu música

Feature para estudiar el vocabulario de la app **a través de las canciones que
el usuario escucha**: se cruzan las letras con la BD de vocabulario y se estudia
por tipo, por artista o por canción. En desarrollo por fases (ver estado abajo).

## Idea y modos previstos (UI, fase 4-5, pendiente)

Sección "Aprende con tu música" en el tab Aprender. Al entrar, se elige:

- **Por tipo**: vocabulario suelto, slang, phrasal, idiom… pero solo las palabras
  que aparecen en tu música.
- **Por artista**: p. ej. Linkin Park → todo el vocabulario asociado a sus
  canciones, mezclando categorías. Solo se muestran artistas con
  `>= MIN_ARTIST_WORDS` (8) palabras únicas, para que cada uno dé una ronda de
  verdad; el resto de artistas no se pierde (su vocabulario sigue en "Top
  recurrentes" y "Por tipo").
- **Top recurrentes**: las palabras que aparecen en más de tus canciones (mayor
  ROI para memorizar).

**"Por canción" descartado**: con media ~2,3 palabras únicas por canción (solo 2
canciones llegan a ≥8), un listado de 250+ temas sería ruido. Se agrupa por
artista en su lugar. La query soporta `songId` por si se retoma.
- **Buscador de huecos**: palabras frecuentes en tu música que **no** están en la
  BD — candidatas a añadir al contenido curado.

Detalles de diseño acordados:

- **Selector de nivel** (B1/B2/C1) en la sección (filtro barato de cambiar).
- **FSRS compartido**: son las mismas cartas de vocabulario, solo una vista
  filtrada por música; el progreso se comparte con el estudio normal.
- **Ancla inversa**: en la ficha normal de una palabra, mostrar "🎵 aparece en
  *Numb* (Linkin Park)" como gancho de memoria.

## Modelo de datos (reutiliza tablas existentes)

Ya existían en Supabase (seed genérico del 5-jul, sin usar). Se **reutilizan**:

- **`artists`** (`id`, `name`, `image_url`) → habilita el eje "por artista".
- **`songs`** (`id`, `artist_id`, `title`, `album`, `year`, `lyrics_excerpt`,
  `source`, `rank`) → `source='user'` distingue la música importada del seed
  genérico (`source='seed'`), que queda intacto pero invisible. **No se guarda la
  letra** (`lyrics_excerpt=''`). `rank` = posición en el catálogo (tu top personal
  primero, luego las colecciones "This Is" ya ordenadas por popularidad).
- **`song_vocabulary`** (`song_id`, `vocabulary_id`, `line_text`,
  `line_translation`, `highlighted_word`, `line_index`) → la "BD de matches".

Columnas añadidas por `ALTER` (las de usuario se insertan con `source='user'`):
`songs.source` (`text NOT NULL DEFAULT 'seed'`), `songs.rank` (`integer`),
`song_vocabulary.line_translation` (`text`, de momento sin poblar).

## Verso de contexto en la ficha (gancho de memoria)

Al estudiar en la sección de música, la ficha muestra —además del significado y
los ejemplos— el **verso real de tu canción** donde aparece la palabra. Reglas:

- **Contexto de 3 líneas**: `line_text` guarda la línea anterior, la de la palabra
  y la posterior (ancla más fuerte al escuchar la canción). La palabra va en
  **negrita** usando `highlighted_word`, que guarda la **forma exacta** que
  aparece en el verso (flexión incluida), no la canónica.
- **Prioridad por `rank`**: cuando una palabra sale en varias canciones, se muestra
  el verso de la de **menor rank** (tu canción más escuchada; si no está en tu top,
  la más popular del artista). Orden en `getMusicVocabulary` (`ORDER BY s.rank ASC`).
- **Bloque unificado**: si hay verso de tu música, se **oculta** el "ancla" del
  phrasal (título famoso), para no mostrar dos tarjetas de canción. El bloque lleva
  botón **▶ Escuchar en Spotify** (canción/artista reales) y un hueco para la
  traducción del verso (`line_translation`, se pinta cuando exista el dato).

## Copyright

Las letras **nunca** se versionan en el repo, ni se guardan completas en la BD,
ni se reproducen en respuestas. Solo se persiste:

- El **enlace** palabra↔canción (referencias, no texto).
- La **línea de contexto** (`line_text`) de cada match — un fragmento corto, en
  línea con la postura del usuario sobre excerpts (ver
  [`project_song_lyrics_copyright`] en memoria).

`letras-playlist.txt` (descarga local de letras completas para el cruce) está en
`.gitignore` y es de uso personal.

## Pipeline (scripts)

1. **[`scripts/music-catalog.json`](../scripts/music-catalog.json)** — lista
   maestra de canciones (título, artista, URL directa de Genius **verificada por
   HTTP**). Ampliar = añadir entradas aquí. Estado actual: 449 canciones
   (playlists top personal, "This Is" de Linkin Park / Killers / Beatles /
   Metallica / Coldplay / JAY-Z, setlist de Oasis y una playlist propia de hip-hop).
2. **[`scripts/download-lyrics.mjs`](../scripts/download-lyrics.mjs)** — descarga
   local (uso personal) de las letras del catálogo desde Genius vía `curl`, sin
   dependencias. **Reanudable**: reutiliza las ya presentes en
   `letras-playlist.txt` (por nº) y solo baja las que faltan. Extrae la letra por
   profundidad de `<div data-lyrics-container>` (sin créditos ni coletillas).
3. **[`scripts/match-music.mjs`](../scripts/match-music.mjs)** — cruza
   `letras-playlist.txt` contra `vocabulary.json` y saca un informe (por
   categoría, top recurrentes, por artista). Con `--apply` hace upsert
   idempotente (ids deterministas) a `artists`/`songs`/`song_vocabulary` en
   Supabase. Reutiliza id de canciones/artistas existentes por clave natural
   (evita violar `unique (artist_id, title)`; las que coinciden con el seed se
   adoptan como `source='user'`).

Tras `--apply`: `npm run backup:supabase` + commit (regla de backup en
[`CLAUDE.md`](../CLAUDE.md); `CONTENT_TABLES` ya incluye las tres tablas).

## Política de matching (clave: precisión sobre recall)

El estándar de exactitud del contenido es sagrado, así que el cruce es
conservador (ver [`match-music.mjs`](../scripts/match-music.mjs)):

- **Alcance**: categorías "jugosas" (phrasal, idiom, expresión, colocación,
  slang, false friend) en **A2+** — un phrasal o un falso amigo vale la pena
  aunque esté etiquetado A2, y así muchas más canciones (pop/rock melódico)
  encuentran contenido útil (cobertura ~48%→69%). El vocabulario suelto `ngsl`
  se queda en B1 a propósito: bajarlo a A2 solo metería palabras básicas
  (love, night, you…) que ya se dominan = ruido. Los `connector`, fuera.
- **Homógrafos fuera**: slang de una palabra que coincide con una palabra común
  (long, fire, sick, beat, ride, fit, broke…) se excluye del auto-match —
  matcharía su sentido cotidiano, no el del slang. Se detectan por coincidencia
  con el ngsl básico **y** una blocklist curada a mano (`SLANG_HOMOGRAPHS` en
  `match-music.mjs`, ~50 términos) para los comunes que no están en la BD.
- **Lematización**: inflexiones (running→run, tomó→take) con mapa de irregulares;
  phrasals **separables** con hueco (*take it off*, *pick you up*).
- **Cross-line fuera**: un match que solo casa cruzando líneas (hueco de phrasal
  separable que salta un `\n`) se descarta — contexto no localizable y de baja
  precisión.

## Estado

- ✅ **Datos**: catálogo de **518 canciones** cargadas (`source='user'`), **993
  matches** (A2+ jugoso), con verso de contexto (3 líneas), `highlighted_word`
  exacto y `rank`.
- ✅ **Sync cliente**: tablas locales `songs`/`artists`/`song_vocabulary` +
  `syncMusicFromSupabase` (full replace gateado, degrada con gracia).
- ✅ **UI**: sección "Aprende con tu música" (hub con **Top recurrentes / Por tipo
  / Por artista ≥8**), estudio con flashcard/typing (FSRS compartido), verso de la
  canción con la palabra en negrita + Spotify.
- ✅ **Ancla inversa**: en el estudio **normal** (repaso, lección, falladas…), si la
  palabra aparece en tu música se muestra su verso (misma prioridad por rank).
  `attachMusicContext` en [`musicService`](../lib/services/musicService.ts), llamado
  desde [`study/[id].tsx`](../app/study/[id].tsx) para todo `id !== 'music'`.
- ⏳ **Pendiente**: traducción del verso (`line_translation`, sin poblar) y
  **selector de nivel** dedicado en el hub.
