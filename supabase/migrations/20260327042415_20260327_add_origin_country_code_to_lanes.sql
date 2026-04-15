/*
  # Add origin_country_code to quote_lanes

  ## Summary
  Adds an optional text column `origin_country_code` to the `quote_lanes` table.
  This field stores the ISO country code (e.g. 'US', 'MX') of the lane's origin city,
  which is needed to determine which sections (US/MX) are editable for Loop service type lanes.

  ## Changes
  - `quote_lanes`: added `origin_country_code` (text, nullable)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'origin_country_code'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN origin_country_code text;
  END IF;
END $$;
