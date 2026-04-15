/*
  # Add fuel and rate fields to quotes table

  ## Changes
  - Add us_fuel_difference column to quotes (stores the US fuel difference from global variables)
  - Add today_fuel_rate column to quotes (stores the today's fuel rate from global variables)

  These fields are auto-populated from Global Variables when a new quote is created,
  and the user can override them on the quote.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'us_fuel_difference'
  ) THEN
    ALTER TABLE quotes ADD COLUMN us_fuel_difference numeric(10, 4) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'today_fuel_rate'
  ) THEN
    ALTER TABLE quotes ADD COLUMN today_fuel_rate numeric(10, 4) DEFAULT 0;
  END IF;
END $$;
