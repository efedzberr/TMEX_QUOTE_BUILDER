/*
  # Add is_border_crossing_city flag to cities table

  1. Changes
    - Add `is_border_crossing_city` boolean column to the `cities` table
    - Default is false (unchecked)
    - Add an index for fast lookups of border crossing cities

  2. Notes
    - The existing `border_crossing_cities` table remains untouched for historical data
    - The new flag allows any city in the `cities` table to be designated as a border crossing city
    - The lane grid and Additional Details modal will query cities WHERE is_border_crossing_city = true
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cities' AND column_name = 'is_border_crossing_city'
  ) THEN
    ALTER TABLE cities ADD COLUMN is_border_crossing_city boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cities_is_border_crossing_city ON cities (is_border_crossing_city) WHERE is_border_crossing_city = true;
