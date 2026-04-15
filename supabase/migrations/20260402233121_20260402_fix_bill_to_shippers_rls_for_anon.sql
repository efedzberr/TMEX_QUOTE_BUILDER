/*
  # Fix Bill To and Shippers RLS policies to allow anonymous access

  1. Problem
    - The `bill_to` and `shippers` tables only allow `authenticated` role for insert, update, delete
    - The application does not use authentication, so the Supabase client operates as `anon`
    - This causes "new row violates row-level security policy" errors on insert/update/delete

  2. Changes
    - Drop the authenticated-only insert/update/delete policies on `bill_to`
    - Drop the authenticated-only insert/update/delete policies on `shippers`
    - Create new policies that allow both `anon` and `authenticated` roles
    - Matches the existing pattern used on the `accounts` table

  3. Security
    - Read policies remain unchanged (already public)
    - Write policies now allow both anon and authenticated roles
*/

-- bill_to: drop old authenticated-only write policies
DROP POLICY IF EXISTS "Authenticated users can insert bill_to" ON bill_to;
DROP POLICY IF EXISTS "Authenticated users can update bill_to" ON bill_to;
DROP POLICY IF EXISTS "Authenticated users can delete bill_to" ON bill_to;

-- bill_to: create new public write policies
CREATE POLICY "Public can insert bill_to"
  ON bill_to FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can update bill_to"
  ON bill_to FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete bill_to"
  ON bill_to FOR DELETE
  TO anon, authenticated
  USING (true);

-- shippers: drop old authenticated-only write policies
DROP POLICY IF EXISTS "Authenticated users can insert shippers" ON shippers;
DROP POLICY IF EXISTS "Authenticated users can update shippers" ON shippers;
DROP POLICY IF EXISTS "Authenticated users can delete shippers" ON shippers;

-- shippers: create new public write policies
CREATE POLICY "Public can insert shippers"
  ON shippers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can update shippers"
  ON shippers FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete shippers"
  ON shippers FOR DELETE
  TO anon, authenticated
  USING (true);
