/*
# Add align column to kpi_tiles

1. Modified Tables
   - `kpi_tiles`
     - Added `align` (text, NOT NULL, default 'left') — per-tile text alignment.
       Constrained to 'left', 'center', or 'right'.

2. Notes
   - Idempotent: skips if the column already exists.
   - No security changes (existing RLS policies cover the new column).
*/
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kpi_tiles' AND column_name = 'align'
  ) THEN
    ALTER TABLE public.kpi_tiles
      ADD COLUMN align text NOT NULL DEFAULT 'left'
      CHECK (align IN ('left', 'center', 'right'));
  END IF;
END $$;