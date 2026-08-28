Create ONE new Supabase migration file and apply it. Do NOT modify any file under `src/`. Do NOT touch any other migration.

File: `supabase/migrations/20260828120000_add_kpi_tiles_and_total_amount_trigger.sql`

Use exactly this SQL:

```sql
/*
# KPI Tiles foundation + quotes.total_amount maintained by trigger

## Summary
1. quotes.total_amount (existing column) is now maintained automatically from quote_lanes
   with the same formula the UI uses: us_rate + mx_rate + border_crossing_fee + toll_rate.
   Backfills all existing quotes.
2. New table kpi_tiles: per-user (or global, owner_user_id NULL) KPI tiles bound to list_views.
   Max 8 tiles per owner+object enforced by trigger. RLS: personal rows owner-only;
   global rows readable by all authenticated (AAL2), writable by admins only.

No existing policies are modified.
*/

-- ============================================================
-- 1. quotes.total_amount maintained by trigger on quote_lanes
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_quote_total_amount(p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_quote_id IS NULL THEN RETURN; END IF;
  UPDATE public.quotes q
  SET total_amount = COALESCE((
    SELECT SUM(
      COALESCE(l.us_rate, 0)
      + COALESCE(l.mx_rate, 0)
      + COALESCE(l.border_crossing_fee, 0)
      + COALESCE(l.toll_rate, 0)
    )
    FROM public.quote_lanes l
    WHERE l.quote_id = p_quote_id
  ), 0)
  WHERE q.id = p_quote_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_quote_lanes_recalc_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_quote_total_amount(OLD.quote_id);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.quote_id IS DISTINCT FROM OLD.quote_id THEN
    PERFORM public.recalc_quote_total_amount(OLD.quote_id);
  END IF;
  PERFORM public.recalc_quote_total_amount(NEW.quote_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quote_lanes_recalc_total ON public.quote_lanes;
CREATE TRIGGER quote_lanes_recalc_total
  AFTER INSERT OR DELETE OR UPDATE OF us_rate, mx_rate, border_crossing_fee, toll_rate, quote_id
  ON public.quote_lanes
  FOR EACH ROW EXECUTE FUNCTION public.trg_quote_lanes_recalc_total();

-- Backfill every quote
UPDATE public.quotes q
SET total_amount = COALESCE((
  SELECT SUM(
    COALESCE(l.us_rate, 0)
    + COALESCE(l.mx_rate, 0)
    + COALESCE(l.border_crossing_fee, 0)
    + COALESCE(l.toll_rate, 0)
  )
  FROM public.quote_lanes l
  WHERE l.quote_id = q.id
), 0);

-- ============================================================
-- 2. kpi_tiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kpi_tiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object text NOT NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  list_view_id uuid REFERENCES public.list_views(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 40),
  color smallint NOT NULL DEFAULT 0 CHECK (color BETWEEN 0 AND 15),
  position smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kpi_tiles_owner_object
  ON public.kpi_tiles (owner_user_id, object, position);

CREATE INDEX IF NOT EXISTS idx_kpi_tiles_list_view
  ON public.kpi_tiles (list_view_id);

-- Max 8 tiles per owner (NULL = global set) per object
CREATE OR REPLACE FUNCTION public.trg_kpi_tiles_max_eight()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.kpi_tiles t
  WHERE t.object = NEW.object
    AND t.owner_user_id IS NOT DISTINCT FROM NEW.owner_user_id
    AND t.id <> NEW.id;
  IF v_count >= 8 THEN
    RAISE EXCEPTION 'Maximum of 8 KPI tiles per strip reached';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kpi_tiles_max_eight ON public.kpi_tiles;
CREATE TRIGGER kpi_tiles_max_eight
  BEFORE INSERT OR UPDATE OF owner_user_id, object
  ON public.kpi_tiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_kpi_tiles_max_eight();

-- updated_at
CREATE OR REPLACE FUNCTION public.trg_kpi_tiles_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kpi_tiles_set_updated_at ON public.kpi_tiles;
CREATE TRIGGER kpi_tiles_set_updated_at
  BEFORE UPDATE ON public.kpi_tiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_kpi_tiles_set_updated_at();

-- RLS
ALTER TABLE public.kpi_tiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kpi_tiles_select" ON public.kpi_tiles;
CREATE POLICY "kpi_tiles_select" ON public.kpi_tiles FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND (owner_user_id = auth.uid() OR owner_user_id IS NULL)
  );

DROP POLICY IF EXISTS "kpi_tiles_insert" ON public.kpi_tiles;
CREATE POLICY "kpi_tiles_insert" ON public.kpi_tiles FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND (
      owner_user_id = auth.uid()
      OR (
        owner_user_id IS NULL
        AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      )
    )
  );

DROP POLICY IF EXISTS "kpi_tiles_update" ON public.kpi_tiles;
CREATE POLICY "kpi_tiles_update" ON public.kpi_tiles FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND (
      owner_user_id = auth.uid()
      OR (
        owner_user_id IS NULL
        AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      )
    )
  )
  WITH CHECK (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND (
      owner_user_id = auth.uid()
      OR (
        owner_user_id IS NULL
        AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      )
    )
  );

DROP POLICY IF EXISTS "kpi_tiles_delete" ON public.kpi_tiles;
CREATE POLICY "kpi_tiles_delete" ON public.kpi_tiles FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND (
      owner_user_id = auth.uid()
      OR (
        owner_user_id IS NULL
        AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
      )
    )
  );
```

After applying, confirm the migration ran without errors. Do not generate any TypeScript, components, or additional migrations.
