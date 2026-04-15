/*
  # Add RLS policies to accounts table

  ## Summary
  Ensures the accounts table has public read/write policies so the application
  can query and insert account records without authentication.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Public can read accounts'
  ) THEN
    CREATE POLICY "Public can read accounts"
      ON accounts FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Public can insert accounts'
  ) THEN
    CREATE POLICY "Public can insert accounts"
      ON accounts FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Public can update accounts'
  ) THEN
    CREATE POLICY "Public can update accounts"
      ON accounts FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'Public can delete accounts'
  ) THEN
    CREATE POLICY "Public can delete accounts"
      ON accounts FOR DELETE
      TO anon, authenticated
      USING (true);
  END IF;
END $$;
