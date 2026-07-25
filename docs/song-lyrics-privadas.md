# Letras: qué se publica y qué no

La pantalla de canción tiene una sección **📄 Letra** debajo de la historia. Lo que
enseña depende de quién mire, y esa distinción es deliberada.

## Los dos modos

| Modo | Qué enseña | Quién lo ve | Dónde vive |
|---|---|---|---|
| **Fragmentos** (por defecto) | Los versos de contexto ya guardados, en orden de aparición, con las palabras estudiables en negrita | Cualquiera | `song_vocabulary.line_text`, ya sincronizado en local |
| **Letra completa** | La letra entera | Solo la cuenta autorizada | Supabase, tabla `song_lyrics` con RLS |

En los dos casos hay enlace a Genius, que es la fuente.

## Por qué no van las letras en el bundle

Porque el bundle es público. El JSON de guiones se compila a un fichero estático
(`podcastScripts-*.js`) que Vercel sirve **antes del login**: el guard de sesión
protege las pantallas, no los ficheros del build. Cualquiera con la URL puede
descargarlo.

Meter ahí las letras completas de ~500 canciones no sería "guardarlas para uso
personal": sería publicarlas. Va contra la regla del propio proyecto
(CLAUDE.md → *"las letras nunca se versionan ni se guardan completas en la BD"*),
contra los términos de Genius —de donde salen— y contra el copyright de los
titulares.

Por eso la letra completa vive en una tabla con RLS y **nunca** en el repo.

## Montarlo (una vez)

**1. Crear la tabla y la política.** Dashboard de Supabase → SQL Editor → New
query → pegar [`supabase/migrations/song_lyrics.sql`](../supabase/migrations/song_lyrics.sql) → Run.

La política restringe `SELECT` a una única cuenta por email. **Si cambia el email,
hay que editar la política**, o la sección de letra completa deja de aparecer (sin
error: simplemente vuelve al modo fragmentos).

No hay políticas de escritura a propósito: desde la app nadie escribe.

**2. Subir las letras** desde tu máquina:

```bash
node scripts/upload-lyrics.mjs
```

```bash
node scripts/upload-lyrics.mjs --apply
```

Lee `./letras-playlist.txt` (local, gitignored) y usa la `SUPABASE_SERVICE_ROLE_KEY`,
que se salta la RLS por diseño. **Solo se ejecuta en local**: nunca en CI ni en el
build de Vercel, que ni siquiera tienen el fichero de letras.

## Invariantes que no hay que romper

- **`song_lyrics` NO va en `CONTENT_TABLES`** de [`scripts/backup-supabase.ts`](../scripts/backup-supabase.ts).
  Meterla ahí volcaría las letras a `supabase/backup/*.json`, que sí se versiona,
  y anularía todo lo anterior. Hay un aviso en el propio fichero.
- **`song_lyrics` NO se sincroniza al espejo local de SQLite.** `syncMusicFromSupabase`
  baja `songs`, `artists` y `song_vocabulary`, nada más. La letra se pide por red
  bajo demanda al abrir la canción.
- **`letras-playlist.txt` sigue gitignored.** Es la fuente y no debe entrar nunca.

## Degradación

Todo el camino falla en silencio y hacia el lado seguro:

- Tabla inexistente, RLS que bloquea, error de red o cuenta distinta → `getFullLyrics`
  devuelve `null` → se enseñan los fragmentos.
- Sin fragmentos y sin letra → la sección no se pinta.

Es decir: el modo por defecto de la app es el conservador, y la letra completa es
lo que se añade encima cuando hay permiso.
