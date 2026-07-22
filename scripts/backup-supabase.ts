#!/usr/bin/env npx tsx
/**
 * Backup del contenido público (no sensible) de Supabase a JSON local.
 * Excluye deliberadamente tablas de datos de usuario (profiles, study_sessions,
 * user_vocabulary, user_lessons) por privacidad: solo se respalda contenido
 * editorial (vocabulario, canciones, artistas...) que sería costoso recrear
 * si el proyecto de Supabase se pierde de nuevo.
 *
 * Run: npx tsx scripts/backup-supabase.ts
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !key) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (carga .env primero)');
  process.exit(1);
}

const supabase = createClient(url, key);

// Tablas de contenido público (curado editorialmente). NO incluir aquí
// ninguna tabla con datos de usuario (profiles, study_sessions, user_*).
const CONTENT_TABLES = [
  'vocabulary', 'songs', 'song_vocabulary', 'song_notes', 'artists',
  'authors', 'quotes', 'quote_vocabulary',
] as const;

const OUTPUT_DIR = path.join(__dirname, '..', 'supabase', 'backup');
const PAGE_SIZE = 1000;

async function fetchAllRows(table: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`[${table}] ${error.message}`);
    }
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const summary: Record<string, number> = {};

  for (const table of CONTENT_TABLES) {
    process.stdout.write(`Descargando ${table}... `);
    const rows = await fetchAllRows(table);
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${table}.json`),
      JSON.stringify(rows, null, 2) + '\n',
      'utf-8'
    );
    summary[table] = rows.length;
    console.log(`${rows.length} filas`);
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, '_meta.json'),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        supabase_url: url,
        tables: summary,
      },
      null,
      2
    ) + '\n',
    'utf-8'
  );

  console.log('\nBackup completo:', OUTPUT_DIR);
}

main().catch((err) => {
  console.error('Backup falló:', err.message);
  process.exit(1);
});
