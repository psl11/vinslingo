# Palabras guardadas (chincheta 📌)

Listado personal de palabras que el usuario marca para consultar y filtrar más
tarde. Pensado para ir apartando lo que quiere retener a mano (una expresión de
B1, un slang que le gustó, un phrasal concreto) sin depender de si el scheduler
la programa o no.

## Flujo

- **Guardar:** en el **reverso** de una ficha ([`FlashCard`](../components/cards/FlashCard.tsx))
  hay una chincheta 📌 en la cabecera, junto al badge de nivel. Tocarla guarda o
  quita la palabra al instante (optimista, con haptics). Grisada = sin guardar;
  sólida sobre fondo ámbar = guardada. En web/desktop, la tecla **S** hace lo
  mismo cuando la respuesta está visible.
- **Consultar:** tarjeta "📌 Palabras guardadas" en el tab **Aprender** →
  pantalla [`app/saved-words.tsx`](../app/saved-words.tsx) (modal). Lista las
  guardadas (más recientes primero) reutilizando
  [`VocabResultCard`](../components/vocabulary/VocabResultCard.tsx) — la misma
  ficha expandible del buscador y de "palabras más falladas".
- **Filtrar:** chips de categoría (**Todas** + una por cada categoría presente,
  con su recuento). Las "categorías" que pedía la feature (nivel B1, slang,
  phrasal verb…) **no son etiquetas nuevas**: salen de las columnas
  `cefr_level`/`category` que el vocabulario ya tiene, así que el filtro es un
  `WHERE v.category = ?` sobre el JOIN.
- **Quitar desde el listado:** la chincheta 📌 de cada fila (en `headerBadge`)
  la elimina; si vacías la categoría filtrada, vuelve a "Todas".

## Datos

Tabla local **`saved_words`** (`id`, `vocabulary_id` UNIQUE, `created_at`) en
[`schema.ts`](../lib/database/schema.ts). Se crea con `CREATE TABLE IF NOT
EXISTS` (corre en cada init), así que cubre instalaciones nuevas y existentes sin
migración `ALTER`. `vocabulary_id` es UNIQUE → una palabra se guarda una vez; el
toggle es `INSERT OR IGNORE` / `DELETE`.

Lógica en [`savedWordsService.ts`](../lib/services/savedWordsService.ts):
`isWordSaved`, `toggleSavedWord`, `removeSavedWord`, `getSavedWords({ category,
cefrLevels })`, `getSavedCategories`, `getSavedWordsCount`. El listado hace
`INNER JOIN vocabulary` + `LEFT JOIN user_vocabulary` (una palabra guardada puede
no tener progreso todavía → mastery null → "Nueva").

### Es dato LOCAL (por ahora)

`saved_words` **no se sincroniza a Supabase**: es dato de usuario y no había una
tabla de servidor donde volcarlo. Se comporta como `user_gap_fill` (local, no
synced). El diseño deja la puerta abierta a sincronizarlo en el futuro (añadir la
tabla en Supabase + columnas `needs_sync`/`updated_at` y engancharlo al
[`syncService`](../lib/services/syncService.ts)). A propósito, **no** se incluye
en `scripts/backup-supabase.ts`: ese backup es solo de contenido editorial
público, no de datos de progreso/personales del usuario.

### Filtro de nivel del perfil

El listado **ignora** el filtro CEFR del perfil (a diferencia de "palabras más
falladas"): el usuario guardó estas palabras explícitamente, así que esconderlas
porque su nivel activo no incluye ese CEFR sería confuso.
