# Guiones de podcast por canción

Capa de contexto más ancha de la feature de música: **la historia de la canción**.
Por qué existe, qué le pasaba al grupo cuando la escribió, de dónde salen los
versos — y esos versos comentados en inglés y en español.

Se ve en la pantalla de canción ([`app/song.tsx`](../app/song.tsx)), **delante de
las notas**. El orden de la pantalla es deliberado y va de lo ancho a lo fino:

| Capa | Qué es | Dónde vive |
|---|---|---|
| 🎙️ Guion | La historia de la canción | JSON empaquetado (esta doc) |
| 📓 Notas | Referencias y juegos de palabras | Supabase, tabla `song_notes` |
| 🗣️ Vocabulario | Fichas que se repasan con FSRS | Supabase, `vocabulary` + `song_vocabulary` |

## Pipeline

```
guiones-podcast/*.md  →  scripts/build-podcast-scripts.mjs  →  lib/data/podcast/<artista>.json
   (gitignored)                                                   (versionado, uno por artista)
                                                              →  lib/data/podcastScriptIndex.json
                                                                  (solo las claves, ~3 KB)
                                                              →  lib/data/podcastScripts.json
                                                                  (gitignored, solo análisis y tests)
```

```bash
node scripts/build-podcast-scripts.mjs
```

Los `.md` son **el espacio de trabajo de autoría** y están gitignored: llevan
notas de producción, avisos de fiabilidad y citas largas de las fuentes. Lo que
se versiona y se publica es el JSON compilado.

**Hay que recompilar y commitear el JSON** cada vez que se toca un `.md`, o el
cambio no llega a la app.

### Por qué un JSON empaquetado y no una tabla de Supabase

Es la decisión de diseño que conviene entender antes de "arreglarla":

- Los guiones son **contenido editorial que se escribe offline en el repo**, no
  datos que cambien en caliente. No necesitan sync, ni marca de agua, ni
  `updated_at`.
- **Sobreviven a una caída de Supabase.** El proyecto ya se cayó una vez (ver
  CLAUDE.md → "Backup del contenido de Supabase"); el guion es demasiado trabajo
  como para dejarlo colgando de eso.
- Se cargan con **`import()` diferido**, así que van en su propio chunk y no
  penalizan el arranque de la app.

### Un fichero por artista, no uno solo

Al pasar de 150 guiones, el JSON único superó **1 MB** — y la app se lo descargaba
entero para enseñar un guion de 6 KB. Ahora se emite **un fichero por artista** y
abrir una canción de Oasis baja ~140 KB en vez de ~1 MB.

El mapa de carga vive en [`lib/data/scriptChunks.ts`](../lib/data/scriptChunks.ts)
y es **explícito**, con una línea por artista. No es una plantilla del tipo
``import(`./podcast/${a}.json`)`` porque **Metro necesita rutas literales** para
trocear el bundle: con una ruta dinámica no sabe qué ficheros existen y acaba
empaquetándolos todos, que es justo lo que se quería evitar.

**Al añadir un artista nuevo hay que añadir su línea a ese mapa.** Si falta, la
canción simplemente no enseña guion; no falla.

Se parte por artista y no por canción porque un fichero por canción exigiría 150
imports literales. Por artista son 8 y caben en un mapa legible.

### Cómo se enlaza un guion con su canción

Por `título|artista` normalizados (minúsculas, sin acentos ni signos), **no** por
`songId`: el `.md` no conoce los IDs de la base de datos. Si el artista del
catálogo viene compuesto (`"Jay-Z, Kanye West"`), se compara contra el primero.

Consecuencia práctica: **si el título del `.md` no coincide con el del catálogo,
el guion no aparece y no falla nada** — degrada en silencio. Si un guion no sale
en la app, lo primero que hay que mirar es el título.

## Formato del `.md`

El parser es a propósito un subconjunto mínimo de Markdown. Reconoce:

```markdown
# Título — Artista            ← el guion "—" es obligatorio, separa los dos campos
### Guion de podcast · Capítulo N

> **Ficha técnica** · ...     ← las citas antes del primer ## son la ficha
> más líneas de ficha

## 1. Arranque en frío         ← la numeración se quita al compilar
Párrafos normales con **negrita** y *cursiva*.

> Cita en bloque (cortes de audio, notas de fiabilidad).

## 3. Los versos, comentados
**«El verso en inglés»**       ← abre una tarjeta de verso
*Qué dice:* explicación en español.
*El inglés:* el punto gramatical o de vocabulario.

## Fuentes
- Lista de fuentes.
```

Todo lo que no encaje cae a párrafo, así que un `.md` raro no rompe el build.

El marcado en línea lo resuelve [`lib/utils/inlineMarkdown.ts`](../lib/utils/inlineMarkdown.ts),
que es un escáner recursivo y no una regex: las marcas **se anidan de verdad** en
los guiones (`**Se llamaba *Wishing Stone*.**`) y una regex plana o se come el
asterisco de la negrita o parte el fragmento por la mitad.

## Fuentes y fiabilidad

El material sale de tres sitios, y **no valen lo mismo**:

1. **Declaraciones del propio autor** en medios identificables. Terreno firme.
2. **Anotaciones de la API de Genius** ([`scripts/download-genius-annotations.mjs`](../scripts/download-genius-annotations.mjs)),
   volcadas a `genius-anotaciones/` (gitignored). Ojo: la inmensa mayoría las
   escriben colaboradores, **no el artista**. De las 218 anotaciones de Oasis,
   **ninguna** está verificada por la banda.
3. Prensa musical y fichas de referencia.

Por eso **cada guion cierra con una nota de fiabilidad** que separa lo que dijo el
autor de lo que interpreta un colaborador anónimo. Es la parte más importante del
formato: sin ella, una teoría con muchos votos en Genius se lee igual que una cita
confirmada.

Para cruzar la letra local con sus anotaciones y ver cada explicación bajo su
verso: [`scripts/merge-lyrics-annotations.mjs`](../scripts/merge-lyrics-annotations.mjs).

## Copyright

Los guiones son **comentario**: citan versos sueltos, atribuidos, para explicarlos.
No reproducen letras completas ni las traducen enteras — una traducción íntegra
sería obra derivada. Las letras descargadas (`letras-playlist.txt`) y las
anotaciones de Genius son material de consulta local y **nunca se versionan**.
