// Helpers para el "ancla" (canción/película/libro con el phrasal, para memorizar).
// Lógica pura compartida por la ficha (FlashCard) y el buscador, que antes la
// duplicaban (icono por tipo + construcción del crédito).

// El valor viene de una columna TEXT ('song' | 'movie' | 'book' | null).
export type AnchorType = string | null | undefined;

// Icono según el tipo de ancla (por defecto canción).
export function anchorIcon(type: AnchorType): string {
  if (type === 'movie') return '🎬';
  if (type === 'book') return '📖';
  return '🎵';
}

// Es una canción (→ mostrar botón de Spotify). Sin tipo = canción (las 137
// existentes no tienen anchor_type).
export function anchorIsSong(type: AnchorType): boolean {
  return !type || type === 'song';
}

// Crédito "Título (Autor, año)" con los paréntesis solo si hay autor y/o año.
// Ej: "Get Out (Jordan Peele, 2017)", "Comedown (Bush)", "Up (2009)", "Título".
export function anchorCredit(
  title: string,
  creator?: string | null,
  year?: number | null
): string {
  const inner = [creator, year].filter(Boolean).join(', ');
  return inner ? `${title} (${inner})` : title;
}
