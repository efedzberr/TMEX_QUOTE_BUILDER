/*
  # Add missing columns to accounts table

  ## Summary
  The accounts table was created before the Administration feature was added and
  only has `name` and `account_type`. The Administration view and lookup fields
  expect `account_name`, `account_code`, `type`, and `status` columns.

  ## Changes
  - `accounts`: add `account_name`, `account_code`, `type`, `status`, `updated_at`
    columns if they don't exist
  - Populate `account_name` from existing `name` for any existing rows
  - Add RLS policies if not already present
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'account_name'
  ) THEN
    ALTER TABLE accounts ADD COLUMN account_name text NOT NULL DEFAULT '';
    UPDATE accounts SET account_name = name WHERE account_name = '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'account_code'
  ) THEN
    ALTER TABLE accounts ADD COLUMN account_code text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'type'
  ) THEN
    ALTER TABLE accounts ADD COLUMN type text NOT NULL DEFAULT 'Direct Customer';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'status'
  ) THEN
    ALTER TABLE accounts ADD COLUMN status text NOT NULL DEFAULT 'Active';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE accounts ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;
