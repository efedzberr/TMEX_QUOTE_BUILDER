/*
  # Add Accessorial Fields to Quote Lanes

  1. New Columns
    - `accessorials_amount` (numeric) - Total sum of selected accessorials
    - `accessorials_list` (jsonb) - JSON array of selected accessorials with customized rates

  2. Purpose
    - Store the total accessorial charges calculated from selected items
    - Store the detailed list of selected accessorials for reference
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'accessorials_amount'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN accessorials_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'accessorials_list'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN accessorials_list jsonb;
  END IF;
END $$;
