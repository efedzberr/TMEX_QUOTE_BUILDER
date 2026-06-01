/*
  # Add Rate Per Mile to Global Variables and Quotes

  1. Modified Tables
    - `global_variables`
      - `rate_per_mile` (numeric, default 0) - Default Rate Per Mile value applied to new quotes
    - `quotes`
      - `rate_per_mile` (numeric, default 0) - Rate Per Mile copied from global variables at quote creation

  2. Notes
    - Follows the same pattern as fuel_rate_usd / today_fuel_rate
    - Global Variables stores the master value; Quotes get a snapshot at creation time
    - Lane fields us_rate_per_mile and mx_rate_per_mile already exist in quote_lanes
*/

-- Add rate_per_mile to global_variables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_variables' AND column_name = 'rate_per_mile'
  ) THEN
    ALTER TABLE global_variables ADD COLUMN rate_per_mile numeric DEFAULT 0;
  END IF;
END $$;

-- Add rate_per_mile to quotes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'rate_per_mile'
  ) THEN
    ALTER TABLE quotes ADD COLUMN rate_per_mile numeric DEFAULT 0;
  END IF;
END $$;
