/**
 * Trocea texto con marcado en línea (`**negrita**`, `*cursiva*`) en segmentos
 * planos que React Native puede pintar con <Text> anidados.
 *
 * Es a propósito un subconjunto mínimo: los guiones de podcast solo usan esas
 * dos marcas. No pretende ser un parser de Markdown — meter una dependencia
 * entera para dos asteriscos no compensa.
 */
export type Segment = { text: string; bold?: boolean; italic?: boolean };

/**
 * Escáner a mano en vez de una regex global. Hace falta porque las marcas se
 * anidan de verdad en los guiones (`**Se llamaba *Wishing Stone*.**`), y eso
 * una regex plana no lo resuelve: o se come el asterisco de la negrita o parte
 * el fragmento por la mitad. Recursivo, así el anidamiento sale gratis.
 *
 * Un asterisco sin pareja (`2 * 3`) no abre nada y se queda como texto.
 */
function scan(input: string, bold: boolean, italic: boolean, out: Segment[]): void {
  let buf = '';
  const flush = () => {
    if (!buf) return;
    out.push({ text: buf, ...(bold && { bold }), ...(italic && { italic }) });
    buf = '';
  };

  let i = 0;
  while (i < input.length) {
    if (input[i] === '*' && input[i + 1] === '*') {
      const close = input.indexOf('**', i + 2);
      if (close > i + 2) {
        flush();
        scan(input.slice(i + 2, close), true, italic, out);
        i = close + 2;
        continue;
      }
    } else if (input[i] === '*') {
      // Cierre = el siguiente `*` que no forme parte de un `**`.
      let close = -1;
      for (let j = i + 1; j < input.length; j++) {
        if (input[j] !== '*') continue;
        if (input[j + 1] === '*') { j++; continue; }
        close = j;
        break;
      }
      if (close > i + 1) {
        flush();
        scan(input.slice(i + 1, close), bold, true, out);
        i = close + 1;
        continue;
      }
    }
    buf += input[i];
    i++;
  }
  flush();
}

export function parseInline(input: string): Segment[] {
  const out: Segment[] = [];
  scan(input, false, false, out);
  return out.length ? out : [{ text: input }];
}

/** El mismo texto sin las marcas — para resúmenes y `numberOfLines`. */
export function stripInline(input: string): string {
  return parseInline(input)
    .map((s) => s.text)
    .join('');
}
