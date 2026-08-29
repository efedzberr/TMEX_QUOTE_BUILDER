Create ONE new Supabase migration file and apply it. Do NOT modify any file under `src/`. Do NOT touch any other migration.

File: `supabase/migrations/20260828150000_add_kpi_tiles_align.sql`

Use exactly this SQL:

```sql
/*
# kpi_tiles.align — per-tile text alignment (left | center | right)
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
```

After applying, confirm the migration ran without errors. Do not generate any TypeScript or additional migrations.
