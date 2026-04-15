/*
  # Add lane-level section accessorials

  1. Modified Tables
    - `quote_lanes`
      - `us_accessorials_list` (jsonb) - stores selected US accessorials with rates
      - `us_accessorials_amount` (numeric) - total US accessorials amount
      - `mx_accessorials_list` (jsonb) - stores selected MX accessorials with rates  
      - `mx_accessorials_amount` (numeric) - total MX accessorials amount

  2. Notes
    - These fields support lane-level accessorial selection per US/MX section
    - Separate from existing quote-level accessorials_list/accessorials_amount
    - Default values ensure backward compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'us_accessorials_list'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN us_accessorials_list jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'us_accessorials_amount'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN us_accessorials_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'mx_accessorials_list'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN mx_accessorials_list jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'mx_accessorials_amount'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN mx_accessorials_amount numeric DEFAULT 0;
  END IF;
END $$;
