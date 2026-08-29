Create ONE new Supabase migration file and apply it. Do NOT modify any file under `src/`. Do NOT touch any other migration.

File: `supabase/migrations/20260828210000_add_priority_due_date_sla.sql`

Use exactly this SQL:

```sql
/*
# Quote control fields: Priority, Due Date, SLA table

## quotes — new columns
- priority text NOT NULL DEFAULT 'Standard' (Standard | Low | High). Existing quotes: randomized.
- due_date date — computed by trigger: created_at (local date) + SLA days for (opportunity_type, priority).
  Recomputed when opportunity_type or priority actually change. Can be edited manually (the trigger
  only overrides it when one of those two fields changes).
- due_warning_days integer — snapshot of the SLA warning threshold at calculation time.
- opportunity_type: existing blank values randomized among BID / CONTRACT / STANDARD PUBLISH.

## sla_due_date — one row per opportunity type
- days_high / days_standard / days_low (default 7), warning_days (default 1).
- Readable by all authenticated (AAL2); writable by admins only. Seeded with the 3 opportunity types.

## Permissions
- Adds 'admin.sla' to the Full Access role.

Local date boundaries use time zone America/Monterrey (same as count_list_views).
*/

-- ============================================================
-- 1. sla_due_date
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sla_due_date (
  opportunity_type text PRIMARY KEY CHECK (opportunity_type IN ('BID', 'CONTRACT', 'STANDARD PUBLISH')),
  days_high integer NOT NULL DEFAULT 7 CHECK (days_high >= 0),
  days_standard integer NOT NULL DEFAULT 7 CHECK (days_standard >= 0),
  days_low integer NOT NULL DEFAULT 7 CHECK (days_low >= 0),
  warning_days integer NOT NULL DEFAULT 1 CHECK (warning_days >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_due_date ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sla_due_date_select" ON public.sla_due_date;
CREATE POLICY "sla_due_date_select" ON public.sla_due_date FOR SELECT
  TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');

DROP POLICY IF EXISTS "sla_due_date_write_admin" ON public.sla_due_date;
CREATE POLICY "sla_due_date_write_admin" ON public.sla_due_date FOR ALL
  TO authenticated
  USING (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

INSERT INTO public.sla_due_date (opportunity_type) VALUES ('BID'), ('CONTRACT'), ('STANDARD PUBLISH')
ON CONFLICT (opportunity_type) DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_sla_due_date_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sla_due_date_set_updated_at ON public.sla_due_date;
CREATE TRIGGER sla_due_date_set_updated_at
  BEFORE UPDATE ON public.sla_due_date
  FOR EACH ROW EXECUTE FUNCTION public.trg_sla_due_date_set_updated_at();

-- ============================================================
-- 2. quotes columns
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'priority') THEN
    ALTER TABLE public.quotes ADD COLUMN priority text NOT NULL DEFAULT 'Standard';
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_priority_check CHECK (priority IN ('Standard', 'Low', 'High'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'due_date') THEN
    ALTER TABLE public.quotes ADD COLUMN due_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'due_warning_days') THEN
    ALTER TABLE public.quotes ADD COLUMN due_warning_days integer NOT NULL DEFAULT 1;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quotes_due_date ON public.quotes(due_date);
CREATE INDEX IF NOT EXISTS idx_quotes_priority ON public.quotes(priority);

-- ============================================================
-- 3. SLA calculation
-- ============================================================
CREATE OR REPLACE FUNCTION public.sla_due_for(
  p_opportunity_type text,
  p_priority text,
  p_created_at timestamptz,
  OUT r_due_date date,
  OUT r_warning_days integer
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_row public.sla_due_date%ROWTYPE;
  v_days integer;
  v_base date;
BEGIN
  r_due_date := NULL;
  r_warning_days := 1;
  SELECT * INTO v_row FROM public.sla_due_date WHERE opportunity_type = p_opportunity_type;
  IF NOT FOUND THEN RETURN; END IF;
  v_days := CASE p_priority
    WHEN 'High' THEN v_row.days_high
    WHEN 'Low' THEN v_row.days_low
    ELSE v_row.days_standard
  END;
  v_base := (COALESCE(p_created_at, now()) AT TIME ZONE 'America/Monterrey')::date;
  r_due_date := v_base + v_days;
  r_warning_days := v_row.warning_days;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_quotes_compute_due_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_due date;
  v_warn integer;
  v_recalc boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_recalc := NEW.due_date IS NULL;
  ELSE
    v_recalc := (NEW.opportunity_type IS DISTINCT FROM OLD.opportunity_type)
             OR (NEW.priority IS DISTINCT FROM OLD.priority);
  END IF;
  IF v_recalc THEN
    SELECT r_due_date, r_warning_days INTO v_due, v_warn
    FROM public.sla_due_for(NEW.opportunity_type, NEW.priority, NEW.created_at);
    NEW.due_date := v_due;
    NEW.due_warning_days := COALESCE(v_warn, 1);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_compute_due_date ON public.quotes;
CREATE TRIGGER quotes_compute_due_date
  BEFORE INSERT OR UPDATE OF opportunity_type, priority
  ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.trg_quotes_compute_due_date();

-- ============================================================
-- 4. Backfill existing quotes (randomized so list views look mixed)
-- ============================================================
UPDATE public.quotes
SET opportunity_type = (ARRAY['BID', 'CONTRACT', 'STANDARD PUBLISH'])[floor(random() * 3 + 1)]
WHERE opportunity_type IS NULL OR btrim(opportunity_type) = '';

UPDATE public.quotes
SET priority = (ARRAY['Standard', 'Low', 'High'])[floor(random() * 3 + 1)];

UPDATE public.quotes q
SET due_date = (SELECT r_due_date FROM public.sla_due_for(q.opportunity_type, q.priority, q.created_at)),
    due_warning_days = COALESCE((SELECT r_warning_days FROM public.sla_due_for(q.opportunity_type, q.priority, q.created_at)), 1)
WHERE q.due_date IS NULL;

-- ============================================================
-- 5. Permission for the SLA admin tab
-- ============================================================
INSERT INTO public.role_permissions (role_id, permission_key, can_view, can_edit, can_delete)
VALUES ('b0000000-0000-0000-0000-000000000001', 'admin.sla', true, true, true)
ON CONFLICT (role_id, permission_key) DO NOTHING;
```

After applying, confirm the migration ran without errors. Do not generate any TypeScript, components, or additional migrations.
