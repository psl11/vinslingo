// Glosario de siglas que aparecen en las explicaciones (notas de canciones y
// coloquial). El render subraya las coincidencias y muestra la expansión en un
// tooltip al pulsar (ver components/music/AcronymText.tsx y docs/song-expressions.md).
// Clave = tal cual aparece en el texto (con o sin puntos); se compara sin puntos.

export const ACRONYMS: Record<string, string> = {
  AAVE: 'African American Vernacular English · el inglés vernáculo afroamericano',
  BYOB: 'Bring Your Own Bottle · trae tu propia bebida (invitación de fiesta)',
  CREAM: 'Cash Rules Everything Around Me · el dinero manda en todo (Wu-Tang Clan)',
  RIP: 'Rest In Peace · descanse en paz',
  MLE: 'Multicultural London English · el inglés multicultural de Londres',
  TDE: 'Top Dawg Entertainment · el sello de Kendrick Lamar y ScHoolboy Q',
  OVO: "October's Very Own · el sello y la marca de Drake",
  NBA: 'National Basketball Association · la liga de baloncesto de EE. UU.',
  GOAT: 'Greatest Of All Time · el mejor de la historia',
  OT: 'Out of Town · fuera de la ciudad, en territorio ajeno',
  MC: 'Master of Ceremonies · el rapero, el que lleva la voz',
  BM: 'Baby Mama · la madre de tu hijo, con la que ya no estás',
  FOMO: 'Fear Of Missing Out · miedo a perderse algo',
  TTS: 'Text To Speech · voz sintetizada a partir de texto',
};

// Normaliza para comparar: quita puntos y pasa a mayúsculas ("B.Y.O.B." → "BYOB").
export const normAcronym = (s: string) => s.replace(/\./g, '').toUpperCase();

// Set de claves normalizadas presentes en el glosario.
const KEYS = new Set(Object.keys(ACRONYMS).map(normAcronym));

/** ¿Es `token` (posiblemente con puntos) una sigla conocida? Devuelve su expansión. */
export function lookupAcronym(token: string): string | null {
  const k = normAcronym(token.replace(/[^\w.]/g, ''));
  return KEYS.has(k) ? ACRONYMS[Object.keys(ACRONYMS).find((key) => normAcronym(key) === k)!] : null;
}
