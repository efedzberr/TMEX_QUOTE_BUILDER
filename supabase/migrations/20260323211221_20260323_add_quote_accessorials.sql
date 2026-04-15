/*
  # Add Accessorials Fields to Quotes Table

  1. Changes
    - Add `accessorials_amount` (numeric) to quotes table — total of quote-level accessorials
    - Add `accessorials_list` (jsonb) to quotes table — JSON array of selected accessorials

  2. Notes
    - These fields capture quote-level accessorial charges (from the Accessorials tab)
    - Separate from per-lane accessorials stored on quote_lanes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'accessorials_amount'
  ) THEN
    ALTER TABLE quotes ADD COLUMN accessorials_amount numeric DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'accessorials_list'
  ) THEN
    ALTER TABLE quotes ADD COLUMN accessorials_list jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
