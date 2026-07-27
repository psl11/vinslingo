import type { Script } from '../../components/music/SongScript';

// Carga diferida de los guiones, UN FICHERO POR ARTISTA.
//
// Antes había un único JSON con todos. Al pasar de 150 guiones superó 1 MB, y la
// app se lo descargaba entero para enseñar uno de 6 KB. Partido por artista,
// abrir una canción de Oasis baja ~140 KB en vez de ~1 MB.
//
// El mapa es explícito y no una plantilla `import(\`./podcast/${a}.json\`)`
// porque Metro necesita rutas literales para poder trocear el bundle: con una
// ruta dinámica no sabe qué ficheros existen y acaba metiéndolos todos.
//
// Al añadir un artista nuevo hay que añadir su línea aquí. Si falta, la canción
// simplemente no enseña guion — no falla.
const LOADERS: Record<string, () => Promise<{ default: Record<string, Script> }>> = {
  thebeatles: () => import('./podcast/thebeatles.json') as any,
  metallica: () => import('./podcast/metallica.json') as any,
  coldplay: () => import('./podcast/coldplay.json') as any,
  oasis: () => import('./podcast/oasis.json') as any,
  thekillers: () => import('./podcast/thekillers.json') as any,
  jayz: () => import('./podcast/jayz.json') as any,
  linkinpark: () => import('./podcast/linkinpark.json') as any,
  kanyewest: () => import('./podcast/kanyewest.json') as any,
};

// Un artista se descarga una vez por sesión: al volver a otra canción suya, ya
// está en memoria.
const cache = new Map<string, Record<string, Script>>();

export async function loadArtistScripts(artistKey: string): Promise<Record<string, Script>> {
  const cached = cache.get(artistKey);
  if (cached) return cached;
  const load = LOADERS[artistKey];
  if (!load) return {};
  try {
    const mod = await load();
    const data = (mod.default ?? mod) as Record<string, Script>;
    cache.set(artistKey, data);
    return data;
  } catch {
    return {};
  }
}
