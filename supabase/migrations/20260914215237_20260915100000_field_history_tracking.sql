/*
  # Field History Tracking (Salesforce-style) for Quotes and Quote Lanes

  ## field_history_tracking
  Admin configuration: which columns of `quotes` (object 'quote') and `quote_lanes`
  (object 'quote_lane') are tracked. Max 40 enabled columns per object. A column must exist
  in the table to be enabled. Readable by any aal2 user; writable with
  has_permission('quote.field_history_config', 'edit').

  ## quote_field_history
  One row per tracked column per change (INSERT records initial values with old_value NULL;
  UPDATE records only columns whose value actually changed). Written ONLY by triggers.
  Readable by authenticated users who can see the quote (same rule as quote_history).

  ## Actor resolution (fh_actor)
  - authenticated user  -> user_profiles.display_name (fallback: auth.users.email), via 'app'
  - anon (customer portal) -> 'Customer Portal' + quote customer_email, via 'customer_portal'
  - service role / no user -> 'System', via 'system'

  ## Triggers
  - quotes      AFTER INSERT OR UPDATE -> trg_quotes_field_history
  - quote_lanes AFTER INSERT OR UPDATE -> trg_quote_lanes_field_history
  Both are no-ops when nothing is enabled for the object.

  Nothing existing is dropped or modified. `quote_history` (activity log) is untouched.
*/

-- ============================================================
-- 1. Permission key
-- ============================================================
INSERT INTO public.profile_permissions (profile_id, permission_key, can_view, can_create, can_edit, can_delete)
VALUES ('b0000000-0000-0000-0000-000000000001', 'quote.field_history_config', true, true, true, true)
ON CONFLICT (profile_id, permission_key) DO NOTHING;

-- ============================================================
-- 2. field_history_tracking (configuration)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.field_history_tracking (
  object      text NOT NULL CHECK (object IN ('quote', 'quote_lane')),
  column_name text NOT NULL,
  enabled     boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (object, column_name)
);

ALTER TABLE public.field_history_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fht_select" ON public.field_history_tracking;
DROP POLICY IF EXISTS "fht_write" ON public.field_history_tracking;
CREATE POLICY "fht_select" ON public.field_history_tracking FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');
CREATE POLICY "fht_write" ON public.field_history_tracking FOR ALL TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('quote.field_history_config', 'edit'))
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('quote.field_history_config', 'edit'));

-- Validation: column must exist in the underlying table; max 40 enabled per object
CREATE OR REPLACE FUNCTION public.trg_fht_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_table text := CASE NEW.object WHEN 'quote' THEN 'quotes' ELSE 'quote_lanes' END;
  v_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = v_table AND column_name = NEW.column_name) THEN
    RAISE EXCEPTION 'Column % does not exist on % and cannot be tracked', NEW.column_name, v_table;
  END IF;

  IF NEW.enabled THEN
    SELECT COUNT(*) INTO v_count FROM public.field_history_tracking
    WHERE object = NEW.object AND enabled = true AND column_name <> NEW.column_name;
    IF v_count >= 40 THEN
      RAISE EXCEPTION 'A maximum of 40 fields can be tracked per object';
    END IF;
  END IF;

  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS fht_validate ON public.field_history_tracking;
CREATE TRIGGER fht_validate BEFORE INSERT OR UPDATE ON public.field_history_tracking
  FOR EACH ROW EXECUTE FUNCTION public.trg_fht_validate();

-- ============================================================
-- 3. quote_field_history (the log)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quote_field_history (
  id              bigserial PRIMARY KEY,
  quote_id        uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  object          text NOT NULL CHECK (object IN ('quote', 'quote_lane')),
  record_id       uuid NOT NULL,
  lane_label      text,
  field           text NOT NULL,
  old_value       text,
  new_value       text,
  changed_by      uuid,
  changed_by_name text NOT NULL,
  changed_via     text NOT NULL CHECK (changed_via IN ('app', 'customer_portal', 'system')),
  changed_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS quote_field_history_quote_idx
  ON public.quote_field_history (quote_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS quote_field_history_field_idx
  ON public.quote_field_history (quote_id, field);

ALTER TABLE public.quote_field_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qfh_select" ON public.quote_field_history;
CREATE POLICY "qfh_select" ON public.quote_field_history FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2'
         AND EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id));
-- No INSERT / UPDATE / DELETE policies: only the SECURITY DEFINER triggers below write here.

