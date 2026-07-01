# VinsLingo

App de aprendizaje de inglés (Expo/React Native) con Supabase como backend.

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
