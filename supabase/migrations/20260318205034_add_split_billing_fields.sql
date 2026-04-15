/*
  # Add Split Billing Fields to Quote Lanes

  1. New Columns
    - `split_billing_group` - Text field to identify split billing groups ('one-way', 'round-trip', 'circuit')
    - `split_billing_index` - Integer to track lane order within a split billing group (1, 2, 3, or 4)
    - `is_auto_populated` - Boolean flag for lanes that are auto-populated and read-only

  2. Purpose
    - Enable tracking of linked lanes created as part of split billing features
    - Auto-populate certain lanes in round-trip and circuit configurations
    - Distinguish split billing lanes from regular lanes visually
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'split_billing_group'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN split_billing_group TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'split_billing_index'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN split_billing_index INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'is_auto_populated'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN is_auto_populated BOOLEAN DEFAULT false;
  END IF;
END $$;
