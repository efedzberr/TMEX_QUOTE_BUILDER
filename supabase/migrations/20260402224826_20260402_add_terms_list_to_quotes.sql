/*
  # Add terms & conditions list field to quotes

  1. Modified Tables
    - `quotes`
      - `terms_conditions_list` (jsonb) - JSON array of selected terms for the quote
      - `terms_tab_currency` (text) - Persisted currency toggle state for terms tab
      - `terms_tab_language` (text) - Persisted language toggle state for terms tab

  2. Notes
    - Stores selected terms as a JSONB array, mirroring the accessorials_list pattern
    - Currency and language preferences are persisted per quote
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'terms_conditions_list'
  ) THEN
    ALTER TABLE quotes ADD COLUMN terms_conditions_list jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'terms_tab_currency'
  ) THEN
    ALTER TABLE quotes ADD COLUMN terms_tab_currency text DEFAULT 'USD';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'terms_tab_language'
  ) THEN
    ALTER TABLE quotes ADD COLUMN terms_tab_language text DEFAULT 'EN';
  END IF;
END $$;
