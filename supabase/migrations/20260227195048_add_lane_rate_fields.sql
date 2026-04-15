/*
  # Add Lane Rate and Type Fields
  
  ## Overview
  This migration adds new fields to the quote_lanes table to support detailed rate calculations
  and lane type categorization.
  
  ## Modified Tables
  
  ### quote_lanes table additions
  - `rate_type` (text, default 'FLT') - Rate calculation type: 'FLT' (Flat Rate) or 'RPM' (Rate Per Mile)
  - `lane_type` (text, nullable) - Type of lane: 'Standard', 'Express', or 'Dedicated'
  - `mx_rate_per_mile` (numeric, default 0) - Mexico rate per mile calculation
  
  ## Notes
  - These fields support the Detail View requirements for comprehensive lane pricing
  - Rate types help distinguish between flat rate and per-mile pricing models
  - Lane types allow categorization for different service levels
*/

-- Add rate_type column to quote_lanes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'rate_type'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN rate_type text DEFAULT 'FLT';
  END IF;
END $$;

-- Add lane_type column to quote_lanes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'lane_type'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN lane_type text DEFAULT NULL;
  END IF;
END $$;

-- Add mx_rate_per_mile column to quote_lanes if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'mx_rate_per_mile'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN mx_rate_per_mile numeric DEFAULT 0;
  END IF;
END $$;