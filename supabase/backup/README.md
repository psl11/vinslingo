# Backup del contenido de Supabase

Copia local del contenido editorial (no sensible) de la base de datos de Supabase,
para que el trabajo de curación de vocabulario/canciones nunca dependa de que el
proyecto de Supabase siga vivo (ver incidente del 2026-07-01: el proyecto estuvo
caído/pausado y su DNS dejó de resolver temporalmente).

## Qué incluye

| Fichero | Tabla origen | Filas (última generación) |
|---|---|---|
| `vocabulary.json` | `vocabulary` | 3248 |
| `songs.json` | `songs` | 27 |
| `song_vocabulary.json` | `song_vocabulary` | 34 |
| `artists.json` | `artists` | 9 |

`_meta.json` guarda la fecha de generación y el recuento de filas de cada tabla.

## Qué NO incluye (a propósito)

Datos de usuario: `profiles`, `study_sessions`, `user_vocabulary`, `user_lessons`,
`lessons`. Son datos personales/de progreso, no contenido editorial, y no deben
vivir en el repositorio.

## Cómo regenerar el backup

```bash
set -a && source .env && set +a
npm run backup:supabase
```

Esto sobrescribe los ficheros de `supabase/backup/` con el estado actual de Supabase.
Revisa el diff en git antes de hacer commit para confirmar que los cambios son los
esperados (contenido nuevo, no una pérdida de datos accidental).

## Cómo restaurar en un proyecto de Supabase nuevo/vacío

Si el proyecto de Supabase se pierde otra vez, estos JSON son la fuente para
reconstruir las tablas de contenido (insertarlos vía SQL/`insert` masivo o con
el propio `@supabase/supabase-js` usando la `service_role` key). El schema de
cada tabla se puede inferir de las claves de los objetos JSON.
