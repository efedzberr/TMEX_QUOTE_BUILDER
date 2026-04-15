/*
  # Add Opportunity Type Field to Quotes

  1. New Column
    - `opportunity_type` (text) - Type of opportunity (BID, CONTRACT, STANDARD PUBLISH)
    - No default value - must be explicitly set by user
  
  2. Changes
    - Added to `quotes` table as a required field in edit mode
    - Field is editable only in Edit Quote mode
    - Becomes read-only in view mode

  3. Important Notes
    - Field is nullable in database but required in UI when editing
    - No default value to ensure user makes explicit selection
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'opportunity_type'
  ) THEN
    ALTER TABLE quotes ADD COLUMN opportunity_type text;
  END IF;
END $$;