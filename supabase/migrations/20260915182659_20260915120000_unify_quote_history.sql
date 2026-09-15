/*
  # Unify quote history into a single table

  - quote_history gains field-change columns. Activity rows (written by the app) keep
    entry_type = 'activity'. Field changes written by triggers use entry_type = 'field_change'.
  - Triggers on quotes / quote_lanes now write to quote_history. Quote INSERT is NOT logged per
    field (the app already logs a "Quote Created" activity). Lane INSERT logs ONE "Lane Added"
    activity row. Field rows start with the first UPDATE.
  - Empty string and NULL are treated as the same (no row for '' -> NULL).
  - Real field changes already recorded in quote_field_history (old_value IS NOT NULL) are
    migrated; creation rows are discarded. quote_field_history is then dropped.
  - field_history_tracking and set_field_history_tracking are unchanged.
*/

-- 1. New columns on quote_history
ALTER TABLE public.quote_history
  ADD COLUMN IF NOT EXISTS entry_type  text NOT NULL DEFAULT 'activity',
  ADD COLUMN IF NOT EXISTS object      text,
  ADD COLUMN IF NOT EXISTS record_id   uuid,
  ADD COLUMN IF NOT EXISTS lane_label  text,
  ADD COLUMN IF NOT EXISTS field       text,
  ADD COLUMN IF NOT EXISTS old_value   text,
  ADD COLUMN IF NOT EXISTS new_value   text,
  ADD COLUMN IF NOT EXISTS changed_by  uuid,
  ADD COLUMN IF NOT EXISTS changed_via text NOT NULL DEFAULT 'app';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_history_entry_type_check') THEN
    ALTER TABLE public.quote_history ADD CONSTRAINT quote_history_entry_type_check
      CHECK (entry_type IN ('activity', 'field_change'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_history_object_check') THEN
    ALTER TABLE public.quote_history ADD CONSTRAINT quote_history_object_check
      CHECK (object IS NULL OR object IN ('quote', 'quote_lane'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_history_changed_via_check') THEN
    ALTER TABLE public.quote_history ADD CONSTRAINT quote_history_changed_via_check
      CHECK (changed_via IN ('app', 'customer_portal', 'system'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS quote_history_quote_date_idx ON public.quote_history (quote_id, date DESC);
CREATE INDEX IF NOT EXISTS quote_history_field_idx ON public.quote_history (quote_id, field) WHERE field IS NOT NULL;

-- 2. Migrate real changes from quote_field_history (creation rows have old_value NULL and are discarded)
INSERT INTO public.quote_history
  (quote_id, date, user_name, action, notes, entry_type, object, record_id, lane_label, field, old_value, new_value, changed_by, changed_via, created_at)
SELECT quote_id, changed_at, changed_by_name, 'Field Changed', '', 'field_change', object, record_id, lane_label, field,
       old_value, new_value, changed_by, changed_via, changed_at
FROM public.quote_field_history
WHERE old_value IS NOT NULL;

-- 3. Retire quote_field_history and its triggers
DROP TRIGGER IF EXISTS quotes_field_history ON public.quotes;
DROP TRIGGER IF EXISTS quote_lanes_field_history ON public.quote_lanes;
DROP TABLE IF EXISTS public.quote_field_history;

-- 4. Trigger: quotes (UPDATE only)
CREATE OR REPLACE FUNCTION public.trg_quotes_field_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
  v_o   text;
  v_n   text;
  r     record;
  a     record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.field_history_tracking WHERE object = 'quote' AND enabled) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO a FROM public.fh_actor(v_new ->> 'customer_email');

  FOR r IN SELECT column_name FROM public.field_history_tracking WHERE object = 'quote' AND enabled LOOP
    v_n := NULLIF(v_new ->> r.column_name, '');
    v_o := NULLIF(v_old ->> r.column_name, '');
    IF v_o IS NOT DISTINCT FROM v_n THEN CONTINUE; END IF;

    INSERT INTO public.quote_history
      (quote_id, date, user_name, action, notes, entry_type, object, record_id, lane_label, field, old_value, new_value, changed_by, changed_via)
    VALUES
      (NEW.id, now(), a.actor_name, 'Field Changed', '', 'field_change', 'quote', NEW.id, NULL, r.column_name, v_o, v_n, a.actor_id, a.via);
  END LOOP;

  RETURN NEW;
END; $$;
CREATE TRIGGER quotes_field_history AFTER UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.trg_quotes_field_history();

-- 5. Trigger: quote_lanes (INSERT = one "Lane Added" activity; UPDATE = field rows)
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
  SELECT q.customer_email INTO v_email FROM public.quotes q WHERE q.id = NEW.quote_id;
  SELECT * INTO a FROM public.fh_actor(v_email);

  v_label := 'Lane ' || (COALESCE(NEW.sort_order, 0) + 1)::text
             || ': ' || COALESCE(NEW.origin_city, '') || ' → ' || COALESCE(NEW.destination_city, '');

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.quote_history
      (quote_id, date, user_name, action, notes, entry_type, object, record_id, lane_label, changed_by, changed_via)
    VALUES
      (NEW.quote_id, now(), a.actor_name, 'Lane Added', v_label, 'activity', 'quote_lane', NEW.id, v_label, a.actor_id, a.via);
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.field_history_tracking WHERE object = 'quote_lane' AND enabled) THEN
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  FOR r IN SELECT column_name FROM public.field_history_tracking WHERE object = 'quote_lane' AND enabled LOOP
    v_n := NULLIF(v_new ->> r.column_name, '');
    v_o := NULLIF(v_old ->> r.column_name, '');
    IF v_o IS NOT DISTINCT FROM v_n THEN CONTINUE; END IF;

    INSERT INTO public.quote_history
      (quote_id, date, user_name, action, notes, entry_type, object, record_id, lane_label, field, old_value, new_value, changed_by, changed_via)
    VALUES
      (NEW.quote_id, now(), a.actor_name, 'Field Changed', '', 'field_change', 'quote_lane', NEW.id, v_label, r.column_name, v_o, v_n, a.actor_id, a.via);
  END LOOP;

  RETURN NEW;
END; $$;
CREATE TRIGGER quote_lanes_field_history AFTER INSERT OR UPDATE ON public.quote_lanes
  FOR EACH ROW EXECUTE FUNCTION public.trg_quote_lanes_field_history();

-- 6. Lane deletion: one activity row (lanes are deleted by the app without a log today)
CREATE OR REPLACE FUNCTION public.trg_quote_lanes_deleted_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_label text; v_email text; a record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = OLD.quote_id) THEN RETURN OLD; END IF; -- quote cascade delete
  SELECT q.customer_email INTO v_email FROM public.quotes q WHERE q.id = OLD.quote_id;
  SELECT * INTO a FROM public.fh_actor(v_email);
  v_label := 'Lane ' || (COALESCE(OLD.sort_order, 0) + 1)::text
             || ': ' || COALESCE(OLD.origin_city, '') || ' → ' || COALESCE(OLD.destination_city, '');
  INSERT INTO public.quote_history
    (quote_id, date, user_name, action, notes, entry_type, object, record_id, lane_label, changed_by, changed_via)
  VALUES
    (OLD.quote_id, now(), a.actor_name, 'Lane Deleted', v_label, 'activity', 'quote_lane', OLD.id, v_label, a.actor_id, a.via);
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS quote_lanes_deleted_history ON public.quote_lanes;
CREATE TRIGGER quote_lanes_deleted_history AFTER DELETE ON public.quote_lanes
  FOR EACH ROW EXECUTE FUNCTION public.trg_quote_lanes_deleted_history();