// Configuración de Metro necesaria para que expo-sqlite funcione en web
// (wa-sqlite compilado a WASM + cabeceras COOP/COEP para SharedArrayBuffer).
// Sin esto, `expo start --web` crashea al importar expo-sqlite.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

// zustand v5 publica ESM con import.meta, que Metro no soporta en web
// ("Cannot use 'import.meta' outside a module"). Forzar la resolución CJS.
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    middleware(req, res, next);
  };
};

module.exports = config;
