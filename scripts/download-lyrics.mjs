#!/usr/bin/env node
/**
 * Descarga local de letras (uso personal) para cruzarlas con el vocabulario.
 * NO tiene dependencias: usa `curl` (ya viene en macOS) vía child_process.
 *
 * Uso:
 *   node scripts/download-lyrics.mjs
 *
 * Salida: ./letras-playlist.txt  (un único fichero, cada canción precedida de
 *   "### nº | Título | Artista"). Ese formato es el que espera el matcher.
 *
 * Nota: baja contenido con copyright a tu máquina para tu estudio personal.
 * No lo subas al repo. Puedes borrar el .txt cuando termines.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// [nº, título, artista, url directa verificada]
const SONGS = [
  [1, 'Hands On the Wheel', 'ScHoolboy Q, A$AP Rocky', 'https://genius.com/Schoolboy-q-hands-on-the-wheel-lyrics'],
  [2, 'No Role Modelz', 'J. Cole', 'https://genius.com/J-cole-no-role-modelz-lyrics'],
  [3, 'A Place for My Head', 'Linkin Park', 'https://genius.com/Linkin-park-a-place-for-my-head-lyrics'],
  [4, 'Creep', 'Radiohead', 'https://genius.com/Radiohead-creep-lyrics'],
  [5, 'Toxicity', 'System Of A Down', 'https://genius.com/System-of-a-down-toxicity-lyrics'],
  [6, 'Summer Sixteen', 'Drake', 'https://genius.com/Drake-summer-sixteen-lyrics'],
  [7, 'Crawling', 'Linkin Park', 'https://genius.com/Linkin-park-crawling-lyrics'],
  [8, '0 To 100 / The Catch Up', 'Drake', 'https://genius.com/Drake-0-to-100-the-catch-up-lyrics'],
  [9, 'Just What I Am', 'Kid Cudi, King Chip', 'https://genius.com/Kid-cudi-just-what-i-am-lyrics'],
  [10, 'Blessings', 'Big Sean, Drake', 'https://genius.com/Big-sean-blessings-lyrics'],
  [11, 'Champagne Supernova', 'Oasis', 'https://genius.com/Oasis-champagne-supernova-lyrics'],
  [12, 'Trophies', 'Drake', 'https://genius.com/Drake-trophies-lyrics'],
  [13, 'Portland', 'Drake, Quavo, Travis Scott', 'https://genius.com/Drake-portland-lyrics'],
  [14, 'B.Y.O.B.', 'System Of A Down', 'https://genius.com/System-of-a-down-byob-lyrics'],
  [15, 'Do It Myself', 'Russ', 'https://genius.com/Russ-do-it-myself-lyrics'],
  [16, 'Everyday', 'A$AP Rocky, Rod Stewart, Miguel, Mark Ronson', 'https://genius.com/A-ap-rocky-everyday-lyrics'],
  [17, "Don't Look Back In Anger", 'Oasis', 'https://genius.com/Oasis-dont-look-back-in-anger-lyrics'],
  [18, 'From the Inside', 'Linkin Park', 'https://genius.com/Linkin-park-from-the-inside-lyrics'],
  [19, 'Hotline Bling', 'Drake', 'https://genius.com/Drake-hotline-bling-lyrics'],
  [20, "All These Things That I've Done", 'The Killers', 'https://genius.com/The-killers-all-these-things-that-ive-done-lyrics'],
  [21, 'Runaway', 'Linkin Park', 'https://genius.com/Linkin-park-runaway-lyrics'],
  [22, 'Pure Morning', 'Placebo', 'https://genius.com/Placebo-pure-morning-lyrics'],
  [23, 'Young, Wild & Free', 'Snoop Dogg, Wiz Khalifa, Bruno Mars', 'https://genius.com/Snoop-dogg-and-wiz-khalifa-young-wild-and-free-lyrics'],
  [24, "Can't Hold Us", 'Macklemore & Ryan Lewis, Ray Dalton', 'https://genius.com/Macklemore-and-ryan-lewis-cant-hold-us-lyrics'],
  [25, 'Lost In Hollywood', 'System Of A Down', 'https://genius.com/System-of-a-down-lost-in-hollywood-lyrics'],
  [26, 'Radio/Video', 'System Of A Down', 'https://genius.com/System-of-a-down-radio-video-lyrics'],
  [27, 'Paper Trail$', 'Joey Bada$$', 'https://genius.com/Joey-bada-paper-trail-lyrics'],
  [28, 'Yellow', 'Coldplay', 'https://genius.com/Coldplay-yellow-lyrics'],
  [29, 'Memories', 'David Guetta, Kid Cudi', 'https://genius.com/David-guetta-memories-lyrics'],
  [30, 'Take Me Out', 'Franz Ferdinand', 'https://genius.com/Franz-ferdinand-take-me-out-lyrics'],
  [31, 'Trouble On My Mind', 'Pusha T, Tyler, The Creator', 'https://genius.com/Pusha-t-trouble-on-my-mind-lyrics'],
  [32, 'Radioactive (Remix)', 'Imagine Dragons, Kendrick Lamar', 'https://genius.com/Imagine-dragons-radioactive-remix-lyrics'],
  [33, 'HUMBLE.', 'Kendrick Lamar', 'https://genius.com/Kendrick-lamar-humble-lyrics'],
  [34, 'One Dance', 'Drake, Wizkid, Kyla', 'https://genius.com/Drake-one-dance-lyrics'],
  [35, 'X', 'ScHoolboy Q, 2 Chainz, Saudi', 'https://genius.com/Schoolboy-q-2-chainz-and-saudi-x-lyrics'],
  [36, 'Wet Dreamz', 'J. Cole', 'https://genius.com/J-cole-wet-dreamz-lyrics'],
  [37, 'New Born', 'Muse', 'https://genius.com/Muse-new-born-lyrics'],
  [38, 'Soundtrack 2 My Life', 'Kid Cudi', 'https://genius.com/Kid-cudi-soundtrack-2-my-life-lyrics'],
  [39, 'Hip-Hop Saved My Life', 'Lupe Fiasco, Nikki Jean', 'https://genius.com/Lupe-fiasco-hip-hop-saved-my-life-lyrics'],
  [40, 'A Light That Never Comes', 'Linkin Park, Steve Aoki', 'https://genius.com/Linkin-park-and-steve-aoki-a-light-that-never-comes-lyrics'],
  [41, 'Live Forever', 'Oasis', 'https://genius.com/Oasis-live-forever-lyrics'],
  [42, 'Smile Like You Mean It', 'The Killers', 'https://genius.com/The-killers-smile-like-you-mean-it-lyrics'],
  [43, 'Nightcall', 'Kavinsky', 'https://genius.com/Kavinsky-nightcall-lyrics'],
  [44, 'Mr. Brightside', 'The Killers', 'https://genius.com/The-killers-mr-brightside-lyrics'],
  [45, 'Bohemian Rhapsody', 'Queen', 'https://genius.com/Queen-bohemian-rhapsody-lyrics'],
  [46, 'The Hills', 'The Weeknd', 'https://genius.com/The-weeknd-the-hills-lyrics'],
  [47, 'Scared of the Dark', 'Lil Wayne, Ty Dolla $ign, XXXTENTACION', 'https://genius.com/Lil-wayne-scared-of-the-dark-lyrics'],
  [48, 'Chop Suey!', 'System Of A Down', 'https://genius.com/System-of-a-down-chop-suey-lyrics'],
  [49, 'November Rain', "Guns N' Roses", 'https://genius.com/Guns-n-roses-november-rain-lyrics'],
  [50, 'Sucker for Pain', 'Lil Wayne, Wiz Khalifa, Imagine Dragons…', 'https://genius.com/Lil-wayne-wiz-khalifa-and-imagine-dragons-sucker-for-pain-lyrics'],
  [51, 'Dark Horse', 'Katy Perry, Juicy J', 'https://genius.com/Katy-perry-dark-horse-lyrics'],
  [52, 'Famous', 'Kanye West', 'https://genius.com/Kanye-west-famous-lyrics'],
  [53, 'Unchained (The Payback / Untouchable)', 'James Brown, 2Pac', 'https://genius.com/2pac-unchained-the-payback-untouchable-lyrics'],
  [54, 'Enter Sandman', 'Metallica', 'https://genius.com/Metallica-enter-sandman-lyrics'],
  [55, 'Under the Bridge', 'Red Hot Chili Peppers', 'https://genius.com/Red-hot-chili-peppers-under-the-bridge-lyrics'],
  [56, 'The Narcissist', 'Blur', 'https://genius.com/Blur-the-narcissist-lyrics'],
  [57, 'Blood On The Leaves', 'Kanye West', 'https://genius.com/Kanye-west-blood-on-the-leaves-lyrics'],
  [58, 'Paradise', 'Coldplay', 'https://genius.com/Coldplay-paradise-lyrics'],
  [59, 'Running Up That Hill', 'Placebo', 'https://genius.com/Placebo-running-up-that-hill-lyrics'],
  [60, 'Stronger', 'Kanye West', 'https://genius.com/Kanye-west-stronger-lyrics'],
  [61, 'Radioactive', 'Imagine Dragons', 'https://genius.com/Imagine-dragons-radioactive-lyrics'],
  [62, 'Paradise City', "Guns N' Roses", 'https://genius.com/Guns-n-roses-paradise-city-lyrics'],
  [63, 'Sunflower', 'Post Malone, Swae Lee', 'https://genius.com/Post-malone-and-swae-lee-sunflower-lyrics'],
  [64, 'Marijuana', 'Kid Cudi', 'https://genius.com/Kid-cudi-marijuana-lyrics'],
  [65, 'Black Skinhead', 'Kanye West', 'https://genius.com/Kanye-west-black-skinhead-lyrics'],
  [66, 'Where Is My Mind?', 'Pixies', 'https://genius.com/Pixies-where-is-my-mind-lyrics'],
  [67, 'Black Summer', 'Red Hot Chili Peppers', 'https://genius.com/Red-hot-chili-peppers-black-summer-lyrics'],
  [68, 'Still D.R.E.', 'Dr. Dre, Snoop Dogg', 'https://genius.com/Dr-dre-still-dre-lyrics'],
  [69, 'Thrift Shop', 'Macklemore & Ryan Lewis, Wanz', 'https://genius.com/Macklemore-and-ryan-lewis-thrift-shop-lyrics'],
  [70, 'If I Lose Myself', 'OneRepublic, Alesso', 'https://genius.com/Onerepublic-if-i-lose-myself-lyrics'],
  [71, 'Bangarang', 'Skrillex, Sirah', 'https://genius.com/Skrillex-bangarang-lyrics'],
  [72, 'Ball For Me', 'Post Malone, Nicki Minaj', 'https://genius.com/Post-malone-ball-for-me-lyrics'],
];

const OUT = 'letras-playlist.txt';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fetchHtml(url) {
  return execFileSync('curl', ['-sL', '-A', UA, '--max-time', '25', url], {
    encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024,
  });
}

function decodeEntities(s) {
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Extrae el contenido de TODOS los <div data-lyrics-container="true"> contando
// la profundidad de <div> para cerrar cada uno en su </div> correcto (Genius
// inyecta cabeceras y sidebars a mitad, así que no vale cortar por marcadores).
function extractContainers(html) {
  const marker = 'data-lyrics-container="true"';
  let idx = 0;
  const out = [];
  while (true) {
    const f = html.indexOf(marker, idx);
    if (f === -1) break;
    let p = html.indexOf('>', f) + 1;
    const start = p;
    let depth = 1;
    while (depth > 0 && p < html.length) {
      const o = html.indexOf('<div', p);
      const c = html.indexOf('</div>', p);
      if (c === -1) { p = html.length; break; }
      if (o !== -1 && o < c) { depth++; p = o + 4; }
      else { depth--; p = c + 6; if (depth === 0) out.push(html.slice(start, c)); }
    }
    idx = p;
  }
  return out.join('\n');
}

function extractLyrics(html) {
  let region = extractContainers(html);
  if (!region) return '';
  region = region.replace(/<\/div>/gi, '\n').replace(/<\/p>/gi, '\n');
  region = decodeEntities(region);
  region = region.replace(/<[^>]+>/g, ''); // quitar tags restantes
  // Quitar cabecera de créditos ("… Read More") si va antes de la 1ª [Sección].
  const b = region.indexOf('[');
  const rm = region.search(/Read More/i);
  if (rm !== -1 && (b === -1 || rm < b)) region = region.slice(rm + 9);
  region = region.replace(/You might also like/gi, '\n').replace(/\d*Embed\s*$/i, '');
  // Limpiar líneas y colapsar huecos.
  const lines = region.split('\n').map((l) => l.replace(/ /g, ' ').trimEnd());
  const out = [];
  let blanks = 0;
  for (const l of lines) {
    if (l.trim() === '') { if (++blanks <= 1 && out.length) out.push(''); }
    else { blanks = 0; out.push(l); }
  }
  return out.join('\n').trim();
}

async function main() {
  const chunks = [];
  const failed = [];
  for (const [n, title, artist, url] of SONGS) {
    let lyrics = '';
    for (let attempt = 1; attempt <= 2 && !lyrics; attempt++) {
      try { lyrics = extractLyrics(fetchHtml(url)); } catch { /* reintento */ }
      if (!lyrics && attempt === 1) await sleep(1500);
    }
    if (lyrics) {
      process.stderr.write(`✓ ${n}/72  ${title}\n`);
    } else {
      process.stderr.write(`✗ ${n}/72  ${title}  (vacío — cógela a mano: ${url})\n`);
      failed.push([n, title, url]);
    }
    chunks.push(`### ${n} | ${title} | ${artist}\n${lyrics || '(NO DESCARGADA — pega la letra a mano aquí)'}\n`);
    await sleep(900 + Math.random() * 700); // educado con el servidor
  }
  writeFileSync(OUT, chunks.join('\n') + '\n', 'utf8');
  process.stderr.write(`\n📄 Escrito ${OUT} (${SONGS.length - failed.length}/${SONGS.length} con letra).\n`);
  if (failed.length) {
    process.stderr.write('Faltaron:\n' + failed.map(([n, t]) => `  - ${n} ${t}`).join('\n') + '\n');
  }
}

main();
