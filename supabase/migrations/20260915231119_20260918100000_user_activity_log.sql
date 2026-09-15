/*
  # User Activity Log (business events)

  user_activity_log: one row per business event per user.
  - Written by: log_activity() RPC (app), and AFTER INSERT/UPDATE triggers that mirror events
    already recorded elsewhere (quote_history activities and stage/status/owner changes,
    mass_update_log runs, profile / permission / history-tracking / password-policy changes).
  - Read by: admins (all) and each user (own rows). aal2 required.
  - Duplicate guard: an identical (user, event, record) within 5 seconds is ignored, so
    row-level triggers on multi-row saves produce a single entry.
  - Purged with login_history after 12 months.
*/

CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id            bigserial PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name     text NOT NULL,
  event         text NOT NULL,
  object        text,
  record_id     uuid,
  record_label  text,
  details       text,
  session_id    uuid,
  source        text NOT NULL DEFAULT 'app' CHECK (source IN ('app', 'trigger')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_activity_log_user_idx ON public.user_activity_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_log_created_idx ON public.user_activity_log (created_at DESC);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_activity_log_select" ON public.user_activity_log;
CREATE POLICY "user_activity_log_select" ON public.user_activity_log FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND (public.is_admin() OR user_id = auth.uid()));
-- No INSERT/UPDATE/DELETE policies: only the functions below write here.

-- Internal writer with the 5-second duplicate guard. Not exposed to clients.
CREATE OR REPLACE FUNCTION public.activity_write(
  p_user_id uuid, p_user_name text, p_event text, p_object text, p_record_id uuid,
  p_record_label text, p_details text, p_session_id uuid, p_source text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_activity_log
    WHERE user_id = p_user_id AND event = p_event
      AND record_id IS NOT DISTINCT FROM p_record_id
      AND created_at > now() - interval '5 seconds'
  ) THEN RETURN; END IF;
  INSERT INTO public.user_activity_log
    (user_id, user_name, event, object, record_id, record_label, details, session_id, source)
  VALUES
    (p_user_id, COALESCE(p_user_name, 'Unknown user'), p_event, p_object, p_record_id, p_record_label, p_details, p_session_id, p_source);
