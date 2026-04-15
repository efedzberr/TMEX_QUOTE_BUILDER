/*
  # Add Quote Link Expiration Days to Global Variables

  1. Modified Tables
    - `global_variables`
      - `quote_link_expiration_days` (integer, default 30) - configurable default for how many days a customer portal link remains valid

  2. Notes
    - Used by the Send to Customer modal to pre-fill the expiration days field
    - Admins can change this default in Administration > Global Variables
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'global_variables' AND column_name = 'quote_link_expiration_days'
  ) THEN
    ALTER TABLE global_variables ADD COLUMN quote_link_expiration_days integer DEFAULT 30 NOT NULL;
  END IF;
END $$;
