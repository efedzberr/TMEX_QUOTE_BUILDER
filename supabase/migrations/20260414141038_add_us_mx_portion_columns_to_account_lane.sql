/*
  # Add US/MX Portion Columns to Account Lane

  1. Modified Tables
    - `Account Lane`
      - Added US portion fields: US Miles, US Rate Per Mile, US Rate, US Fuel,
        US Fuel Rate Per Mile, Total US Fixed Costs, Total US Variable Costs, Total US Portion
      - Added MX portion fields: MX Miles, MX Rate Per Mile, MX Rate, MX Fuel,
        MX Fuel Rate Per Mile, Total MX Fixed Costs, Total MX Variable Costs, Total MX Portion
      - Added other fields: Border Crossing Rate, Otros, Team, Total, VOL LPM,
        Transit Time, Comments, Stop 1, Stop Off, Border Crossing Point

  2. Important Notes
    - All new columns are nullable to preserve existing data
    - No existing data is modified
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'US Miles') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "US Miles" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'US Rate Per Mile') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "US Rate Per Mile" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'US Rate') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "US Rate" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'US Fuel') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "US Fuel" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'US Fuel Rate Per Mile') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "US Fuel Rate Per Mile" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'Total US Fixed Costs') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "Total US Fixed Costs" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'Total US Variable Costs') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "Total US Variable Costs" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'Total US Portion') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "Total US Portion" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'MX Miles') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "MX Miles" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'MX Rate Per Mile') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "MX Rate Per Mile" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'MX Rate') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "MX Rate" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'MX Fuel') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "MX Fuel" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'MX Fuel Rate Per Mile') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "MX Fuel Rate Per Mile" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'Total MX Fixed Costs') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "Total MX Fixed Costs" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'Total MX Variable Costs') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "Total MX Variable Costs" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'Total MX Portion') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "Total MX Portion" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'Border Crossing Rate') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "Border Crossing Rate" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'Otros') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "Otros" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'Team') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "Team" text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'Total') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "Total" double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'VOL LPM') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "VOL LPM" text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'Transit Time') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "Transit Time" text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'Comments') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "Comments" text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'Stop 1') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "Stop 1" text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'Stop Off') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "Stop Off" text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Account Lane' AND column_name = 'Border Crossing Point') THEN
    ALTER TABLE "Account Lane" ADD COLUMN "Border Crossing Point" text;
  END IF;
END $$;
