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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'expense', 'income', or 'transfer'
  amount NUMERIC NOT NULL,
  category_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  note TEXT,
  created_at BIGINT NOT NULL
);

-- 4. Create Budgets Table
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create App Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'app_settings',
  currency_symbol TEXT NOT NULL DEFAULT '$',
  currency_code TEXT NOT NULL DEFAULT 'USD',
  vibrate_on_tap BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Enable Row Level Security (RLS) & Public access for Personal Single-User Vault
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to budgets" ON budgets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to settings" ON settings FOR ALL USING (true) WITH CHECK (true);
