# Pronunciación (IPA + respelling al español)

Bajo cada palabra en inglés se muestra su pronunciación en dos capas:

- **IPA (US)** — el estándar riguroso: `kidney → /ˈkɪdni/`. Columna
  `vocabulary.pronunciation`.
- **Respelling adaptado al español** — una lectura legible sin saber IPA:
  `kidney → kídni`. Columna `vocabulary.pronunciation_es`.

Se muestran en la [`FlashCard`](../components/cards/FlashCard.tsx) (anverso bajo
la palabra y reverso bajo la palabra) y en el resultado de la
[`TypingCard`](../components/cards/TypingCard.tsx).

## Datos

- Solo para palabras de **una sola palabra** (2477/2531 tienen IPA; las ~54 sin
  IPA son slang nuevo tipo *rizz/bussin/mandem*). Los phrasals/idioms multipalabra
  no llevan pronunciación.
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
