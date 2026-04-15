/*
  # Add RLS policies for Account Lane, Cost Structure, and Market Information

  1. Security Changes
    - Add SELECT, INSERT, UPDATE, DELETE policies for "Account Lane" table
    - Add SELECT, INSERT, UPDATE, DELETE policies for "Cost Structure" table
    - Add SELECT, INSERT, UPDATE, DELETE policies for "Market Information" table
    - All policies grant access to both anon and authenticated roles
      to match the existing admin table access pattern

  2. Important Notes
    - These three tables already have RLS enabled but had zero policies,
      which was blocking all data access
    - Policies follow the same pattern as the existing accounts/bill_to/shippers tables
*/

CREATE POLICY "Public can read Account Lane"
  ON "Account Lane"
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can insert Account Lane"
  ON "Account Lane"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can update Account Lane"
  ON "Account Lane"
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete Account Lane"
  ON "Account Lane"
  FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read Cost Structure"
  ON "Cost Structure"
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can insert Cost Structure"
  ON "Cost Structure"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can update Cost Structure"
  ON "Cost Structure"
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete Cost Structure"
  ON "Cost Structure"
  FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can read Market Information"
  ON "Market Information"
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can insert Market Information"
  ON "Market Information"
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can update Market Information"
  ON "Market Information"
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete Market Information"
  ON "Market Information"
  FOR DELETE
  TO anon, authenticated
  USING (true);
