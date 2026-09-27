-- =========================================================================
-- NULLVAULT SECURITY UPGRADE: RESTRICT STRICTLY TO OWNER
-- Run this in your Supabase SQL Editor to enforce database-level security
-- =========================================================================

-- 1. Drop old public policies
DROP POLICY IF EXISTS "Allow full access to accounts" ON accounts;
DROP POLICY IF EXISTS "Allow full access to categories" ON categories;
DROP POLICY IF EXISTS "Allow full access to transactions" ON transactions;
DROP POLICY IF EXISTS "Allow full access to budgets" ON budgets;
DROP POLICY IF EXISTS "Allow full access to settings" ON settings;

-- 2. Create strict owner-only policies (authenticated & email must match)
CREATE POLICY "Owner only accounts" ON accounts
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() ->> 'email') = 'ong.chayathon@gmail.com')
  WITH CHECK ((SELECT auth.jwt() ->> 'email') = 'ong.chayathon@gmail.com');

CREATE POLICY "Owner only categories" ON categories
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() ->> 'email') = 'ong.chayathon@gmail.com')
  WITH CHECK ((SELECT auth.jwt() ->> 'email') = 'ong.chayathon@gmail.com');

CREATE POLICY "Owner only transactions" ON transactions
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() ->> 'email') = 'ong.chayathon@gmail.com')
  WITH CHECK ((SELECT auth.jwt() ->> 'email') = 'ong.chayathon@gmail.com');

CREATE POLICY "Owner only budgets" ON budgets
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() ->> 'email') = 'ong.chayathon@gmail.com')
  WITH CHECK ((SELECT auth.jwt() ->> 'email') = 'ong.chayathon@gmail.com');

CREATE POLICY "Owner only settings" ON settings
  FOR ALL
  TO authenticated
  USING ((SELECT auth.jwt() ->> 'email') = 'ong.chayathon@gmail.com')
  WITH CHECK ((SELECT auth.jwt() ->> 'email') = 'ong.chayathon@gmail.com');
