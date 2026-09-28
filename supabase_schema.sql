-- 1. Create Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bank',
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  icon TEXT DEFAULT 'CreditCard',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'expense' or 'income'
  icon TEXT NOT NULL,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'expense', 'income', or 'transfer'
  amount NUMERIC NOT NULL,
  category_id TEXT NOT NULL,
  subcategory_id TEXT,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  time TEXT,
  note TEXT,
  created_at BIGINT NOT NULL
);

-- 4. Create Budgets / Spending Goals Table
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  name TEXT,
  category_id TEXT,
  amount NUMERIC NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  start_date DATE,
  end_date DATE,
  categories JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Recurring Transactions Table
CREATE TABLE IF NOT EXISTS recurring (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'expense',
  amount NUMERIC NOT NULL,
  category_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  next_due_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create Debts / Borrow & Loan Table
CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'lent' or 'borrowed'
  person_name TEXT NOT NULL,
  total_amount NUMERIC NOT NULL,
  remaining_amount NUMERIC NOT NULL,
  due_date DATE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at BIGINT NOT NULL
);

-- 7. Create App Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'app_settings',
  currency_symbol TEXT NOT NULL DEFAULT '$',
  currency_code TEXT NOT NULL DEFAULT 'USD',
  vibrate_on_tap BOOLEAN NOT NULL DEFAULT true,
  quick_add_keybind TEXT DEFAULT 'n',
  week_start_day INT DEFAULT 1,
  goals JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safe migrations in case tables already existed previously
ALTER TABLE settings ADD COLUMN IF NOT EXISTS quick_add_keybind TEXT DEFAULT 'n';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS week_start_day INT DEFAULT 1;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS goals JSONB;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS categories JSONB;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS parent_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS subcategory_id TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS time TEXT;

-- 8. Enable Row Level Security (RLS) & Public access for Personal Single-User Vault
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to budgets" ON budgets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to recurring" ON recurring FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to debts" ON debts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to settings" ON settings FOR ALL USING (true) WITH CHECK (true);
