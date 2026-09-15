/*
  # Login History and lockout support

  - login_history: one row per login attempt (success or failure) with ip and user agent.
    Admins see everything; a user sees only their own rows. Written only by the secure-login
    Edge Function (service role).
  - user_sessions.login_id links an app session to the login attempt that created it.
    Users can now read their own sessions; admins read all.
  - security_user_id_by_email: service-role-only lookup used by the Edge Function to find the
    account an attempt belongs to (user_profiles does not store the email).
  - purge_security_logs: deletes login_history / user_sessions older than 12 months.
  - start_session now accepts an optional login id.
*/

-- 1. login_history
CREATE TABLE IF NOT EXISTS public.login_history (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  status      text NOT NULL CHECK (status IN ('success', 'invalid_credentials', 'locked', 'unknown_user', 'error')),
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_history_user_idx ON public.login_history (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS login_history_created_idx ON public.login_history (created_at DESC);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "login_history_select" ON public.login_history;
CREATE POLICY "login_history_select" ON public.login_history FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND (public.is_admin() OR user_id = auth.uid()));
-- No INSERT/UPDATE/DELETE policies: service role only.

-- 2. Link sessions to logins; let users read their own sessions
ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS login_id bigint REFERENCES public.login_history(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "user_sessions_select" ON public.user_sessions;
CREATE POLICY "user_sessions_select" ON public.user_sessions FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND (public.is_admin() OR user_id = auth.uid()));

-- 3. start_session with optional login link (replaces the no-arg version)
DROP FUNCTION IF EXISTS public.start_session();
CREATE OR REPLACE FUNCTION public.start_session(p_login_id bigint DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.user_sessions (user_id, login_id)
  VALUES (auth.uid(),
          (SELECT id FROM public.login_history WHERE id = p_login_id AND user_id = auth.uid()))
  RETURNING session_id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.start_session(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_session(bigint) TO authenticated;

-- 4. Service-role-only helpers for the Edge Function
CREATE OR REPLACE FUNCTION public.security_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT u.id FROM auth.users u WHERE lower(u.email) = lower(btrim(p_email)) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.security_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_user_id_by_email(text) TO service_role;

CREATE OR REPLACE FUNCTION public.purge_security_logs()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.login_history WHERE created_at < now() - interval '12 months';
  DELETE FROM public.user_sessions WHERE started_at < now() - interval '12 months';
$$;
REVOKE ALL ON FUNCTION public.purge_security_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_security_logs() TO service_role;