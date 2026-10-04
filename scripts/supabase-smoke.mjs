// Verifies Supabase end-to-end for budgets, recurring, debts:
// 1) tables exist and are readable  2) insert works  3) upsert works  4) delete works
// Run: node scripts/supabase-smoke.mjs
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Parse .env.local (simple KEY=VALUE)
const env = {};
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!url || !key || url.includes('your-project-url')) {
  console.error('FAIL: Supabase env vars missing in .env.local');
  process.exit(1);
}
console.log('Config OK →', url.replace(/^https:\/\/([a-z0-9]+)\..*/i, '$1') + '.supabase.co');

const supabase = createClient(url, key);
const stamp = Date.now();
const tests = [
  {
    table: 'budgets',
    row: { id: `smoke_b_${stamp}`, name: 'SMOKE_TEST', category_id: null, amount: 1, period: 'monthly', start_date: null, end_date: null, categories: null },
  },
  {
    table: 'recurring',
    row: { id: `smoke_r_${stamp}`, name: 'SMOKE_TEST', type: 'expense', amount: 1, category_id: 'cat_other_exp', account_id: 'acc_cash', frequency: 'monthly', next_due_date: '2030-01-01', is_active: true },
  },
  {
    table: 'debts',
    row: { id: `smoke_d_${stamp}`, type: 'lend', person_name: 'SMOKE_TEST', total_amount: 1, remaining_amount: 1, due_date: null, note: null, status: 'active', created_at: stamp },
  },
];

let failures = 0;
for (const { table, row } of tests) {
  // count existing rows first
  const cnt = await supabase.from(table).select('id', { count: 'exact', head: true });
  if (cnt.error) {
    console.error(`✗ ${table}: NOT ACCESSIBLE — ${cnt.error.message} (run supabase_schema.sql)`);
    failures++;
    continue;
  }
  console.log(`• ${table}: reachable, ${cnt.count ?? '?'} existing rows`);

  const ins = await supabase.from(table).insert(row);
  if (ins.error) { console.error(`✗ ${table}: INSERT FAILED — ${ins.error.message}`); failures++; continue; }

  const up = await supabase.from(table).upsert({ ...row, amount: row.amount, status: row.status });
  if (up.error) { console.error(`✗ ${table}: UPSERT FAILED — ${up.error.message}`); failures++; continue; }

  const del = await supabase.from(table).delete().eq('id', row.id);
  if (del.error) { console.error(`✗ ${table}: DELETE FAILED — ${del.error.message}`); failures++; continue; }

  console.log(`✓ ${table}: insert + upsert + delete OK`);
}

console.log(failures === 0 ? '\nALL TABLES OK — app data will persist to Supabase.' : `\n${failures} table(s) failed — see messages above.`);
process.exit(failures === 0 ? 0 : 1);
