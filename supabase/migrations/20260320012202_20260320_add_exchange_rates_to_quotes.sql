/*
  # Add exchange rate fields to quotes table

  ## Changes
  - Adds `exchange_rate` (numeric) to `quotes` — USD to MXN conversion rate (e.g., 17.5543)
  - Adds `cad_exchange_rate` (numeric) to `quotes` — USD to CAD conversion rate (e.g., 1.36)

  ## Notes
  - Both default to 0 (unset). A value of 0 means the rate has not been configured.
  - Used by the currency conversion logic on lanes when the user changes a lane's currency.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'exchange_rate'
  ) THEN
    ALTER TABLE quotes ADD COLUMN exchange_rate numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'cad_exchange_rate'
  ) THEN
    ALTER TABLE quotes ADD COLUMN cad_exchange_rate numeric DEFAULT 0;
  END IF;
END $$;
