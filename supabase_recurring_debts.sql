-- ═══════════════════════════════════════════════════════════════════
-- NØVA — Recurring & Debts tables (paste into Supabase SQL Editor)
-- Matches the exact columns the app reads/writes (supabase_schema.sql #5 & #6).
-- Safe to re-run: IF NOT EXISTS / IF NOT EXISTS guards everywhere.
-- ═══════════════════════════════════════════════════════════════════

-- 1) Recurring transactions (bills, subscriptions, salary)
CREATE TABLE IF NOT EXISTS recurring (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',          -- 'expense' | 'income'
  amount NUMERIC NOT NULL,
  category_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',     -- 'daily' | 'weekly' | 'monthly' | 'yearly'
  next_due_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Debts / borrow & lend tracker
CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                            -- 'lend' (owes you) | 'borrow' (you owe)
  person_name TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  remaining_amount NUMERIC NOT NULL,
  due_date DATE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active',         -- 'active' | 'settled'
  created_at BIGINT NOT NULL
);

-- 3) Row Level Security — personal single-user vault pattern (same as your other tables)
ALTER TABLE recurring ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- 4) Full-access policies (anon key is protected by your AuthGate vault)
DROP POLICY IF EXISTS "Allow full access to recurring" ON recurring;
DROP POLICY IF EXISTS "Allow full access to debts" ON debts;

CREATE POLICY "Allow full access to recurring"
  ON recurring FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access to debts"
  ON debts FOR ALL
  USING (true)
  WITH CHECK (true);

-- Done. The app will pick the tables up on next load — no code changes needed.
