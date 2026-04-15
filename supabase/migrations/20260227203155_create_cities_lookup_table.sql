/*
  # Create Cities Lookup Table
  
  ## Overview
  This migration creates a cities lookup table to support autocomplete functionality
  for origin and destination city fields in the quote lanes.
  
  ## New Tables
  
  ### cities table
  - `id` (uuid, primary key) - Unique identifier for each city
  - `city_name` (text, not null) - Display name of the city
  - `city_code` (text, unique) - Short code for the city
  - `city_full_name` (text) - Full name including state/province
  - `state_code` (text) - State or province code
  - `country_code` (text) - Country code (USA or MEX)
  - `market_name` (text) - Market name for grouping
  - `market_code` (text) - Market code
  - `created_at` (timestamptz) - Timestamp when record was created
  
  ## Indexes
  - Index on city_name for fast lookups
  - Index on city_code for unique lookups
  - Index on country_code for filtering
  
  ## Security
  - Enable RLS on cities table
  - Add policy for authenticated users to read city data
*/

-- Create cities lookup table
CREATE TABLE IF NOT EXISTS cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name text NOT NULL,
  city_code text UNIQUE,
  city_full_name text,
  state_code text,
  country_code text,
  market_name text,
  market_code text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_cities_city_name ON cities(city_name);
CREATE INDEX IF NOT EXISTS idx_cities_country_code ON cities(country_code);
CREATE INDEX IF NOT EXISTS idx_cities_market_code ON cities(market_code);

-- Enable RLS
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

-- Create policy for reading cities (all authenticated users can read)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cities' AND policyname = 'Anyone can read cities'
  ) THEN
    CREATE POLICY "Anyone can read cities"
      ON cities
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;