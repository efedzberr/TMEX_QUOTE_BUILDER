/*
  # Add Customer Fuel Program fields to accounts table

  1. Modified Tables
    - `accounts`
      - `customer_fuel_program` (boolean, default false) - Whether the account has a customer fuel program enabled
      - `fuel_program_type` (text, default 'FRPM') - Type of fuel program: 'FRPM' or 'PERCENT'
      - `fuel_rate_per_mile` (numeric, default 0) - The fuel rate per mile value for the customer fuel program

  2. Important Notes
    - These fields support the new Customer Fuel Program feature on the Manage Accounts tab
    - When customer_fuel_program is true, fuel_rate_per_mile becomes mandatory (enforced at the application level)
    - fuel_program_type determines how fuel_rate_per_mile is interpreted: as a currency amount (FRPM) or as a percentage (PERCENT)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'customer_fuel_program'
  ) THEN
    ALTER TABLE accounts ADD COLUMN customer_fuel_program boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'fuel_program_type'
  ) THEN
    ALTER TABLE accounts ADD COLUMN fuel_program_type text DEFAULT 'FRPM';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'fuel_rate_per_mile'
  ) THEN
    ALTER TABLE accounts ADD COLUMN fuel_rate_per_mile numeric DEFAULT 0;
  END IF;
END $$;