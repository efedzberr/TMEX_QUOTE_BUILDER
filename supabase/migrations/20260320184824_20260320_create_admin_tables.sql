/*
  # Create Administration Tables

  ## Summary
  Creates three new tables to support the Administration screen:

  1. New Tables
    - `accounts` — Stores customer/partner accounts
      - `id` (uuid, primary key)
      - `account_name` (text, required)
      - `account_code` (text, required)
      - `type` (text, e.g. Partner, Customer, Shipper)
      - `status` (text, e.g. Active, Inactive)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `global_variables` — Stores system-wide configuration values (single-row table)
      - `id` (uuid, primary key)
      - `fuel_rate_usd` (numeric) — Fuel Rate in USD per Gallon
      - `mxn_exchange_rate` (numeric) — 1 USD = X MXN
      - `cad_exchange_rate` (numeric) — 1 USD = X CAD
      - `us_fuel_difference` (numeric) — US Fuel Difference in USD
      - `updated_at` (timestamptz)

    - `border_crossing_cities` — Stores border crossing city entries
      - `id` (uuid, primary key)
      - `city_name` (text, required)
      - `country_side` (text, US or MX)
      - `state` (text)
      - `active` (boolean, default true)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Public read/write policies for application use (no auth in this app)

  3. Seed Data
    - One default row in global_variables
*/

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name text NOT NULL DEFAULT '',
  account_code text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'Customer',
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read accounts"
  ON accounts FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can insert accounts"
  ON accounts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can update accounts"
  ON accounts FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete accounts"
  ON accounts FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS global_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_rate_usd numeric NOT NULL DEFAULT 0,
  mxn_exchange_rate numeric NOT NULL DEFAULT 0,
  cad_exchange_rate numeric NOT NULL DEFAULT 0,
  us_fuel_difference numeric NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE global_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read global_variables"
  ON global_variables FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can insert global_variables"
  ON global_variables FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can update global_variables"
  ON global_variables FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO global_variables (fuel_rate_usd, mxn_exchange_rate, cad_exchange_rate, us_fuel_difference)
SELECT 3.50, 17.50, 1.35, 0.10
WHERE NOT EXISTS (SELECT 1 FROM global_variables);

CREATE TABLE IF NOT EXISTS border_crossing_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name text NOT NULL DEFAULT '',
  country_side text NOT NULL DEFAULT 'US',
  state text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE border_crossing_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read border_crossing_cities"
  ON border_crossing_cities FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can insert border_crossing_cities"
  ON border_crossing_cities FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Public can update border_crossing_cities"
  ON border_crossing_cities FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete border_crossing_cities"
  ON border_crossing_cities FOR DELETE
  TO anon, authenticated
  USING (true);