-- ============================================================
-- 4. Actor resolution
-- ============================================================
CREATE OR REPLACE FUNCTION public.fh_actor(p_customer_email text DEFAULT NULL,
                                           OUT actor_id uuid, OUT actor_name text, OUT via text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NOT NULL THEN
    actor_id := v_uid;
    SELECT NULLIF(btrim(up.display_name), '') INTO actor_name FROM public.user_profiles up WHERE up.id = v_uid;
    IF actor_name IS NULL THEN
      SELECT u.email INTO actor_name FROM auth.users u WHERE u.id = v_uid;
    END IF;
    actor_name := COALESCE(actor_name, 'Unknown user');
    via := 'app';
  ELSIF COALESCE(auth.role(), '') = 'anon' THEN
    actor_id := NULL;
    actor_name := 'Customer Portal' || COALESCE(' (' || NULLIF(btrim(p_customer_email), '') || ')', '');
    via := 'customer_portal';
  ELSE
    actor_id := NULL;
    actor_name := 'System';
    via := 'system';
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.fh_actor(text) FROM PUBLIC, anon;

-- ============================================================
-- 5. Trigger: quotes
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_quotes_field_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old jsonb;
  v_new jsonb := to_jsonb(NEW);
  v_o   text;
  v_n   text;
  r     record;
  a     record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.field_history_tracking WHERE object = 'quote' AND enabled) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN v_old := to_jsonb(OLD); END IF;
  SELECT * INTO a FROM public.fh_actor(v_new ->> 'customer_email');

  FOR r IN SELECT column_name FROM public.field_history_tracking WHERE object = 'quote' AND enabled LOOP
    v_n := v_new ->> r.column_name;
    v_o := CASE WHEN TG_OP = 'UPDATE' THEN v_old ->> r.column_name ELSE NULL END;

    IF TG_OP = 'INSERT' AND v_n IS NULL THEN CONTINUE; END IF;
    IF v_o IS NOT DISTINCT FROM v_n THEN CONTINUE; END IF;

    INSERT INTO public.quote_field_history
      (quote_id, object, record_id, lane_label, field, old_value, new_value, changed_by, changed_by_name, changed_via)
    VALUES
      (NEW.id, 'quote', NEW.id, NULL, r.column_name, v_o, v_n, a.actor_id, a.actor_name, a.via);
  END LOOP;

  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS quotes_field_history ON public.quotes;
CREATE TRIGGER quotes_field_history AFTER INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.trg_quotes_field_history();

-- ============================================================
-- 6. Trigger: quote_lanes
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_quote_lanes_field_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old   jsonb;
  v_new   jsonb := to_jsonb(NEW);
  v_o     text;
  v_n     text;
  v_label text;
  v_email text;
  r       record;
  a       record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.field_history_tracking WHERE object = 'quote_lane' AND enabled) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN v_old := to_jsonb(OLD); END IF;

  SELECT q.customer_email INTO v_email FROM public.quotes q WHERE q.id = NEW.quote_id;
  SELECT * INTO a FROM public.fh_actor(v_email);

  v_label := 'Lane ' || (COALESCE(NEW.sort_order, 0) + 1)::text
             || ': ' || COALESCE(NEW.origin_city, '') || ' → ' || COALESCE(NEW.destination_city, '');

  FOR r IN SELECT column_name FROM public.field_history_tracking WHERE object = 'quote_lane' AND enabled LOOP
    v_n := v_new ->> r.column_name;
    v_o := CASE WHEN TG_OP = 'UPDATE' THEN v_old ->> r.column_name ELSE NULL END;

    IF TG_OP = 'INSERT' AND v_n IS NULL THEN CONTINUE; END IF;
    IF v_o IS NOT DISTINCT FROM v_n THEN CONTINUE; END IF;

    INSERT INTO public.quote_field_history
      (quote_id, object, record_id, lane_label, field, old_value, new_value, changed_by, changed_by_name, changed_via)
    VALUES
      (NEW.quote_id, 'quote_lane', NEW.id, v_label, r.column_name, v_o, v_n, a.actor_id, a.actor_name, a.via);
  END LOOP;

  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS quote_lanes_field_history ON public.quote_lanes;
CREATE TRIGGER quote_lanes_field_history AFTER INSERT OR UPDATE ON public.quote_lanes
  FOR EACH ROW EXECUTE FUNCTION public.trg_quote_lanes_field_history();

-- ============================================================
-- 7. Admin helper to save the whole configuration in one call
-- ============================================================
-- p_columns: array of column names that must be enabled for the object; everything else
-- for that object is disabled. Runs the fht_validate trigger for each row.
CREATE OR REPLACE FUNCTION public.set_field_history_tracking(p_object text, p_columns text[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c text;
BEGIN
  IF (SELECT auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' THEN RAISE EXCEPTION 'MFA required'; END IF;
  IF NOT public.has_permission('quote.field_history_config', 'edit') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_object NOT IN ('quote', 'quote_lane') THEN RAISE EXCEPTION 'Invalid object'; END IF;
  IF COALESCE(array_length(p_columns, 1), 0) > 40 THEN RAISE EXCEPTION 'A maximum of 40 fields can be tracked per object'; END IF;

  UPDATE public.field_history_tracking SET enabled = false
  WHERE object = p_object AND enabled = true AND NOT (column_name = ANY (COALESCE(p_columns, '{}')));

  FOREACH c IN ARRAY COALESCE(p_columns, '{}') LOOP
    INSERT INTO public.field_history_tracking (object, column_name, enabled)
    VALUES (p_object, c, true)
    ON CONFLICT (object, column_name) DO UPDATE SET enabled = true;
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.set_field_history_tracking(text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_field_history_tracking(text, text[]) TO authenticated;