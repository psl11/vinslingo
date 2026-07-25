// Localiza el rango [inicio, fin) a resaltar de `word` dentro de `line`,
// prefiriendo una ocurrencia con LÍMITE DE PALABRA. Evita el bug de resaltar la
// subcadena: "ill" dentro de "Fulfilled", "lit" dentro de "little", "ends"
// dentro de "friends". Si no hay ocurrencia con límite (patrones raros), cae a
// la primera subcadena. Devuelve null si no aparece.
export function highlightRange(line: string, word: string | null | undefined): [number, number] | null {
  if (!word) return null;
  const esc = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wb = new RegExp('(?:^|[^A-Za-z0-9])(' + esc + ')(?![A-Za-z0-9])', 'i');
  const m = wb.exec(line);
  if (m) {
    const idx = m.index + (m[0].length - m[1].length);
    return [idx, idx + m[1].length];
  }
  const i = line.toLowerCase().indexOf(word.toLowerCase());
  return i < 0 ? null : [i, i + word.length];
}

/**
 * Varios términos a resaltar en la misma línea (un verso puede tener más de una
 * palabra anclada). Devuelve los rangos ordenados y **sin solaparse**: si dos
 * términos pisan el mismo trozo —"give" y "give up"— gana el primero que se
 * encontró, porque solapar rompería el troceado del <Text>.
 */
export function highlightRanges(line: string, words: (string | null | undefined)[]): [number, number][] {
  const out: [number, number][] = [];
  for (const w of words) {
    const r = highlightRange(line, w);
    if (!r) continue;
    if (out.some(([s, e]) => r[0] < e && s < r[1])) continue;
    out.push(r);
  }
  return out.sort((a, b) => a[0] - b[0]);
}
