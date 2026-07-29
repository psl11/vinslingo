# Funcionamiento sin conexión

VinsLingo debe funcionar **entera sin red**: todo el material de estudio vive en
SQLite local y los guiones van empaquetados en el bundle. Supabase solo hace
falta para *sincronizar* progreso, nunca para *estudiar*.

Esto no era así. Probada en un avión (julio de 2026), la app no arrancaba. Había
tres causas distintas, y las tres están arregladas.

## 1. La sesión caducada te expulsaba al login

**Síntoma:** abres la app sin red y aterrizas en la pantalla de inicio de sesión,
donde no puedes hacer nada — porque iniciar sesión también necesita red.

**Causa:** el token de acceso de Supabase dura una hora. Al arrancar, `supabase-js`
intenta refrescarlo; sin red la petición falla y **borra la sesión del disco**. A
partir de ahí `isAuthenticated` es `false` y el guard de
[`app/_layout.tsx`](../app/_layout.tsx) redirige a `/(auth)/sign-in`.

**Arreglo:** una marca durable propia, en una clave que `supabase-js` no toca
([`lib/auth/offlineSession.ts`](../lib/auth/offlineSession.ts)). Distingue dos
situaciones que de otro modo son idénticas:

| Estado | Qué significa | Qué hace la app |
|---|---|---|
| Sin sesión, sin marca | Nunca te has autenticado | Al login (correcto) |
| Sin sesión, **con** marca | Caducó sin red | **Te deja entrar** |

Detalles que importan:

- La marca se borra **solo en `signOut()` explícito**, y se borra *antes* de
  llamar a `supabase.auth.signOut()`. Ese orden es lo que permite distinguir
  después los dos tipos de `SIGNED_OUT` (ver punto siguiente).
- El modo offline **no** se condiciona a `navigator.onLine`. Con el wifi de un
  avión o un portal cautivo, `onLine` es `true` aunque no haya internet — que es
  justo el caso que hay que cubrir.
- Si hay red y la sesión caducó, el banner es **pulsable** y lleva al login; sin
  red no se ofrece, porque no serviría de nada.

### El `SIGNED_OUT` ambiguo

`supabase-js` emite `SIGNED_OUT` en dos casos muy distintos: el cierre de sesión
voluntario y el descarte de la sesión tras un refresco fallido. El handler de
[`hooks/useAuth.tsx`](../hooks/useAuth.tsx) llamaba a `clearProfile()` en ambos,
así que offline se **borraba el perfil persistido**: XP 0 y racha 0 con los datos
intactos en disco. Ahora solo limpia si la marca ya no está (cierre voluntario).

Por lo mismo, `getUserProgressFromLocal` ya no devuelve ceros para XP y racha:
usa los últimos valores conocidos del store de zustand, que se persiste.

## 2. El service worker solo cacheaba lo ya visitado

**Síntoma:** sin red, la app abría pero fallaba al entrar en canciones de grupos
que no habías abierto antes.

**Causa:** [`public/sw.js`](../public/sw.js) cacheaba en tiempo de ejecución
(*cache-first*), o sea solo guardaba lo que ya se había pedido alguna vez. Dos
agujeros:

- El bundle de entrada se pide **antes** de que el SW se registre (el registro
  vive en un `useEffect`), así que en la primera visita no se cacheaba: hacía
  falta una segunda carga para que la app abriese offline.
- Los *chunks* perezosos — un JSON de guiones por artista — solo se cacheaban al
  abrir una canción de **ese** grupo. Sin conexión, el resto fallaba.

**Arreglo:** [`scripts/inject-sw-precache.mjs`](../scripts/inject-sw-precache.mjs)
inyecta en `dist/sw.js`, después del build, la lista completa de assets (~42
ficheros, 3,8 MB) y una versión de caché derivada de sus nombres (que llevan hash
de contenido), de modo que cada deploy invalida la caché anterior. El `install`
los descarga todos de golpe.

Va en `build:web` y en el `buildCommand` de [`vercel.json`](../vercel.json). **Si
se cambia uno, hay que cambiar el otro.** `/sw.js` se sirve con `Cache-Control:
no-cache` para que los deploys se recojan.

El `install` añade los assets uno a uno con `Promise.allSettled` en vez de
`cache.addAll`: `addAll` es atómico y un solo 404 tiraría todo el precache
dejando la app sin funcionar offline sin que se note en ningún sitio.

## 3. Las llamadas de red no comprobaban la red

`supabase.auth.getUser()` **hace petición de red** (valida el token contra el
servidor). Se llamaba sin comprobar conexión en `syncVocabularyProgress`,
`syncPendingReviewLogs`, `addUserXp`, `updateStreak` y `saveStudySession`. Sin
red no falla rápido: en una wifi de avión o un portal cautivo se queda colgada
hasta el timeout. Además `drill.tsx` **esperaba** esas subidas, así que el drill
se congelaba a media ronda.

Ahora todas comprueban `isOnline()` primero y, si no hay red, encolan
directamente; y el drill lanza la subida sin esperarla, como ya hacía
[`app/study/[id].tsx`](<../app/study/[id].tsx>).

## Cómo verificarlo

Con `npm run build:web` hecho:

1. `npm run serve:web`, abrir `http://localhost:8090`, comprobar que la caché
   tiene los ~42 assets ya en la **primera** visita.
2. Inyectar en `localStorage` una marca `vinslingo_has_authenticated` y una
   sesión de Supabase con `expires_at` en el pasado.
3. **Parar el servidor** y recargar.

Debe cargar la app entera (no el login), con el banner de sesión caducada, y
deben abrirse canciones de artistas no visitados en esa sesión.

## Lo que sigue necesitando red

- La primera descarga de vocabulario (sin datos locales no hay app).
- La letra completa de una canción (`song_lyrics`, ver
  [`song-lyrics-privadas.md`](song-lyrics-privadas.md)).
- El audio de pronunciación (Google TTS).
- Subir el progreso. Se encola en local y sube solo al reconectar.
