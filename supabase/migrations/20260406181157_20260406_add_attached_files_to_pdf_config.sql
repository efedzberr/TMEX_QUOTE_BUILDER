/*
  # Add attached_files column to pdf_configurations

  1. Modified Tables
    - `pdf_configurations`
      - `attached_files` (jsonb, default '[]') - stores base64-encoded PDF files to append to generated documents

  2. Notes
    - Files are stored as base64 strings with name, size, data, and order fields
    - Default empty array ensures backward compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pdf_configurations' AND column_name = 'attached_files'
  ) THEN
    ALTER TABLE pdf_configurations ADD COLUMN attached_files jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
