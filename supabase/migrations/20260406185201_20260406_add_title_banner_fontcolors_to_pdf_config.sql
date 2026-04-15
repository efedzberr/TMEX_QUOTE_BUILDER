/*
  # Add Title Bar, Banner, and Font Color configurations to PDF

  1. Modified Tables
    - `pdf_configurations`
      - `title_config` (jsonb) - Title bar configuration with three zones (left/center/right), each containing up to 3 elements (image/text/field), plus styling options
      - `banner_config` (jsonb) - Banner bar configuration with 6 cells, styling, and show/hide toggle
      - `full_view_font_colors` (jsonb) - Per-section font color overrides for full view section headers (general/us/mx/additional)

  2. Important Notes
    - All three columns default to NULL (the application provides in-memory defaults)
    - No security changes needed (existing RLS policies cover these columns)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pdf_configurations' AND column_name = 'title_config'
  ) THEN
    ALTER TABLE pdf_configurations ADD COLUMN title_config jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pdf_configurations' AND column_name = 'banner_config'
  ) THEN
    ALTER TABLE pdf_configurations ADD COLUMN banner_config jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pdf_configurations' AND column_name = 'full_view_font_colors'
  ) THEN
    ALTER TABLE pdf_configurations ADD COLUMN full_view_font_colors jsonb;
  END IF;
END $$;
