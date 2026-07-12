// Puebla vocabulary.pronunciation (IPA US) y vocabulary.pronunciation_es
// (respelling legible adaptado al español) para las palabras de UNA sola palabra.
// IPA de open-dict `ipa-dict` (en_US). Diseño en docs/music-feature.md? no:
// docs sobre pronunciación pendiente. dry-run por defecto; --apply escribe.
//
// Uso:  node scripts/set-pronunciation.mjs [--apply]
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const IPA_URL = 'https://raw.githubusercontent.com/open-dict-data/ipa-dict/master/data/en_US.txt';
const CACHE = path.join(os.tmpdir(), 'vinslingo-en_US.txt');

if (!fs.existsSync(CACHE)) {
  execSync(`curl -sL --max-time 60 -o "${CACHE}" "${IPA_URL}"`);
}
const dict = {};
for (const l of fs.readFileSync(CACHE, 'utf8').split('\n')) {
  const i = l.indexOf('\t'); if (i < 0) continue;
  dict[l.slice(0, i).toLowerCase()] = l.slice(i + 1).split(',')[0].trim(); // "/ˈkɪdni/"
}

// --- IPA -> respelling español (peninsular) ---
const MULTI = [
  ['tʃ', 'ch'], ['dʒ', 'y'], ['aɪ', 'ai'], ['eɪ', 'ei'], ['ɔɪ', 'oi'], ['aʊ', 'au'],
  ['oʊ', 'ou'], ['əʊ', 'ou'], ['ɪə', 'ia'], ['eə', 'ea'], ['ʊə', 'ua'],
  ['iː', 'i'], ['uː', 'u'], ['ɑː', 'a'], ['ɔː', 'o'], ['ɜː', 'er'],
];
const SINGLE = {
  i: 'i', ɪ: 'i', e: 'e', ɛ: 'e', æ: 'a', ʌ: 'a', ɑ: 'a', ɒ: 'o', ɔ: 'o', ʊ: 'u', u: 'u', ə: 'e',
  ɜ: 'er', ɝ: 'er', ɚ: 'er',
  p: 'p', b: 'b', t: 't', d: 'd', k: 'k', g: 'g', m: 'm', n: 'n', ŋ: 'ng', f: 'f', v: 'v',
  s: 's', z: 's', l: 'l', w: 'u', j: 'y', h: 'j', r: 'r', ɹ: 'r', θ: 'z', ð: 'd', ʃ: 'sh', ʒ: 'y',
  ɫ: 'l', ɡ: 'g', ɾ: 'r', ɐ: 'a', ᵻ: 'i', ɨ: 'i', ʔ: '',
};
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
const ACC = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' };

function respell(ipaRaw) {
  const ipa = ipaRaw.replace(/^\/|\/$/g, '');
  const toks = [];
  let k = 0;
  while (k < ipa.length) {
    const ch = ipa[k];
    if (ch === 'ˈ') { toks.push({ stress: 1 }); k++; continue; }
    if (ch === 'ˌ') { toks.push({ stress: 0 }); k++; continue; }
    if ('. ˑ̩̯'.includes(ch)) { k++; continue; }
    const two = ipa.slice(k, k + 2);
    const m = MULTI.find(([a]) => a === two);
    if (m) { toks.push({ out: m[1] }); k += 2; continue; }
    if (SINGLE[ch] != null) { toks.push({ out: SINGLE[ch] }); k++; continue; }
    k++;
  }
  let out = '';
  let pending = false;
  for (const t of toks) {
    if (t.stress === 1) { pending = true; continue; }
    if (t.stress === 0) continue;
    let s = t.out;
    if (pending) {
      const idx = [...s].findIndex((c) => VOWELS.has(c));
      if (idx >= 0) { s = s.slice(0, idx) + ACC[s[idx]] + s.slice(idx + 1); pending = false; }
    }
    out += s;
  }
  return out;
}

async function main() {
  const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  // PostgREST limita a 1000 filas por página → paginar con .range.
  const vocab = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('vocabulary').select('*').range(from, from + 999);
    if (error) { console.error(error); process.exit(1); }
    vocab.push(...data);
    if (data.length < 1000) break;
  }

  const lookup = (word) => dict[word.toLowerCase().replace(/[’]/g, "'")];
  const patched = [];
  let single = 0, multi = 0, noIpa = 0;
  for (const v of vocab) {
    const w = (v.word || '').trim();
    if (/\(uk vs us\)/i.test(w)) continue; // trampas UK↔US fuera
    const words = w.split(/\s+/);
    let ipa, es;
    if (words.length === 1) {
      single++;
      ipa = lookup(w);
      if (!ipa) { noIpa++; continue; }
      es = respell(ipa);
    } else {
      // Multipalabra (phrasals, idioms, expresiones): componer palabra a palabra.
      multi++;
      const parts = words.map(lookup);
      if (parts.some((p) => !p)) { noIpa++; continue; } // si falta alguna, mejor nada
      ipa = '/' + parts.map((p) => p.replace(/^\/|\/$/g, '')).join(' ') + '/';
      es = parts.map((p) => respell(p)).join(' ');
    }
    const { updated_at, ...rest } = v; // dejar que el trigger ponga updated_at
    patched.push({ ...rest, pronunciation: ipa, pronunciation_es: es });
  }

  console.log(`\n${APPLY ? '🔧 APLICANDO' : '🔍 DRY-RUN'}`);
  console.log(`1 palabra: ${single} | multipalabra: ${multi} | con pronunciación: ${patched.length} | sin IPA: ${noIpa}`);
  console.log('muestra:');
  for (const w of ['kidney', 'minute', 'through', 'world', 'beautiful', 'let out', 'take off', 'run out', 'give up', 'look after']) {
    const p = patched.find((x) => x.word.toLowerCase() === w);
    if (p) console.log(`  ${w.padEnd(12)} ${p.pronunciation.padEnd(16)} ${p.pronunciation_es}`);
  }

  if (!APPLY) { console.log('\nℹ️  dry-run. Añade --apply.\n'); return; }

  for (let i = 0; i < patched.length; i += 200) {
    const { error: e } = await supabase.from('vocabulary').upsert(patched.slice(i, i + 200), { onConflict: 'id' });
    if (e) { console.error('upsert', e); process.exit(1); }
  }
  console.log(`\n✅ Pobladas ${patched.length} palabras (pronunciation + pronunciation_es).`);
}
main();
