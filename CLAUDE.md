# VinsLingo

App de aprendizaje de inglés (Expo/React Native) con Supabase como backend.

El repaso usa el algoritmo **FSRS** (Free Spaced Repetition Scheduler), no SM-2
(migración documentada en [`docs/fsrs-migration.md`](docs/fsrs-migration.md)).
Al escribir textos de cara al usuario sobre el scheduler, referirse a FSRS.

## Sistema de diseño (UI)

Toda la apariencia (espaciado, radios, colores, tipografía) sale de tokens en
[`constants/theme.ts`](constants/theme.ts). **Regla:** en cualquier `StyleSheet`
usar SIEMPRE tokens (`spacing`, `radius`, `colors`, `fontSize`, `fontWeight`),
nunca hex ni números sueltos; si falta un color, añadirlo al theme. Todo
`TextInput` debe incluir `webInputReset` en su `style` (quita el recuadro azul de
foco en web). Detalle completo, principios de espaciado y estado de la migración
en [`docs/design-system.md`](docs/design-system.md).

**Regla de documentación:** cualquier cambio estructural (sistema de diseño,
esquema de datos, features nuevas, decisiones de arquitectura) debe quedar
reflejado en un `.md` del repo (`docs/` o este CLAUDE.md), no solo en el código,
para que otra persona que trabaje con Claude Code tenga el contexto. Las
funcionalidades de aprendizaje están resumidas en [`docs/features.md`](docs/features.md).

## Sync de vocabulario (incremental + transacción)

`syncVocabularyFromSupabase` ([`lib/services/vocabularyService.ts`](lib/services/vocabularyService.ts))
es **incremental**: por defecto solo baja las filas cambiadas desde el último
sync, comparando el `updated_at` (timestamptz) del servidor contra una marca de
agua (`vocabulary_sync_watermark` en `sync_metadata`). El upsert va siempre en
**una sola transacción**. Detalles:

- Requiere la columna `vocabulary.updated_at` + un trigger `BEFORE UPDATE` que la
  ponga a `now()` en Supabase. **Degrada con gracia**: si la columna no existe,
  no se captura marca de agua y se queda en modo *full* (comportamiento
  anterior), sin errores.
- Hace un **full completo** la primera vez, cada 7 días (para reconciliar filas
  borradas en el servidor, que el incremental por `updated_at` no detecta) o si
  se fuerza (`{ fullResync: true }`). Entre medias, incremental (normalmente 0
  filas → un request barato).
- Intervalo mínimo entre syncs: 5 min (evita re-sync en relanzamientos rápidos).
  La primera descarga pasa `{ force: true }`.
- Editar contenido en Supabase se propaga en el siguiente sync del cliente
  (minutos), no al instante pero sin re-bajar todo.
- Las migraciones que añaden columnas ([`lib/database/client.ts`](lib/database/client.ts))
  borran la marca de agua + `vocabulary_last_full_sync` → **full resync forzado**
  tras un cambio de esquema (un `ALTER` no cambia el `updated_at` de las filas
  existentes, así que hace falta el full para repoblar la columna nueva).

## Backup del contenido de Supabase

El proyecto de Supabase (`qsdzoelgqyymtwublxoq`) ya estuvo caído/pausado una vez
(julio 2026) y perdió temporalmente su DNS. Para que el vocabulario, canciones y
demás contenido editorial nunca dependan solo de que ese proyecto siga vivo, hay
una copia local en [`supabase/backup/`](supabase/backup/) (JSON, versionado en git).

**Regla:** cada vez que se modifique contenido en Supabase (vocabulario, canciones,
artistas, o cualquier tabla de contenido público nueva — no datos de usuario) desde
una sesión de Claude Code, antes de terminar la tarea:

1. Ejecutar `npm run backup:supabase` (requiere `.env` cargado) para refrescar los
   JSON de `supabase/backup/`.
2. Revisar el diff (`git diff supabase/backup/`) para confirmar que el cambio es el
   esperado (contenido nuevo/corregido, no una pérdida de datos accidental).
3. Hacer commit de los ficheros de backup junto con el resto del cambio (confirmando
   con el usuario según el flujo habitual de commits).

El script vive en [`scripts/backup-supabase.ts`](scripts/backup-supabase.ts) y solo
descarga tablas de contenido público (`vocabulary`, `songs`, `song_vocabulary`,
`artists`). Deliberadamente NO incluye tablas de datos de usuario (`profiles`,
`study_sessions`, `user_vocabulary`, `user_lessons`, `lessons`): esas son datos
personales/de progreso, no contenido editorial, y no deben vivir en el repo. Si se
añaden nuevas tablas de contenido a Supabase, hay que añadirlas también a
`CONTENT_TABLES` en ese script.
