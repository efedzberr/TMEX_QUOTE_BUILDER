/*
  # Add Lane Details and Date Columns

  ## Overview
  Extends the quote_lanes table with additional detail fields and effective date ranges
  to support comprehensive lane management with equipment-specific configurations.

  ## Changes to `quote_lanes` table
  
  ### New Date Columns
  - `effective_from_date` (date) - Start date for lane pricing validity
  - `effective_to_date` (date) - End date for lane pricing validity
  
  ### New Detail Columns
  - `additional_accessories` (text) - Additional equipment/accessories
  - `comments` (text) - General comments and notes
  - `commitment_type` (text) - Type of commitment
  - `frequency` (text) - Shipping frequency
  - `fuel_rate_type` (text) - Type of fuel rate calculation
  - `load_frequency` (text) - Load frequency details
  - `load_volume` (text) - Volume of loads
  - `mx_fuel_rate` (decimal) - Mexico fuel rate
  - `mx_miles` (decimal) - Mexico miles distance
  - `requested_discount_percent` (decimal) - Requested discount percentage
  - `requested_price` (decimal) - Requested price amount
  - `un_number` (text) - UN hazmat identification number
  - `us_fuel_rate` (decimal) - US fuel rate
  - `us_miles` (decimal) - US miles distance
  - `us_rate_per_mile` (decimal) - US rate per mile
  - `volume` (text) - Overall volume
  - `msds` (boolean) - Material Safety Data Sheet required
  - `weight` (text) - Weight specification
  - `dimensions` (text) - Dimension specifications
  - `invoice_value` (decimal) - Invoice value
  - `temperature` (text) - Temperature specification for reefer
  - `temperature_unit` (text) - Temperature unit (F/C)
  - `packaging` (text) - Packaging type
  - `units_type` (text) - Current units (Miles/Kilometers)
  - `currency_type` (text) - Current currency (USD/MXN)

  ## Notes
  All new fields have default values to maintain compatibility with existing records
*/

-- Add date columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'effective_from_date'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN effective_from_date date DEFAULT '2026-02-01';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'effective_to_date'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN effective_to_date date DEFAULT '2026-12-31';
  END IF;
END $$;

-- Add additional detail columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'additional_accessories'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN additional_accessories text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'comments'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN comments text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'commitment_type'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN commitment_type text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'frequency'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN frequency text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'fuel_rate_type'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN fuel_rate_type text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'load_frequency'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN load_frequency text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'load_volume'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN load_volume text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'mx_fuel_rate'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN mx_fuel_rate decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'mx_miles'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN mx_miles decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'requested_discount_percent'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN requested_discount_percent decimal(5,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'requested_price'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN requested_price decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'un_number'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN un_number text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'us_fuel_rate'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN us_fuel_rate decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'us_miles'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN us_miles decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'us_rate_per_mile'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN us_rate_per_mile decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'volume'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN volume text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'msds'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN msds boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'weight'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN weight text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'dimensions'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN dimensions text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'invoice_value'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN invoice_value decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'temperature'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN temperature text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'temperature_unit'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN temperature_unit text DEFAULT 'F';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'packaging'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN packaging text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'units_type'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN units_type text DEFAULT 'Miles';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'currency_type'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN currency_type text DEFAULT 'USD';
  END IF;
END $$;