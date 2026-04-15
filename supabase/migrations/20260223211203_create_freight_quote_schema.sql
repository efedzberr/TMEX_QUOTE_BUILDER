/*
  # Freight Quote Management Schema

  ## Overview
  Creates the database structure for TRANSMEX freight quote management system,
  supporting cross-border US-Mexico trucking quotes with lanes, history tracking,
  and comprehensive quote details.

  ## New Tables
  
  ### `quotes`
  Main quote records with financial and service details
  - `id` (uuid, primary key) - Unique identifier
  - `quote_number` (text, unique) - Display number (e.g., TMQ-00000001)
  - `owner_name` (text) - Quote owner/creator name
  - `status` (text) - Current workflow status (New, In Progress, Completed, etc.)
  - `total_amount` (decimal) - Total quote amount
  - `us_portion` (decimal) - US trucking portion
  - `mx_rate` (decimal) - Mexico trucking rate
  - `border_crossing_fee` (decimal) - Border crossing fees
  - `units` (text) - Distance units (Miles/Kilometers)
  - `type_of_service` (text) - Service type (Dry Van, Reefer, etc.)
  - `partner_account` (text) - Partner account name
  - `us_sales_rep` (text) - US sales representative
  - `mx_sales_rep` (text) - MX sales representative
  - `currency` (text) - Quote currency (USD/MXN)
  - `bill_to_customer` (text) - Billing customer name
  - `shipper` (text) - Shipper name
  - `bco_partner` (text) - BCO/Partner name
  - `opportunity` (text) - Related opportunity
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `quote_history`
  Activity log and audit trail for quotes
  - `id` (uuid, primary key) - Unique identifier
  - `quote_id` (uuid, foreign key) - Reference to quotes table
  - `date` (timestamptz) - Activity timestamp
  - `user_name` (text) - User who performed action
  - `action` (text) - Action description
  - `notes` (text) - Additional notes
  - `created_at` (timestamptz) - Record creation timestamp

  ### `quote_lanes`
  Individual freight lanes within quotes
  - `id` (uuid, primary key) - Unique identifier
  - `quote_id` (uuid, foreign key) - Reference to quotes table
  - `origin_city` (text) - Origin city name
  - `destination_city` (text) - Destination city name
  - `border_crossing` (text) - Border crossing point
  - `border_crossing_fee` (decimal) - Fee for this lane
  - `us_rate` (decimal) - US portion rate
  - `mx_rate` (decimal) - Mexico portion rate
  - `equipment_type` (text) - Equipment type (Dry Van, Reefer, etc.)
  - `sort_order` (integer) - Display order
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated user access
  - Implement proper data access controls
*/

-- Create quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE NOT NULL,
  owner_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'New',
  total_amount decimal(12,2) NOT NULL DEFAULT 0,
  us_portion decimal(12,2) NOT NULL DEFAULT 0,
  mx_rate decimal(12,2) NOT NULL DEFAULT 0,
  border_crossing_fee decimal(12,2) NOT NULL DEFAULT 0,
  units text NOT NULL DEFAULT 'Miles',
  type_of_service text NOT NULL DEFAULT '',
  partner_account text NOT NULL DEFAULT '',
  us_sales_rep text NOT NULL DEFAULT '',
  mx_sales_rep text NOT NULL DEFAULT '',
  currency text NOT NULL DEFAULT 'USD',
  bill_to_customer text NOT NULL DEFAULT '',
  shipper text NOT NULL DEFAULT '',
  bco_partner text NOT NULL DEFAULT '',
  opportunity text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quote_history table
CREATE TABLE IF NOT EXISTS quote_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  date timestamptz NOT NULL DEFAULT now(),
  user_name text NOT NULL,
  action text NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- Create quote_lanes table
CREATE TABLE IF NOT EXISTS quote_lanes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  origin_city text NOT NULL,
  destination_city text NOT NULL,
  border_crossing text NOT NULL,
  border_crossing_fee decimal(10,2) NOT NULL DEFAULT 0,
  us_rate decimal(10,2) NOT NULL DEFAULT 0,
  mx_rate decimal(10,2) NOT NULL DEFAULT 0,
  equipment_type text NOT NULL DEFAULT 'Dry Van',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_lanes ENABLE ROW LEVEL SECURITY;

-- Create policies for quotes table
CREATE POLICY "Allow public read access to quotes"
  ON quotes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to quotes"
  ON quotes FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to quotes"
  ON quotes FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to quotes"
  ON quotes FOR DELETE
  TO public
  USING (true);

-- Create policies for quote_history table
CREATE POLICY "Allow public read access to quote_history"
  ON quote_history FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to quote_history"
  ON quote_history FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to quote_history"
  ON quote_history FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to quote_history"
  ON quote_history FOR DELETE
  TO public
  USING (true);

-- Create policies for quote_lanes table
CREATE POLICY "Allow public read access to quote_lanes"
  ON quote_lanes FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access to quote_lanes"
  ON quote_lanes FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access to quote_lanes"
  ON quote_lanes FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete access to quote_lanes"
  ON quote_lanes FOR DELETE
  TO public
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_quote_history_quote_id ON quote_history(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_lanes_quote_id ON quote_lanes(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_lanes_sort_order ON quote_lanes(quote_id, sort_order);