/*
  # Add Service Type to Quote Lanes
  
  Adds service_type column to track whether each lane is:
  - Loop: Origin/destination involves only up to the border
  - Door to Door: Full cross-border route
  - Domestic: US only, no border crossing
  
  New column:
  - `service_type` (text) - Stores 'Loop', 'Door to Door', or 'Domestic'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'service_type'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN service_type text DEFAULT 'Door to Door';
  END IF;
END $$;