END; $$;
REVOKE ALL ON FUNCTION public.activity_write(uuid, text, text, text, uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;

-- Client-facing RPC: always attributed to the caller.
CREATE OR REPLACE FUNCTION public.log_activity(
  p_event text, p_object text DEFAULT NULL, p_record_id uuid DEFAULT NULL,
  p_record_label text DEFAULT NULL, p_details text DEFAULT NULL, p_session_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF (SELECT auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' THEN RAISE EXCEPTION 'MFA required'; END IF;
  IF p_event IS NULL OR btrim(p_event) = '' THEN RAISE EXCEPTION 'Event required'; END IF;
  SELECT * INTO a FROM public.fh_actor();
  PERFORM public.activity_write(auth.uid(), a.actor_name, left(p_event, 80), p_object, p_record_id,
                                left(p_record_label, 200), left(p_details, 500), p_session_id, 'app');
END; $$;
REVOKE ALL ON FUNCTION public.log_activity(text, text, uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_activity(text, text, uuid, text, text, uuid) TO authenticated;

-- ---------------------------------------------------------------
-- Mirror: quote_history -> activity (activities + stage/status/owner changes)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_activity_from_quote_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event text; v_details text; v_label text;
BEGIN
  IF NEW.changed_by IS NULL THEN RETURN NEW; END IF;  -- portal / system rows are not user activity

  SELECT q.quote_number INTO v_label FROM public.quotes q WHERE q.id = NEW.quote_id;

  IF COALESCE(NEW.entry_type, 'activity') = 'activity' THEN
    v_event := NEW.action;
    v_details := NULLIF(NEW.notes, '');
  ELSIF NEW.field = 'stage' THEN
    v_event := 'Stage Changed';
    v_details := COALESCE(NEW.old_value, 'empty') || ' -> ' || COALESCE(NEW.new_value, 'empty');
  ELSIF NEW.field = 'status' THEN
    v_event := 'Status Changed';
    v_details := COALESCE(NEW.old_value, 'empty') || ' -> ' || COALESCE(NEW.new_value, 'empty');
  ELSIF NEW.field = 'owner_name' THEN
    v_event := 'Owner Changed';
    v_details := COALESCE(NEW.old_value, 'empty') || ' -> ' || COALESCE(NEW.new_value, 'empty');
  ELSE
    RETURN NEW;  -- other field changes stay in the quote history only
  END IF;

  PERFORM public.activity_write(NEW.changed_by, NEW.user_name, v_event, 'quote', NEW.quote_id, v_label, v_details, NULL, 'trigger');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS activity_from_quote_history ON public.quote_history;
CREATE TRIGGER activity_from_quote_history AFTER INSERT ON public.quote_history
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_from_quote_history();

-- ---------------------------------------------------------------
-- Mirror: mass_update_log -> "Mass Update Executed"
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_activity_from_mass_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.fh_actor();
  PERFORM public.activity_write(auth.uid(), a.actor_name, 'Mass Update Executed', 'mass_update', NEW.id, NULL,
    NEW.total_quotes_created::text || ' quotes created from ' || NEW.total_lanes_selected::text || ' lanes; '
      || NEW.total_emails_sent::text || ' emails sent', NULL, 'trigger');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS activity_from_mass_update ON public.mass_update_log;
CREATE TRIGGER activity_from_mass_update AFTER INSERT ON public.mass_update_log
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_from_mass_update();

-- ---------------------------------------------------------------
-- Mirror: administration changes
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_activity_profile_permissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; v_pid uuid; v_name text;
BEGIN
  v_pid := COALESCE(NEW.profile_id, OLD.profile_id);
  SELECT p.name INTO v_name FROM public.profiles p WHERE p.id = v_pid;
  SELECT * INTO a FROM public.fh_actor();
  PERFORM public.activity_write(auth.uid(), a.actor_name, 'Profile Permissions Changed', 'profile', v_pid, v_name, NULL, NULL, 'trigger');
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS activity_profile_permissions ON public.profile_permissions;
CREATE TRIGGER activity_profile_permissions AFTER INSERT OR UPDATE OR DELETE ON public.profile_permissions
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_profile_permissions();

CREATE OR REPLACE FUNCTION public.trg_activity_profiles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; v_event text; v_details text;
BEGIN
  SELECT * INTO a FROM public.fh_actor();
  IF TG_OP = 'INSERT' THEN
    v_event := 'Profile Created';
  ELSIF TG_OP = 'DELETE' THEN
    v_event := 'Profile Deleted';
  ELSIF NEW.session_timeout_minutes IS DISTINCT FROM OLD.session_timeout_minutes THEN
    v_event := 'Session Timeout Changed';
    v_details := OLD.session_timeout_minutes::text || ' -> ' || NEW.session_timeout_minutes::text || ' minutes';
  ELSE
    v_event := 'Profile Updated';
  END IF;
  PERFORM public.activity_write(auth.uid(), a.actor_name, v_event, 'profile', COALESCE(NEW.id, OLD.id), COALESCE(NEW.name, OLD.name), v_details, NULL, 'trigger');
  RETURN COALESCE(NEW, OLD);
END; $$;
DROP TRIGGER IF EXISTS activity_profiles ON public.profiles;
CREATE TRIGGER activity_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_profiles();

CREATE OR REPLACE FUNCTION public.trg_activity_field_history_tracking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.fh_actor();
  PERFORM public.activity_write(auth.uid(), a.actor_name, 'History Tracking Changed', 'field_history_tracking', NULL,
    CASE NEW.object WHEN 'quote' THEN 'Quotes' ELSE 'Quote Lanes' END, NULL, NULL, 'trigger');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS activity_field_history_tracking ON public.field_history_tracking;
CREATE TRIGGER activity_field_history_tracking AFTER INSERT OR UPDATE ON public.field_history_tracking
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_field_history_tracking();

CREATE OR REPLACE FUNCTION public.trg_activity_password_policies()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.fh_actor();
  PERFORM public.activity_write(auth.uid(), a.actor_name, 'Password Policies Changed', 'password_policies', NULL, NULL, NULL, NULL, 'trigger');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS activity_password_policies ON public.password_policies;
CREATE TRIGGER activity_password_policies AFTER UPDATE ON public.password_policies
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_password_policies();

-- ---------------------------------------------------------------
-- Retention: include the activity log in the existing purge
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_security_logs()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.login_history WHERE created_at < now() - interval '12 months';
  DELETE FROM public.user_sessions WHERE started_at < now() - interval '12 months';
  DELETE FROM public.user_activity_log WHERE created_at < now() - interval '12 months';
$$;