# Pronunciación (IPA + respelling al español)

Bajo cada palabra en inglés se muestra su pronunciación en dos capas:

- **IPA (US)** — el estándar riguroso: `kidney → /ˈkɪdni/`. Columna
  `vocabulary.pronunciation`.
- **Respelling adaptado al español** — una lectura legible sin saber IPA:
  `kidney → kídni`. Columna `vocabulary.pronunciation_es`.

Se muestran en la [`FlashCard`](../components/cards/FlashCard.tsx) **solo en el
anverso** (bajo la palabra; el reverso se deja limpio) y en el resultado de la
[`TypingCard`](../components/cards/TypingCard.tsx).

**Audio de frases**: además del altavoz de la palabra, cada **frase de ejemplo** y
el **verso de la canción** llevan un botón 🔊 que las reproduce. Refuerza el
*listening* en contexto.

## Sistemas de audio (dos, distintos)

Ver [`audioService.ts`](../lib/services/audioService.ts) / [`useAudio`](../hooks/useAudio.ts):

- **Pronunciación (`playWord` → `playPronunciation`)** = voz **sintetizada (TTS)** a
  partir del texto, sin descargar fichero. En **web/PWA** usa el **Web Speech API**
  (el motor de voz del propio dispositivo) → **funciona offline**. En una app
  **nativa** usaría Google Translate TTS por URL (esa sí necesitaría red).
- **Audio remoto (`playUrl` → `playAudioFromUrl`)** = reproduce un **fichero
  pregrabado** en `vocabulary.audio_url`. Siempre necesita red.

Hoy **ninguna carta tiene `audio_url`** (0/2931): todo el 🔊 tira del TTS del
dispositivo, así que **el audio funciona sin conexión**. El campo `audio_url`
está previsto por si se añaden locuciones humanas grabadas (se priorizarían sobre
la voz sintética). Por eso `FlashCard` solo usa `playUrl` si hay `audioUrl` **y**
`isOnline`; si no, cae a `playWord` (ver [`docs/pwa.md`](pwa.md), comportamiento
offline).

## Datos

- Palabras de **una sola palabra**: 2477/2531 con IPA (las ~54 sin IPA son slang
  nuevo tipo *rizz/bussin/mandem*).
- **Multipalabra** (phrasals, idioms, expresiones): la pronunciación se **compone
  palabra a palabra** (`let out → /ˈlɛt ˈaʊt/ · lét áut`). Si a alguna palabra le
  falta IPA, la entrada se deja sin pronunciación (mejor nada que a medias). ~384
  entradas cubiertas.
- Fuente del IPA: dataset abierto open-dict [`ipa-dict`](https://github.com/open-dict-data/ipa-dict)
  (`en_US`, primera pronunciación).
- Generado con [`scripts/set-pronunciation.mjs`](../scripts/set-pronunciation.mjs)
  (dry-run / `--apply`). Tras aplicar: `npm run backup:supabase` + commit.

## Respelling: reglas y límites

El respelling se genera desde el IPA (misma función en el script). Es un **apoyo
aproximado**, no una transcripción exacta: el inglés tiene sonidos que el español
no tiene. Convenciones (español peninsular):

- `θ → z` (through → `zrú`), `h → j` (hit → `jít`), `w → u` (water → `úoter`),
  `ŋ → ng`, `tʃ → ch`, `ʃ → sh`.
- Acento con **tilde** al estilo español sobre la vocal tónica (`kídni`), sin
  partir en sílabas.
- Aproximaciones que "mienten" un poco (sonidos inexistentes en español):
  `v → v` (se lee como *b*), `ʒ/dʒ → y` (measure → `méyer`), `ð → d`, `æ → a`.
  Por eso el **IPA queda como referencia exacta** y el respelling como ayuda.

## Cliente

`pronunciation_es` se añadió a `vocabulary` (Supabase por `ALTER`; local en
[`schema.ts`](../lib/database/schema.ts) + migración en
[`client.ts`](../lib/database/client.ts) que fuerza un full resync). El sync
incluye la columna vía `VOCAB_COLUMNS`
([`vocabularyService.ts`](../lib/services/vocabularyService.ts)).
