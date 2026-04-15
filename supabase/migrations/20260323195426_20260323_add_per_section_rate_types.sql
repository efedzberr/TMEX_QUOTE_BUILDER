/*
  # Add Per-Section Rate Types to Quote Lanes

  ## Summary
  Adds two new columns to the quote_lanes table so that the US Section and
  MX Section in the Lane Details modal can each have an independent Rate Type
  selection (Flat Rate or RPM).

  ## New Columns
  - `us_rate_type` (text) — Rate Type for the US Section. Defaults to 'FLT'.
  - `mx_rate_type` (text) — Rate Type for the MX Section. Defaults to 'FLT'.

  ## Notes
  - Existing rows will default to 'FLT' matching previous behaviour.
  - No destructive changes. Existing data is preserved.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'us_rate_type'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN us_rate_type text DEFAULT 'FLT';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'mx_rate_type'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN mx_rate_type text DEFAULT 'FLT';
  END IF;
END $$;
