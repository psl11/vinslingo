# Despliegue web (PWA) — guía

La app web es un export estático de Expo (SPA) + Supabase como backend. No hay
servidor propio: cualquier hosting de estáticos gratuito sirve, **con una
condición innegociable**: debe permitir cabeceras personalizadas, porque
expo-sqlite en web (WASM + SharedArrayBuffer) exige servir la página con:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Sin esas cabeceras el navegador no habilita `SharedArrayBuffer` y la app no
arranca. Esto descarta GitHub Pages (no permite cabeceras).

## Build

```bash
npm run build:web        # expo export --platform web  →  dist/
npm run serve:web        # prueba local en http://localhost:8090 con las
                         # cabeceras y el fallback SPA reales (via serve.json)
```

Todo lo de `public/` se copia tal cual a `dist/`:

| Fichero | Para qué |
|---|---|
| `_headers` | Cabeceras COOP/COEP en **Netlify / Cloudflare Pages** |
| `_redirects` | Fallback SPA en **Netlify** |
| `serve.json` | Prueba local (`npm run serve:web`) |
| `manifest.json` + `apple-touch-icon.png` | PWA instalable |

Para **Vercel**, `vercel.json` (raíz del repo) define build, cabeceras y
fallback SPA. El shell HTML con las metas de iOS vive en `app/+html.tsx`.

## Desplegar (elige uno; los tres tienen tier gratis de sobra)

**Vercel (recomendado por simplicidad):**
1. vercel.com → Add New Project → importar el repo de GitHub.
2. Framework preset: "Other". `vercel.json` ya define build (`npx expo export
   --platform web`) y output (`dist`).
3. En Environment Variables añadir **solo** las públicas:
   `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
   **NUNCA subir `SUPABASE_SERVICE_ROLE_KEY` al hosting** — es solo para
   scripts locales.
4. Deploy. Cada push a master redespliega.

**Netlify / Cloudflare Pages:** igual (conectar repo, build command
`npx expo export --platform web`, publish dir `dist`, mismas 2 env vars);
`_headers`/`_redirects` hacen el resto.

## Después del primer deploy

1. **Supabase → Authentication → URL Configuration**: poner la URL de
   producción como Site URL (y en Redirect URLs). Necesario para que
   funcionen los emails de recuperación de contraseña.
2. **iPhone**: abrir la URL en Safari → Compartir → *Añadir a pantalla de
   inicio*. Icono y pantalla completa como app nativa, sin licencia de Apple.
3. **Iniciar sesión con la misma cuenta en todos los dispositivos** — el
   progreso se comparte vía Supabase.

## Notas

- El vocabulario se descarga a SQLite local (OPFS) en el primer arranque de
  cada dispositivo (~30 s); después la app es offline-first.
- iOS puede purgar el almacenamiento local de una PWA sin uso durante ~7 días;
  como el progreso vive en Supabase, el peor caso es re-descargar el
  vocabulario.
- Verificado en local con el build estático real: `crossOriginIsolated: true`,
  SQLite-wasm operativo, sync de 2684 palabras y login OK.
