/*
  # Create Terms & Conditions table

  1. New Tables
    - `terms_conditions`
      - `id` (uuid, primary key)
      - `name_en` (text, not null) - Term name in English
      - `name_es` (text) - Term name in Spanish
      - `description_en` (text) - Description/content in English
      - `description_es` (text) - Description/content in Spanish
      - `country` (text, not null, default 'All') - US, MX, or All
      - `equipment_type` (text, not null, default 'All') - Equipment type or All
      - `active` (boolean, default true) - Whether the term is active
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on `terms_conditions` table
    - Add policies for anon and authenticated users to read, insert, update, delete

  3. Notes
    - Mirrors the accessorials table pattern for consistency
    - Country uses 'All' to indicate applicable to all countries
    - Equipment type uses 'All' to indicate applicable to all equipment
*/

CREATE TABLE IF NOT EXISTS terms_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en text NOT NULL,
  name_es text DEFAULT '',
  description_en text DEFAULT '',
  description_es text DEFAULT '',
  country text NOT NULL DEFAULT 'All',
  equipment_type text NOT NULL DEFAULT 'All',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE terms_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read terms_conditions"
  ON terms_conditions
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anon users can read terms_conditions"
  ON terms_conditions
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon users can insert terms_conditions"
  ON terms_conditions
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update terms_conditions"
  ON terms_conditions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anon users can delete terms_conditions"
  ON terms_conditions
  FOR DELETE
  TO anon
  USING (true);

CREATE POLICY "Authenticated users can insert terms_conditions"
  ON terms_conditions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update terms_conditions"
  ON terms_conditions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete terms_conditions"
  ON terms_conditions
  FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);
