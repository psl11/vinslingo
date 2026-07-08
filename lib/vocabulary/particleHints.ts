// "Truco de la partícula" para phrasal verbs. Basado en el enfoque cognitivo de
// Brygida Rudzka-Ostyn, "Word Power: Phrasal Verbs and Compounds — A Cognitive
// Approach" (Mouton, 2003), y estudios posteriores (p.ej. Al-Otaibi, Journal of
// Language and Education, 2019): la partícula aporta un significado metafórico
// CONSISTENTE a lo largo de muchos phrasal verbs. Entender ese patrón permite
// adivinar y recordar phrasal verbs nuevos mejor que memorizar listas sueltas.
//
// Cada pista describe el/los sentido(s) nuclear(es) de la partícula con ejemplos,
// no una afirmación sobre un verbo concreto: es una heurística general.

const PARTICLE_HINTS: Record<string, string> = {
  up: 'La partícula UP suele aportar la idea de completar o terminar algo (use up, finish up, eat up), o de aumentar y subir (speak up, turn up, grow up).',
  out: 'La partícula OUT suele aportar la idea de sacar o extraer algo (take out, throw out), de descubrir o hacer público (find out, point out, figure out), o de agotarse (run out).',
  off: 'La partícula OFF suele aportar la idea de separarse o marcharse (take off, set off, get off), o de apagar y cancelar (turn off, call off).',
  down: 'La partícula DOWN suele aportar la idea de reducir o bajar (cut down, calm down, slow down), de anotar algo (write down) o de dejar de funcionar (break down, shut down).',
  on: 'La partícula ON suele aportar la idea de continuar (go on, carry on, keep on) o de activar y poner en marcha (turn on, put on).',
  in: 'La partícula IN suele aportar la idea de entrar o meter algo dentro (come in, get in, fill in).',
  over: 'La partícula OVER suele aportar la idea de repasar o repetir algo (go over, think over) o de traspasar el control (take over, hand over).',
  away: 'La partícula AWAY suele aportar la idea de alejar o hacer desaparecer algo (throw away, go away, get away).',
  back: 'La partícula BACK suele aportar la idea de volver o regresar (come back, get back) o de devolver algo (pay back, call back).',
  through: 'La partícula THROUGH suele aportar la idea de recorrer algo de principio a fin o de superarlo (go through, get through).',
  apart: 'La partícula APART suele aportar la idea de separar algo en partes (take apart, fall apart, come apart).',
  along: 'La partícula ALONG suele aportar la idea de avanzar o acompañar (get along, come along).',
  around: 'La partícula AROUND suele aportar la idea de moverse sin rumbo fijo o de rodear algo (walk around, turn around).',
  round: 'La partícula ROUND suele aportar la idea de moverse sin rumbo fijo o de rodear algo (turn round, come round).',
  about: 'La partícula ABOUT suele aportar la idea de moverse de un lado a otro o de provocar algo (move about, bring about).',
  into: 'La partícula INTO suele aportar la idea de entrar en algo o de transformarse en algo (get into, turn into, run into).',
};

// Extrae la partícula del phrasal verb y devuelve su pista, o null si no aplica.
export function getParticleHint(word: string): string | null {
  const tokens = word.toLowerCase().trim().split(/\s+/);
  if (tokens.length < 2) return null;
  // La partícula es una de las palabras a partir de la segunda (no la primera,
  // que es el verbo). Nos quedamos con la primera partícula conocida.
  for (let i = 1; i < tokens.length; i++) {
    const hint = PARTICLE_HINTS[tokens[i]];
    if (hint) return hint;
  }
  return null;
}
