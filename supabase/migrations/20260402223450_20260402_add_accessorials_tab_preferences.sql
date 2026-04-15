/*
  # Add Accessorials Tab Preferences

  1. Modified Tables
    - `quotes`
      - `accessorials_tab_currency` (text, default 'USD') - Persists the user's selected currency toggle on the Accessorials tab
      - `accessorials_tab_language` (text, default 'EN') - Persists the user's selected language toggle on the Accessorials tab

  2. Notes
    - These fields are local to the Accessorials tab and do not affect the global quote currency
    - Valid currency values: USD, MXN, CAD
    - Valid language values: EN, ES
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'accessorials_tab_currency'
  ) THEN
    ALTER TABLE quotes ADD COLUMN accessorials_tab_currency text DEFAULT 'USD';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'accessorials_tab_language'
  ) THEN
    ALTER TABLE quotes ADD COLUMN accessorials_tab_language text DEFAULT 'EN';
  END IF;
END $$;
