/*
  # Add Lane Detail Modal Fields

  1. New Columns for quote_lanes table
    - `currency_code` (text) - Stores the selected currency: USD, MXN, CAD
    - `units_code` (text) - Stores the selected unit type: Mi, Km
    - `border_crossing_only` (boolean) - Whether this is a border crossing only lane
    - `us_fuel_included_in_line_haul` (boolean) - Whether US fuel is included in line haul rate
    - `mx_fuel_included_in_line_haul` (boolean) - Whether MX fuel is included in line haul rate

  2. Notes
    - All columns have sensible defaults
    - No destructive operations
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'currency_code'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN currency_code text DEFAULT 'USD';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'units_code'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN units_code text DEFAULT 'Mi';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'border_crossing_only'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN border_crossing_only boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'us_fuel_included_in_line_haul'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN us_fuel_included_in_line_haul boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'mx_fuel_included_in_line_haul'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN mx_fuel_included_in_line_haul boolean DEFAULT false;
  END IF;
END $$;
