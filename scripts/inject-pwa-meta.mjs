#!/usr/bin/env node
/**
 * Inyecta las metas de PWA en dist/index.html tras `expo export`.
 *
 * Por qué existe: con `web.output: "single"` (SPA), expo-router NO aplica
 * app/+html.tsx, así que las metas de "instalable" (fullscreen en iOS,
 * manifest para Android) hay que insertarlas en el HTML generado. El icono
 * apple-touch se sirve además por convención en /apple-touch-icon.png.
 *
 * Idempotente: si ya está inyectado, no hace nada.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const indexPath = resolve('dist', 'index.html');
const MARKER = 'apple-mobile-web-app-capable';

const TAGS = [
  '<meta name="description" content="Aprende inglés con vocabulario, phrasal verbs, idioms, slang y repetición espaciada (FSRS), y con tu propia música." />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '<meta name="apple-mobile-web-app-title" content="VinsLingo" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
  '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />',
  '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />',
  '<link rel="manifest" href="/manifest.json" />',
].join('\n    ');

let html;
try {
  html = readFileSync(indexPath, 'utf8');
} catch {
  console.error(`✗ No existe ${indexPath}. Ejecuta antes "expo export --platform web".`);
  process.exit(1);
}

if (html.includes(MARKER)) {
  console.log('✓ PWA meta ya presente, nada que hacer.');
  process.exit(0);
}

if (!html.includes('</head>')) {
  console.error('✗ No encuentro </head> en dist/index.html.');
  process.exit(1);
}

html = html.replace('</head>', `    ${TAGS}\n  </head>`);

// lang del documento (accesibilidad/SEO) y viewport-fit=cover (pantalla completa
// en iPhone con notch, respetando safe-area). Idempotente (reemplazos estables).
html = html.replace(/<html(\s[^>]*)?>/i, '<html lang="es">');
html = html.replace(
  /<meta name="viewport"[^>]*>/i,
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />'
);

writeFileSync(indexPath, html);
console.log('✓ PWA meta inyectada en dist/index.html.');
