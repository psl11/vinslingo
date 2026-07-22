import { Platform, Linking } from 'react-native';

// Abre una búsqueda en Spotify de "título artista" sin dejar una pestaña del
// navegador en blanco. En la PWA, window.open(_blank) deja una pestaña vacía (el
// universal link abre la app pero la pestaña que lo lanzó se queda ahí); en su
// lugar deep-linkeamos con el esquema `spotify:` (abre la app sin pestaña) y, si
// Spotify no está instalado, caemos a la web EN LA MISMA pestaña. Ver docs/pwa.md.
export function openSpotifySearch(title?: string | null, artist?: string | null): void {
  const cleanArtist = (artist || '').replace(/\s*\([^)]*\)/g, '').trim();
  const query = [title, cleanArtist].filter(Boolean).join(' ');
  if (!query) return;
  const webUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;

  if (Platform.OS !== 'web') {
    Linking.openURL(webUrl);
    return;
  }

  const appUrl = `spotify:search:${encodeURIComponent(query)}`;
  let done = false;
  const fallback = setTimeout(() => {
    if (!done && typeof document !== 'undefined' && document.visibilityState === 'visible') {
      done = true;
      window.location.href = webUrl;
    }
  }, 1500);
  const onVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      done = true;
      clearTimeout(fallback);
    }
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility, { once: true });
  }
  window.location.href = appUrl;
}
