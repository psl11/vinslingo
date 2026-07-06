#!/usr/bin/env node
/**
 * Parchea dist/index.html tras `expo export`:
 *  1. Metas de PWA (con web.output:"single", expo-router NO aplica
 *     app/+html.tsx, así que hay que inyectarlas a mano).
 *  2. Un overlay de errores no capturados: si la app peta antes de pintar
 *     (típico en WebKit/Safari con SQLite-wasm), en vez de una pantalla en
 *     blanco muestra el error a pantalla completa. Imprescindible para
 *     diagnosticar en iOS, donde no hay consola accesible.
 *
 * Idempotente: si ya está inyectado, no hace nada.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const indexPath = resolve('dist', 'index.html');
const MARKER = 'apple-mobile-web-app-capable';

const TAGS = [
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '<meta name="apple-mobile-web-app-title" content="VinsLingo" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
  '<link rel="manifest" href="/manifest.json" />',
].join('\n    ');

// Overlay de errores: se registra ANTES de que cargue el bundle para capturar
// también los fallos de evaluación/importación (que dejarían todo en blanco).
const ERROR_OVERLAY = `<script>
(function(){
  function show(t){
    try{
      var host=document.body||document.documentElement;
      var pre=document.getElementById('__vinslingo_err');
      if(!pre){pre=document.createElement('pre');pre.id='__vinslingo_err';
        pre.style.cssText='position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;margin:0;padding:16px;background:#111;color:#ff6b6b;font:12px/1.5 -apple-system,monospace;white-space:pre-wrap;overflow:auto';
        var h=document.createElement('div');h.textContent='VinsLingo — error de carga (temporal, para diagnóstico):';
        h.style.cssText='color:#fff;font-weight:700;margin-bottom:12px';pre.appendChild(h);
        host.appendChild(pre);}
      var line=document.createElement('div');line.textContent=t;pre.appendChild(line);
    }catch(_){}
  }
  window.addEventListener('error',function(e){show('ERROR: '+(e.message||'')+'  @ '+(e.filename||'')+':'+(e.lineno||'')+'\\n'+((e.error&&e.error.stack)||''));});
  window.addEventListener('unhandledrejection',function(e){var r=e.reason;show('PROMISE REJECTION: '+((r&&(r.stack||r.message))||r));});
})();
</script>`;

let html;
try {
  html = readFileSync(indexPath, 'utf8');
} catch {
  console.error(`✗ No existe ${indexPath}. Ejecuta antes "expo export --platform web".`);
  process.exit(1);
}

if (html.includes(MARKER)) {
  console.log('✓ index.html ya parcheado, nada que hacer.');
  process.exit(0);
}

if (!html.includes('</head>')) {
  console.error('✗ No encuentro </head> en dist/index.html.');
  process.exit(1);
}

html = html
  .replace('<head>', `<head>\n    ${ERROR_OVERLAY}`)
  .replace('</head>', `    ${TAGS}\n  </head>`);
writeFileSync(indexPath, html);
console.log('✓ index.html parcheado (PWA meta + overlay de errores).');
