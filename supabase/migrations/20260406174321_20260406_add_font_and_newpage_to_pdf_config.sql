/*
  # Add font settings and new page flags to PDF configurations

  1. Modified Tables
    - `pdf_configurations`
      - `font_family` (text) - Font family for the PDF (Helvetica, Times-Roman, Courier)
      - `font_size` (text) - Font size preset (small, medium, large)
    
  2. Notes
    - footer_sections is already a JSONB column that stores newPage per section
    - full_view_colors is already a JSONB column that will now support hex color strings
    - No data migration needed - defaults handled in application code
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pdf_configurations' AND column_name = 'font_family'
  ) THEN
    ALTER TABLE pdf_configurations ADD COLUMN font_family text DEFAULT 'Helvetica';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pdf_configurations' AND column_name = 'font_size'
  ) THEN
    ALTER TABLE pdf_configurations ADD COLUMN font_size text DEFAULT 'medium';
  END IF;
END $$;
