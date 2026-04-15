/*
  # Add Bill To and Shippers Admin Tables

  ## New Tables

  ### bill_to
  - id (uuid, primary key)
  - bill_to_name (text, not null) - the display name for the Bill To entity
  - account_code (text, not null) - unique code starting with S or M + 5 digits
  - type (text) - "Direct Customer" or "Transportation Company"
  - status (text) - "Active" or "Inactive"
  - created_at / updated_at timestamps

  ### shippers
  - id (uuid, primary key)
  - shipper_name (text, not null) - the display name for the Shipper
  - account_code (text, not null) - unique code starting with S or M + 5 digits
  - type (text) - "Direct Customer" or "Transportation Company"
  - status (text) - "Active" or "Inactive"
  - created_at / updated_at timestamps

  ## Security
  - RLS enabled on both tables
  - Public SELECT allowed (same as accounts table pattern)
  - Authenticated users can INSERT, UPDATE, DELETE
*/

CREATE TABLE IF NOT EXISTS bill_to (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_to_name text NOT NULL,
  account_code text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'Direct Customer',
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bill_to ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read bill_to"
  ON bill_to FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert bill_to"
  ON bill_to FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update bill_to"
  ON bill_to FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete bill_to"
  ON bill_to FOR DELETE
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS shippers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipper_name text NOT NULL,
  account_code text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'Direct Customer',
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shippers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read shippers"
  ON shippers FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can insert shippers"
  ON shippers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update shippers"
  ON shippers FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete shippers"
  ON shippers FOR DELETE
  TO authenticated
  USING (true);
