/*
  # Add Fuel Program calculation fields to quote_lanes and fuel_program_method to accounts

  1. Modified Tables
    - `quote_lanes`
      - `estimated_total_us_section` (numeric, default 0) - User-entered estimated total for US section (Method B)
      - `estimated_total_mx_section` (numeric, default 0) - User-entered estimated total for MX section (Method B)
      - `us_fuel_difference` (numeric, default 0) - Calculated fuel difference for US section
      - `mx_fuel_difference` (numeric, default 0) - Calculated fuel difference for MX section
    - `accounts`
      - `fuel_program_method` (text, default 'per_mile') - Fuel program calculation method: 'per_mile' (Method A) or 'percentage' (Method B)

  2. Important Notes
    - estimated_total fields are only used when fuel_program_method = 'percentage' (Method B)
    - fuel_difference fields store the calculated difference between account fuel rate and today's fuel rate
    - fuel_program_method determines whether Method A (Cost Per Mile) or Method B (Percentage) is used
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'estimated_total_us_section'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN estimated_total_us_section numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'estimated_total_mx_section'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN estimated_total_mx_section numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'us_fuel_difference'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN us_fuel_difference numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'mx_fuel_difference'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN mx_fuel_difference numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'fuel_program_method'
  ) THEN
    ALTER TABLE accounts ADD COLUMN fuel_program_method text DEFAULT 'per_mile';
  END IF;
END $$;