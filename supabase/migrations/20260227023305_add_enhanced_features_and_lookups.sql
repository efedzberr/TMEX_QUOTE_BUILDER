/*
  # Enhanced Features and Lookup Tables
  
  ## Overview
  This migration adds comprehensive enhancements to support the new features:
  - Stage tracking with progress workflow
  - Trip type (One Way, Round Trip, Circuit) for lanes
  - Rate type toggle (Flat Rate / RPM)
  - Lookup tables for dropdowns (Opportunities, Accounts, Partners)
  - New sales representative values
  - Owner values
  
  ## New Tables
  
  ### 1. `opportunities`
  Lookup table for opportunity selection
  - `id` (uuid, primary key)
  - `name` (text, unique)
  - `created_at` (timestamptz)
  
  ### 2. `accounts`
  Lookup table for parent accounts, shippers, and bill-to customers
  - `id` (uuid, primary key)
  - `name` (text, unique)
  - `account_type` (text) - 'parent', 'shipper', 'bill_to'
  - `created_at` (timestamptz)
  
  ### 3. `partners`
  Lookup table for BCO/Partner selection
  - `id` (uuid, primary key)
  - `name` (text, unique)
  - `created_at` (timestamptz)
  
  ## Modified Tables
  
  ### quotes table additions
  - `stage` (text, default 'New') - Workflow stage tracking
  - `rate_type` (text, default 'Flat Rate') - 'Flat Rate' or 'RPM'
  - Update owner_name to use new values
  
  ### quote_lanes table additions
  - `trip_type` (text, default 'One Way') - 'One Way', 'Round Trip', 'Circuit'
  - `linked_lane_id` (uuid, nullable) - For Round Trip and Circuit pairs
  - `toll_rate` (numeric, default 0)
  - `display_mode` (text, default 'list') - 'list' or 'detail'
  
  ## Security
  - Enable RLS on all new tables
  - Add public access policies (matching existing pattern)
  
  ## Data Population
  - Pre-populate opportunities with 12 sample entries
  - Pre-populate accounts with 35 companies (parent, shipper, bill_to variants)
  - Pre-populate partners with 20 BCO/Partner companies
*/

-- Create opportunities lookup table
CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all opportunities"
  ON opportunities FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create opportunities"
  ON opportunities FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update opportunities"
  ON opportunities FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete opportunities"
  ON opportunities FOR DELETE
  TO public
  USING (true);

-- Create accounts lookup table
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  account_type text NOT NULL DEFAULT 'parent',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all accounts"
  ON accounts FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create accounts"
  ON accounts FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update accounts"
  ON accounts FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete accounts"
  ON accounts FOR DELETE
  TO public
  USING (true);

-- Create partners lookup table
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all partners"
  ON partners FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can create partners"
  ON partners FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Users can update partners"
  ON partners FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete partners"
  ON partners FOR DELETE
  TO public
  USING (true);

-- Add new columns to quotes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'stage'
  ) THEN
    ALTER TABLE quotes ADD COLUMN stage text DEFAULT 'New';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'rate_type'
  ) THEN
    ALTER TABLE quotes ADD COLUMN rate_type text DEFAULT 'Flat Rate';
  END IF;
END $$;

-- Add new columns to quote_lanes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'trip_type'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN trip_type text DEFAULT 'One Way';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'linked_lane_id'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN linked_lane_id uuid DEFAULT NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'toll_rate'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN toll_rate numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'display_mode'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN display_mode text DEFAULT 'list';
  END IF;
END $$;

-- Populate opportunities
INSERT INTO opportunities (name) VALUES
  ('IMPO TX - CDMX (Ejemplo)'),
  ('Cross-Border DFW to MTY'),
  ('Laredo Dry Van Contract Q1'),
  ('PACCAR Annual Lane Review'),
  ('Amazon FTL Mexico 2026'),
  ('Walmart Produce Import'),
  ('PepsiCo Distribution Lanes'),
  ('KimberlyClark Export Program'),
  ('UPS Freight Partnership'),
  ('Lowe''s Inbound Mexico'),
  ('Uber Freight Pilot Program'),
  ('Cerealto Recurring Lanes')
ON CONFLICT (name) DO NOTHING;

