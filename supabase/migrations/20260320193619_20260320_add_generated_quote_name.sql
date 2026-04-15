/*
  # Add generated_quote_name column to quotes

  ## Changes
  - Adds generated_quote_name (text) column to quotes table
  - This stores the computed quote name per the formula:
    [MX Rep Initials][Owner Initials][CustomerCode6][MMDDYYYY]-[###][VV]
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'generated_quote_name'
  ) THEN
    ALTER TABLE quotes ADD COLUMN generated_quote_name text DEFAULT '';
  END IF;
END $$;
