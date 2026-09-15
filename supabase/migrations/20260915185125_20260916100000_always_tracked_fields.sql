/*
  # Always-tracked quote fields

  stage, status, owner_name, priority, opportunity_type and due_date on the quote object are
  system-tracked: enabled, flagged is_system = true, and cannot be disabled by admins.
  The app stops writing its own activity rows for these changes; the trigger row is the single
  record of each change.
*/

ALTER TABLE public.field_history_tracking
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

INSERT INTO public.field_history_tracking (object, column_name, enabled, is_system)
VALUES
  ('quote', 'stage', true, true),
  ('quote', 'status', true, true),
  ('quote', 'owner_name', true, true),
  ('quote', 'priority', true, true),
  ('quote', 'opportunity_type', true, true),
  ('quote', 'due_date', true, true)
ON CONFLICT (object, column_name) DO UPDATE SET enabled = true, is_system = true;

-- Validation trigger: system rows can never be disabled
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

  IF NEW.is_system AND NOT NEW.enabled THEN
    RAISE EXCEPTION 'Field % is always tracked and cannot be disabled', NEW.column_name;
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

-- Save helper: system rows are kept enabled regardless of the list received
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
  WHERE object = p_object AND enabled = true AND is_system = false
    AND NOT (column_name = ANY (COALESCE(p_columns, '{}')));

  FOREACH c IN ARRAY COALESCE(p_columns, '{}') LOOP
    INSERT INTO public.field_history_tracking (object, column_name, enabled)
    VALUES (p_object, c, true)
    ON CONFLICT (object, column_name) DO UPDATE SET enabled = true;
  END LOOP;
END; $$;