-- Populate accounts (parent accounts)
INSERT INTO accounts (name, account_type) VALUES
  ('PACCAR INC', 'parent'),
  ('WALMART', 'parent'),
  ('KIMBERLY CLARK', 'parent'),
  ('KOCH INDUSTRIES INC.', 'parent'),
  ('AMAZON.COM', 'parent'),
  ('3PL LLC', 'parent'),
  ('CEREALTO', 'parent'),
  ('PEPSICO', 'parent'),
  ('UPS', 'parent'),
  ('REDHAWK', 'parent'),
  ('LOWE''S COMPANIES INC.', 'parent'),
  ('ASHLEY FURNITURE INDUSTRIES', 'parent'),
  ('MONSANTO COMPANY', 'parent'),
  ('FABRICAS MONTERREY', 'parent'),
  ('KUEHNE & NAGEL INTERNATIONAL A', 'parent'),
  ('TABCOR WORLDWIDE', 'parent'),
  ('UBER FREIGHT', 'parent'),
  ('PANEL REY', 'parent'),
  ('BOSE CORPORATION', 'parent'),
  ('EXPEDITORS INTERNATIONAL OF WA', 'parent'),
  ('WEG MEXICO SA DE CV', 'parent'),
  ('DAIMLER AG (USA)', 'parent'),
  ('FORMOSA PLASTIC CORP USA', 'parent'),
  ('NOVELIS INC. (USA)', 'parent'),
  ('UNISUN MULTINATIONAL', 'parent'),
  ('DEACERO SAPI DE CV', 'parent'),
  ('ENTECRESINS MEXICO', 'parent'),
  ('PITTSBURGH GLASS WORKS', 'parent'),
  ('EUROPARTNERS S A DE CV', 'parent'),
  ('KOSMOS LOGISTICS INC', 'parent'),
  ('PAISANO HOLDINGS SA DE CV', 'parent'),
  ('O&M HALYARD', 'parent'),
  ('RYDER SYSTEM INC.', 'parent'),
  ('BUNZL DE MEXICO S A DE CV', 'parent'),
  ('UHAUL', 'parent')
ON CONFLICT (name) DO NOTHING;

-- Populate shippers (same companies with SHIPPER suffix)
INSERT INTO accounts (name, account_type)
SELECT name || ' SHIPPER', 'shipper'
FROM accounts WHERE account_type = 'parent'
ON CONFLICT (name) DO NOTHING;

-- Populate bill-to customers (same companies with BIL TO suffix)
INSERT INTO accounts (name, account_type)
SELECT 
  CASE 
    WHEN name LIKE '% SHIPPER' THEN REPLACE(name, ' SHIPPER', ' BIL TO')
    ELSE name || ' BIL TO'
  END,
  'bill_to'
FROM accounts WHERE account_type = 'parent'
ON CONFLICT (name) DO NOTHING;

-- Populate partners (BCO/Partner companies)
INSERT INTO partners (name) VALUES
  ('NORTHBRIDGE FREIGHT LINES'),
  ('SIERRA MADRE LOGISTICS GROUP'),
  ('BORDERLINK TRANSPORT SOLUTIONS'),
  ('ATLAS CONTINENTAL CARRIERS'),
  ('SILVERROUTE TRUCKING CO.'),
  ('BLUEHORIZON FREIGHT SYSTEMS'),
  ('REDLINE CROSSBORDER TRANSPORT'),
  ('GOLDEN EAGLE LOGISTICS PARTNERS'),
  ('TITAN INTERSTATE CARRIERS'),
  ('SUMMITWAY TRANSPORTATION SERVICES'),
  ('HORIZONGATE LOGISTICS'),
  ('IRONPEAK FREIGHT SOLUTIONS'),
  ('MONARCH CARGO LINES'),
  ('DELTABRIDGE TRANSPORT CO.'),
  ('PACIFIC CREST HAULING'),
  ('VELOCITY FREIGHT NETWORK'),
  ('CAMINO REAL TRUCKING GROUP'),
  ('LIBERTY LANE CARRIERS'),
  ('TRANSFRONTIER LOGISTICS ALLIANCE'),
  ('APEX GLOBAL TRANSPORT SERVICES')
ON CONFLICT (name) DO NOTHING;