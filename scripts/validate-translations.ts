#!/usr/bin/env npx tsx
/**
 * Valida que todas las traducciones del vocabulario parsean bien con el MISMO
 * parser que usa la app (lib/vocabulary/translationParser). Así, si algún día se
 * edita/añade contenido en Supabase con un formato roto (numeración mal puesta,
 * ejemplo sin "= español", par confuso mal separado…), esto lo caza antes de que
 * se vea mal en la ficha o el buscador — sin necesidad de estructurar la BD.
 *
 * Valida el backup local (supabase/backup/vocabulary.json), que es la copia
 * versionada del contenido. Ejecuta `npm run backup:supabase` antes si acabas de
 * editar Supabase.
 *
 * Uso:  npx tsx scripts/validate-translations.ts
 * Sale con código 1 si hay ERRORES (útil para CI).
 */
import * as fs from 'fs';
import * as path from 'path';
import { analyzeTranslation } from '../lib/vocabulary/translationParser';

interface Row {
  word: string;
  translation: string;
  category: string;
}

const BACKUP = path.join(__dirname, '..', 'supabase', 'backup', 'vocabulary.json');

type Level = 'ERROR' | 'WARN';
interface Issue {
  level: Level;
  word: string;
  category: string;
  msg: string;
}

function validate(row: Row): Issue[] {
  const issues: Issue[] = [];
  const t = row.translation || '';
  const add = (level: Level, msg: string) => issues.push({ level, word: row.word, category: row.category, msg });

  const a = analyzeTranslation(t);
  const body = t.includes(' — ') ? t.slice(t.indexOf(' — ') + 3) : t;
  const numMarkers = (body.match(/\d\)/g) || []).length;

  // El texto parece numerado (2+ marcadores) pero no se detectó como acepciones.
  if (numMarkers >= 2 && a.kind !== 'senses') {
    add('ERROR', `parece numerado (${numMarkers} marcadores) pero no se parsea como acepciones`);
  }

  if (a.kind === 'senses') {
    if (a.senses.length !== numMarkers) {
      add('ERROR', `nº de acepciones parseadas (${a.senses.length}) ≠ marcadores "N)" (${numMarkers})`);
    }
    a.senses.forEach((s) => {
      if (!s.desc) add('ERROR', `acepción ${s.n} sin descripción`);
      if (s.examples.length === 0) add('WARN', `acepción ${s.n} ("${s.desc}") sin ningún ejemplo`);
      s.examples.forEach((ex, i) => {
        if (!ex.en) add('ERROR', `acepción ${s.n}, ejemplo ${i + 1} sin inglés`);
        if (!ex.es) add('WARN', `acepción ${s.n}, ejemplo "${ex.en}" sin traducción (falta "= español")`);
      });
    });
  }

  if (a.kind === 'comparison') {
    if (a.items.length < 2) add('ERROR', `par confuso con menos de 2 elementos`);
    a.items.forEach((it, i) => {
      if (!it.term) add('ERROR', `par confuso, elemento ${i + 1} sin término`);
    });
  }

  // Contiene " | " (marca de par confuso) pero no se detectó como tal.
  if (t.includes(' | ') && a.kind !== 'comparison') {
    add('ERROR', `contiene " | " pero no se parsea como par confuso`);
  }

  return issues;
}

function main() {
  const rows: Row[] = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
  const all: Issue[] = [];
  for (const r of rows) all.push(...validate(r));

  const errors = all.filter((i) => i.level === 'ERROR');
  const warns = all.filter((i) => i.level === 'WARN');

  const print = (list: Issue[]) => {
    const byCat: Record<string, Issue[]> = {};
    for (const i of list) (byCat[i.category] ||= []).push(i);
    for (const [cat, items] of Object.entries(byCat)) {
      console.log(`\n  [${cat}]`);
      for (const i of items) console.log(`    ${i.word}: ${i.msg}`);
    }
  };

  console.log(`\nValidadas ${rows.length} entradas.\n`);
  if (errors.length) {
    console.log(`❌ ${errors.length} ERRORES (rompen la maquetación):`);
    print(errors);
  }
  if (warns.length) {
    console.log(`\n⚠️  ${warns.length} AVISOS (renderiza, pero revisar):`);
    print(warns);
  }
  if (!errors.length && !warns.length) {
    console.log('✅ Todo el contenido parsea correctamente.');
  }
  console.log('');
  process.exit(errors.length ? 1 : 0);
}

main();
