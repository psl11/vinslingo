# PWA / web (icono, offline, metadatos)

La versión web se exporta con `web.output: "single"` (SPA). Como en ese modo
expo-router **no aplica `app/+html.tsx`**, la personalización del `<head>` y los
metadatos de instalable se hacen en un post-build.

## Build

`npm run build:web` = `expo export --platform web && node scripts/inject-pwa-meta.mjs`.
El inyector añade al `dist/index.html`: `apple-touch-icon`, favicons PNG (32/16),
`manifest`, metas `apple-mobile-web-app-*`, `description`, `lang="es"` y
`viewport-fit=cover`. Es idempotente.

## Icono

Fuente vectorial en `assets/icon-source.svg` (índigo + "V" blanca con punta
ámbar) y variante `assets/icon-maskable-source.svg` (con margen para Android).
Se rasterizan con `sharp`. Ficheros: `public/apple-touch-icon.png` (180),
`icon-192/512`, `icon-maskable-512` (purpose `maskable` en el manifest), y los
nativos en `assets/`. iOS coge el icono por `/apple-touch-icon.png` (convención)
+ el `<link>` inyectado.

## Offline (service worker)

`public/sw.js` cachea la *shell* (HTML, bundles JS, WASM de SQLite, fuentes,
iconos) para que la app instalada **abra sin conexión** (los datos ya son
locales en SQLite). Estrategia: navegación *network-first* → fallback al HTML
cacheado; assets same-origin *cache-first*; cross-origin (Supabase, TTS) a red
directa. Se registra desde `app/_layout.tsx` solo en **web y producción**
(`!__DEV__`).

**Clave**: se sirve la Response cacheada tal cual (con sus COOP/COEP), así se
preserva el *cross-origin isolation* que necesita `SharedArrayBuffer` /
SQLite-wasm. Verificado: con el SW activo, `crossOriginIsolated === true` y el
WASM queda en caché. (La primera visita registra el SW; a partir de la segunda
carga la shell completa está cacheada y funciona offline.)
