/*
  # Add quote name sequence tracking

  1. New Columns
    - `quote_name_sequence` (integer) - Auto-incrementing sequence for quote names (3 digits: 001, 002, etc.)
    - `quote_name_version` (integer) - Version number for cloned quotes (2 digits: 01, 02, etc.)
  
  2. Purpose
    - Tracks the incrementing 3-digit sequence in quote names (e.g., "APSGCRMS00036031626-001XX")
    - Tracks the 2-digit version for clones (e.g., "APSGCRMS00036031626-XXXXX01")
  
  3. Behavior
    - New quotes get next sequence number and version 01
    - Cloned quotes get same sequence number but next version number
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'quote_name_sequence'
  ) THEN
    ALTER TABLE quotes ADD COLUMN quote_name_sequence INTEGER DEFAULT 1;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'quote_name_version'
  ) THEN
    ALTER TABLE quotes ADD COLUMN quote_name_version INTEGER DEFAULT 1;
  END IF;
END $$;
