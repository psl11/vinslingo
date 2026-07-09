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
