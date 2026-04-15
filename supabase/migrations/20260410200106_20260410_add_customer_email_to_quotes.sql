/*
  # Add customer_email column to quotes

  1. Modified Tables
    - `quotes`
      - `customer_email` (text, nullable) - stores the email address entered in the Send to Customer modal

  2. Notes
    - This allows the Edge Function to look up the customer email from the quote record directly
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'customer_email'
  ) THEN
    ALTER TABLE quotes ADD COLUMN customer_email text;
  END IF;
END $$;
