/*
  # Add destination_country_code column to quote_lanes

  1. Modified Tables
    - `quote_lanes`
      - Added `destination_country_code` (text, nullable) - stores the country code of the destination city for D2D Split Billing Lane 2

  2. Important Notes
    - This field is used by Door to Door Split Billing to determine which pricing section (US or MX) is active for Lane 2
    - For Lane 2, the active section is based on the destination country rather than origin country
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'destination_country_code'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN destination_country_code text;
  END IF;
END $$;