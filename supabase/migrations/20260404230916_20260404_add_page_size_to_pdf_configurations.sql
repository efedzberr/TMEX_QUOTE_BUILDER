/*
  # Add page_size column to pdf_configurations

  1. Modified Tables
    - `pdf_configurations`
      - Added `page_size` (text, default 'letter') - supports 'letter', 'a4', 'legal'

  2. Notes
    - New column allows users to select page size for PDF output
    - Default is 'letter' (8.5" x 11")
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pdf_configurations' AND column_name = 'page_size'
  ) THEN
    ALTER TABLE pdf_configurations ADD COLUMN page_size text NOT NULL DEFAULT 'letter';
  END IF;
END $$;
