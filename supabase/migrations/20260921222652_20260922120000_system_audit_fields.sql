/*
  # System audit fields (Created By / Last Modified By)

  For each business table: created_by (uuid), created_by_name (text), updated_by (uuid),
  updated_by_name (text), plus created_at / updated_at where missing. A single trigger keeps
  them current using the same actor resolution as the history (fh_actor): app user by display
  name, Customer Portal, or System. Backfilled from quote_history where possible.
*/

CREATE OR REPLACE FUNCTION public.trg_set_audit_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.fh_actor();
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_at IS NULL THEN NEW.created_at := now(); END IF;
    IF NEW.created_by IS NULL THEN NEW.created_by := a.actor_id; END IF;
    IF NEW.created_by_name IS NULL THEN NEW.created_by_name := a.actor_name; END IF;
    NEW.updated_at := NEW.created_at;
    NEW.updated_by := NEW.created_by;
    NEW.updated_by_name := NEW.created_by_name;
  ELSE
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
    NEW.created_by_name := OLD.created_by_name;
    NEW.updated_at := now();
    NEW.updated_by := a.actor_id;
    NEW.updated_by_name := a.actor_name;
  END IF;
  RETURN NEW;
END; $$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY['quotes', 'quote_lanes', 'accounts', 'bill_to', 'shippers', 'cities',
                         'border_crossing_cities', 'accessorials', 'terms_conditions', 'sla_due_date',
                         'global_variables', 'profiles', 'roles', 'kpi_tiles'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('ALTER TABLE public.%I
        ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN IF NOT EXISTS created_by uuid,
        ADD COLUMN IF NOT EXISTS created_by_name text,
        ADD COLUMN IF NOT EXISTS updated_by uuid,
        ADD COLUMN IF NOT EXISTS updated_by_name text', t);
    END IF;
  END LOOP;
END $$;

-- The "Account Lane" table (quoted mixed-case name) is handled separately
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Account Lane') THEN
    ALTER TABLE public."Account Lane"
      ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS created_by uuid,
      ADD COLUMN IF NOT EXISTS created_by_name text,
      ADD COLUMN IF NOT EXISTS updated_by uuid,
      ADD COLUMN IF NOT EXISTS updated_by_name text;
  END IF;
END $$;

-- Backfill quotes from the history (Quote Created / last entry), falling back to the owner
UPDATE public.quotes q SET
  created_by      = COALESCE(q.created_by, h.changed_by),
  created_by_name = COALESCE(q.created_by_name, h.user_name, q.owner_name)
FROM (
  SELECT DISTINCT ON (quote_id) quote_id, changed_by, user_name
  FROM public.quote_history WHERE action = 'Quote Created' ORDER BY quote_id, date ASC
) h WHERE h.quote_id = q.id AND q.created_by_name IS NULL;

UPDATE public.quotes q SET created_by_name = COALESCE(q.created_by_name, q.owner_name, 'Unknown') WHERE q.created_by_name IS NULL;

UPDATE public.quotes q SET
  updated_by      = COALESCE(q.updated_by, h.changed_by),
  updated_by_name = COALESCE(q.updated_by_name, h.user_name),
  updated_at      = GREATEST(q.updated_at, h.date)
FROM (
  SELECT DISTINCT ON (quote_id) quote_id, changed_by, user_name, date
  FROM public.quote_history ORDER BY quote_id, date DESC
) h WHERE h.quote_id = q.id AND q.updated_by_name IS NULL;

UPDATE public.quotes SET updated_by = COALESCE(updated_by, created_by), updated_by_name = COALESCE(updated_by_name, created_by_name) WHERE updated_by_name IS NULL;

-- Lanes inherit the quote's creator when unknown
UPDATE public.quote_lanes l SET
  created_by = COALESCE(l.created_by, q.created_by), created_by_name = COALESCE(l.created_by_name, q.created_by_name),
  updated_by = COALESCE(l.updated_by, q.updated_by), updated_by_name = COALESCE(l.updated_by_name, q.updated_by_name)
FROM public.quotes q WHERE q.id = l.quote_id AND (l.created_by_name IS NULL OR l.updated_by_name IS NULL);

-- Everything else: mark historical rows
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['accounts', 'bill_to', 'shippers', 'cities', 'border_crossing_cities', 'accessorials', 'terms_conditions', 'sla_due_date', 'global_variables', 'profiles', 'roles', 'kpi_tiles'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('UPDATE public.%I SET created_by_name = COALESCE(created_by_name, ''System (historical)''), updated_by_name = COALESCE(updated_by_name, created_by_name, ''System (historical)'')', t);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Account Lane') THEN
    UPDATE public."Account Lane" SET created_by_name = COALESCE(created_by_name, 'System (historical)'), updated_by_name = COALESCE(updated_by_name, created_by_name, 'System (historical)');
  END IF;
END $$;

-- Triggers are created AFTER the backfill so the backfill does not stamp "System" as modifier
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['quotes', 'quote_lanes', 'accounts', 'bill_to', 'shippers', 'cities', 'border_crossing_cities', 'accessorials', 'terms_conditions', 'sla_due_date', 'global_variables', 'profiles', 'roles', 'kpi_tiles'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_set_audit_fields', t);
      EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.trg_set_audit_fields()',
                     t || '_set_audit_fields', t);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Account Lane') THEN
    DROP TRIGGER IF EXISTS account_lane_set_audit_fields ON public."Account Lane";
    CREATE TRIGGER account_lane_set_audit_fields BEFORE INSERT OR UPDATE ON public."Account Lane"
      FOR EACH ROW EXECUTE FUNCTION public.trg_set_audit_fields();
  END IF;
END $$;