/*
  # Add Paired Lanes and Equipment-Specific Fields

  ## Overview
  This migration adds support for Round Trip and Circuit lane pairing, mandatory field validation,
  and equipment-type-specific fields for comprehensive lane management.

  ## Modified Tables

  ### quote_lanes table additions
  - `paired_lane_id` (uuid, nullable) - References the paired lane for Round Trip/Circuit
  - `is_primary_lane` (boolean, default true) - Indicates if this is the primary lane in a pair
  - `priority` (text, nullable) - Lane priority level
  - `type_of_service` (text, nullable) - Service type (matches Equipment Type)
  - `target` (text, nullable) - Target information
  - `product` (text, nullable) - Product information
  - `msds` (text, nullable) - MSDS information for Dry Van/Hazmat
  - `weight` (numeric, nullable) - Weight for Flatbed/SD
  - `dimensions` (text, nullable) - Dimensions for Flatbed/SD/AH
  - `invoice_value` (numeric, nullable) - Invoice value for Flatbed/SD
  - `tarps` (text, nullable) - Tarps information for Flatbed/SD
  - `temperature` (text, nullable) - Temperature for Reefer
  - `packaging` (text, nullable) - Packaging for Reefer
  - `vin_dimensions` (text, nullable) - VIN dimensions for AH
  - `number_of_vins` (integer, nullable) - Number of VINs for AH
  - `live_load_or_drop` (text, nullable) - Live load or drop for IML
  - `border_crossing_rate` (numeric, default 0) - Border crossing rate

  ## Notes
  - Paired lanes enable Round Trip and Circuit functionality
  - Equipment-specific fields are conditionally displayed based on equipment type
  - Mandatory fields (origin_city, destination_city, border) are enforced at application level
*/

-- Add paired lane support fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'paired_lane_id'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN paired_lane_id uuid REFERENCES quote_lanes(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'is_primary_lane'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN is_primary_lane boolean DEFAULT true;
  END IF;
END $$;

-- Add additional information fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'priority'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN priority text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'type_of_service'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN type_of_service text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'target'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN target text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'product'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN product text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'border_crossing_rate'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN border_crossing_rate numeric DEFAULT 0;
  END IF;
END $$;

-- Add equipment-specific fields for Dry Van/Hazmat
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'msds'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN msds text;
  END IF;
END $$;

-- Add equipment-specific fields for Flatbed/SD
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'weight'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN weight numeric;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'dimensions'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN dimensions text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'invoice_value'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN invoice_value numeric;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'tarps'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN tarps text;
  END IF;
END $$;

-- Add equipment-specific fields for Reefer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'temperature'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN temperature text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'packaging'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN packaging text;
  END IF;
END $$;

-- Add equipment-specific fields for AH (Auto Hauler)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'vin_dimensions'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN vin_dimensions text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'number_of_vins'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN number_of_vins integer;
  END IF;
END $$;

-- Add equipment-specific fields for IML (Intermodal)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'live_load_or_drop'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN live_load_or_drop text;
  END IF;
END $$;