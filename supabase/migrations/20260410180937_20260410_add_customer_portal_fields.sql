/*
  # Add Customer Portal Fields to Quotes

  1. New Columns on `quotes`
    - `review_token` (text, unique, nullable) - Cryptographically random 32-char hex token
    - `token_generated_at` (timestamptz, nullable) - When the token was generated
    - `token_expires_at` (timestamptz, nullable) - When the token expires
    - `customer_review_status` (text, nullable) - Overall customer response status
    - `customer_responded_at` (timestamptz, nullable) - When customer submitted response
    - `customer_name` (text, nullable) - Customer contact name
    - `customer_title` (text, nullable) - Customer contact title
    - `customer_signature_font` (text, nullable) - Font for typed signature
    - `customer_signature_data` (text, nullable) - Base64 encoded signature image
    - `lane_acceptance` (jsonb, nullable) - Per-lane-group response data
    - `negotiation_quote_id` (text, nullable) - ID of cloned quote for negotiation

  2. Security
    - RLS policies for anon portal access via review_token
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'review_token'
  ) THEN
    ALTER TABLE quotes ADD COLUMN review_token text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'token_generated_at'
  ) THEN
    ALTER TABLE quotes ADD COLUMN token_generated_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'token_expires_at'
  ) THEN
    ALTER TABLE quotes ADD COLUMN token_expires_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'customer_review_status'
  ) THEN
    ALTER TABLE quotes ADD COLUMN customer_review_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'customer_responded_at'
  ) THEN
    ALTER TABLE quotes ADD COLUMN customer_responded_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE quotes ADD COLUMN customer_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'customer_title'
  ) THEN
    ALTER TABLE quotes ADD COLUMN customer_title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'customer_signature_font'
  ) THEN
    ALTER TABLE quotes ADD COLUMN customer_signature_font text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'customer_signature_data'
  ) THEN
    ALTER TABLE quotes ADD COLUMN customer_signature_data text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'lane_acceptance'
  ) THEN
    ALTER TABLE quotes ADD COLUMN lane_acceptance jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'negotiation_quote_id'
  ) THEN
    ALTER TABLE quotes ADD COLUMN negotiation_quote_id text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anon can read quotes by review_token'
  ) THEN
    CREATE POLICY "Anon can read quotes by review_token"
      ON quotes
      FOR SELECT
      TO anon
      USING (review_token IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Anon can update customer response by review_token'
  ) THEN
    CREATE POLICY "Anon can update customer response by review_token"
      ON quotes
      FOR UPDATE
      TO anon
      USING (review_token IS NOT NULL AND token_expires_at > now())
      WITH CHECK (review_token IS NOT NULL AND token_expires_at > now());
  END IF;
END $$;
