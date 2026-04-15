/*
  # Add stops_before and stops_after to quote_lanes

  ## Summary
  Adds two JSONB columns to quote_lanes to store intermediate stops:

  1. New Columns
    - `stops_before` (jsonb, default []): Array of city strings representing stops
      before the border crossing (originating from Origin City side)
    - `stops_after` (jsonb, default []): Array of city strings representing stops
      after the border crossing (on the Destination City side)

  ## Notes
  - Both columns default to an empty array
  - Stored as JSONB for flexible array handling
  - No RLS changes needed; these columns inherit existing lane policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'stops_before'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN stops_before jsonb DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quote_lanes' AND column_name = 'stops_after'
  ) THEN
    ALTER TABLE quote_lanes ADD COLUMN stops_after jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
