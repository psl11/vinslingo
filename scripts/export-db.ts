#!/usr/bin/env npx tsx
/**
 * Export Supabase tables to local JSON so the content can be reviewed/audited
 * offline (feeds scripts/validate-content.ts).
 *
 * Usage:
 *   EXPO_PUBLIC_SUPABASE_URL=... EXPO_PUBLIC_SUPABASE_ANON_KEY=... \
 *     npx tsx scripts/export-db.ts
 *
 * Or put them in a local .env (git-ignored) and run with your usual loader.
 * Writes data/<table>.json (paginated, so it isn't capped at 1000 rows).
 *
 * The anon key is the public client key (RLS-protected); it is NOT a secret,
 * but the exported files may contain song lyrics — decide before committing.
 */

import { mkdirSync, writeFileSync } from 'node:fs';

// Tables worth exporting for a content review. Vocabulary holds the sentences
// and songs; the rest are included for completeness.
const TABLES = ['vocabulary', 'gap_fill_exercises'];

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY.');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, key);
  mkdirSync('data', { recursive: true });

  for (const table of TABLES) {
    const rows: any[] = [];
    const PAGE = 1000;
    try {
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < PAGE) break;
      }
      const path = `data/${table}.json`;
      writeFileSync(path, JSON.stringify(rows, null, 2));
      console.log(`✅ ${table}: ${rows.length} filas → ${path}`);
    } catch (e: any) {
      console.error(`❌ ${table}: ${e.message}`);
    }
  }
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
