// Parseo del campo `translation` del vocabulario, compartido por la ficha de
// estudio (FlashCard) y el buscador para que la maquetación sea coherente.
//
// Formatos que aparecen en los datos:
//  - Phrasal polisémico numerado:  "TÍTULOS — 1) desc: \"eng\" = esp. 2) ..."
//  - Phrasal monosémico:           "TÍTULO — explicación"
//  - Par confuso (confusing_pair): "LEND = prestar | RENT = alquilar | ..."
//  - Vocabulario simple:           "productivo"

export interface ParsedExample {
  en: string;
  es: string;
}
export interface ParsedSense {
  n: string;
  desc: string;
  examples: ParsedExample[];
}
export interface ComparisonItem {
  term: string;
  def: string | null;
}

// Extrae la descripción y los pares "inglés" = español de una acepción.
export function extractExamples(text: string): { desc: string; examples: ParsedExample[] } {
  const firstQuote = text.indexOf('"');
  let desc = firstQuote >= 0 ? text.slice(0, firstQuote) : text;
  desc = desc.replace(/[:\s]+$/, '').trim();
  const examples: ParsedExample[] = [];
  const re = /"([^"]+)"\s*=\s*([^"]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // El español es hasta la siguiente comilla; recortamos una posible nota
    // final ("... . Opuesto: ...") que empiece tras un signo de puntuación.
    const es = m[2]
      .replace(/([.?!])\s+[A-ZÁÉÍÓÚÑ¿¡].*$/, '$1')
      .replace(/[.,;:\s]+$/, '')
      .trim();
    examples.push({ en: m[1].trim(), es });
  }
  return { desc, examples };
}

interface ParsedTranslation {
  header: string | null;
  body: string;
  senses: ParsedSense[] | null;
  note: string | null;
}

function parseTranslation(translation: string): ParsedTranslation {
  const dashIdx = translation.indexOf(' — ');
  if (dashIdx === -1) {
    return { header: null, body: translation.trim(), senses: null, note: null };
  }
  const header = translation.slice(0, dashIdx).trim();
  const body = translation.slice(dashIdx + 3).trim();
  if (!/\d\)/.test(body)) {
    return { header, body, senses: null, note: null };
  }
  const rawSenses: { n: string; text: string }[] = [];
  const re = /(\d)\)\s*([\s\S]*?)(?=\s*\d\)\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    rawSenses.push({ n: m[1], text: m[2].trim() });
  }
  let note: string | null = null;
  if (rawSenses.length) {
    const last = rawSenses[rawSenses.length - 1];
    const nm = last.text.match(/\s*(\([^()]*\)[.)]?)\s*$/);
    if (nm) {
      note = nm[1];
      last.text = last.text.slice(0, nm.index).trim();
    }
  }
  const senses: ParsedSense[] = rawSenses.map((s) => ({ n: s.n, ...extractExamples(s.text) }));
  return { header, body, senses, note };
}

// El " | " es exclusivo de confusing_pair, así que sirve para detectarlo.
function parseComparison(translation: string): ComparisonItem[] | null {
  if (!translation.includes(' | ')) return null;
  const items = translation
    .split(' | ')
    .map((part) => {
      const p = part.trim();
      const eq = p.indexOf('=');
      if (eq >= 0) return { term: p.slice(0, eq).trim(), def: p.slice(eq + 1).trim() };
      return { term: p, def: null };
    })
    .filter((x) => x.term);
  return items.length >= 2 ? items : null;
}

export type TranslationAnalysis =
  | { kind: 'comparison'; items: ComparisonItem[] }
  | { kind: 'senses'; header: string | null; senses: ParsedSense[]; note: string | null }
  | { kind: 'term'; term: string; explanation: string }
  | { kind: 'raw'; text: string };

// Clasifica una traducción en su tipo de maquetación.
export function analyzeTranslation(translation: string): TranslationAnalysis {
  const comparison = parseComparison(translation);
  if (comparison) return { kind: 'comparison', items: comparison };
  const parsed = parseTranslation(translation);
  if (parsed.senses && parsed.senses.length >= 2) {
    return { kind: 'senses', header: parsed.header, senses: parsed.senses, note: parsed.note };
  }
  if (parsed.header) {
    // Quitar los ejemplos incrustados de la explicación (p. ej. phrasals
    // monosémicos: "…" = …): los ejemplos ya salen en su propio bloque, así que
    // aquí sobran (evita duplicidad). La prosa explicativa sin comillas se
    // conserva; si no queda nada, la explicación va vacía y solo se ve el título.
    return { kind: 'term', term: parsed.header, explanation: stripInlineExamples(parsed.body) };
  }
  return { kind: 'raw', text: translation };
}

// Elimina pares "inglés" = español y comillas sueltas de un texto, dejando solo
// la prosa explicativa (si la hay).
function stripInlineExamples(text: string): string {
  return text
    .replace(/"[^"]*"\s*=\s*[^".]*\.?/g, '')
    .replace(/"[^"]*"/g, '')
    .replace(/\s{2,}/g, ' ')
    // marcador de ejemplo huérfano tras quitar el ejemplo ("… algo. Ej:"),
    // conservando el punto de la frase (solo se come el espacio previo).
    .replace(/\s+\b(?:p\.?\s*ej\.?|por ejemplo|ejemplos?|ej)\b\.?:?\s*$/i, '')
    .replace(/^[\s.,;:—-]+/, '')
    .replace(/[\s,;:—-]+$/, '') // conserva el punto final de la prosa
    .trim();
}

// Resumen de una línea para vistas compactas (línea colapsada del buscador).
export function translationSummary(translation: string): string {
  const a = analyzeTranslation(translation);
  switch (a.kind) {
    case 'comparison':
      return a.items.map((i) => i.def || i.term).join(' · ');
    case 'senses':
      return a.header || a.senses.map((s) => s.desc).join(' · ');
    case 'term':
      return a.term;
    case 'raw':
      return a.text;
  }
}
