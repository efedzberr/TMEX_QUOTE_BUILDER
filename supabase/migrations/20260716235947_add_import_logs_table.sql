/*
  # Add Import Logs
  1. New Tables
    - `import_logs`
      - `id` (uuid, primary key)
      - `imported_at` (timestamptz) - When the import ran
      - `imported_by` (text) - Who ran the import
      - `import_type` (text) - Quote Lanes, Market, Cost Structure, etc.
      - `file_name` (text) - Uploaded file name
      - `quote_id` (uuid) - Optional target quote for quote-scoped imports
      - `status` (text) - success | partial | failed
      - `total_rows` (integer) - Rows in the file
      - `imported_rows` (integer) - Rows written successfully
      - `error_rows` (integer) - Rows skipped or failed
      - `errors` (jsonb) - Per-row error detail
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS on `import_logs`
    - Add read/insert policies for anon and authenticated users
  3. Indexes
    - Index on `imported_at` (desc) for recent-first listing and stat cards
*/
CREATE TABLE IF NOT EXISTS import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by text NOT NULL DEFAULT '',
  import_type text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  quote_id uuid,
  status text NOT NULL DEFAULT 'success',
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anon and auth can read import_logs'
  ) THEN
    CREATE POLICY "Anon and auth can read import_logs"
      ON import_logs FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anon and auth can insert import_logs'
  ) THEN
    CREATE POLICY "Anon and auth can insert import_logs"
      ON import_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_import_logs_imported_at ON import_logs(imported_at DESC);