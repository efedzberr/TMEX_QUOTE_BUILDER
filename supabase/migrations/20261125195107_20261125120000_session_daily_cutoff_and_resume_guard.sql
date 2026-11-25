/*
  # Session hardening: daily sign-out at midnight + no silent session restart

  ## Why
  - A login could outlive the inactivity timeout: closing the tab/browser and coming back
    started a brand-new app session without asking for credentials.
  - Safety net requested by the business: every user is signed out at midnight and has to
    sign in again the next day.

  ## Changes
  - user_sessions.auth_session_id : the Supabase Auth session (JWT `session_id`) behind each
    app session, so the server can tell "same login" from "new login".
  - user_sessions.end_reason      : new allowed value 'midnight'.
  - session_day_start() / session_day_end() : today's cut-off window. Time zone is fixed in
    ONE place here: America/Monterrey.
  - start_session(p_login_id)     : returns NULL (session refused) when the login
      a) happened before today's midnight, or
      b) already has an app session that ended, or
      c) has been inactive longer than the profile timeout.
  - touch_session(p_session_id)   : also expires sessions started before today's midnight;
    the answer now carries `reason` and `day_ends_at`.
  - end_session(...)              : accepts the reason 'midnight'.
  - is_session_valid(...)         : also false after the daily cut-off.

  No table, policy or trigger is dropped. Function signatures are unchanged.
*/

-- ============================================================
-- 1. user_sessions: auth_session_id + 'midnight' end reason
-- ============================================================
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS auth_session_id uuid;

CREATE INDEX IF NOT EXISTS user_sessions_auth_session_idx
  ON public.user_sessions (auth_session_id) WHERE auth_session_id IS NOT NULL;

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.user_sessions'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%end_reason%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_sessions DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.user_sessions
  ADD CONSTRAINT user_sessions_end_reason_check
  CHECK (end_reason IS NULL OR end_reason IN ('logout','timeout','admin','midnight'));

-- ============================================================
-- 2. Daily cut-off window (single place for the time zone)
-- ============================================================
CREATE OR REPLACE FUNCTION public.session_day_start()
RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT date_trunc('day', now() AT TIME ZONE 'America/Monterrey') AT TIME ZONE 'America/Monterrey';
$$;

CREATE OR REPLACE FUNCTION public.session_day_end()
RETURNS timestamptz
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT (date_trunc('day', now() AT TIME ZONE 'America/Monterrey') + interval '1 day') AT TIME ZONE 'America/Monterrey';
$$;

GRANT EXECUTE ON FUNCTION public.session_day_start() TO authenticated;
GRANT EXECUTE ON FUNCTION public.session_day_end() TO authenticated;

-- ============================================================
-- 3. Helpers: current Supabase Auth session and when it signed in
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_auth_session_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SET search_path = public
AS $$
DECLARE v text := auth.jwt()->>'session_id';
BEGIN
  IF v IS NULL OR v = '' THEN RETURN NULL; END IF;
  RETURN v::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION public.current_auth_session_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_auth_session_id() TO authenticated;

-- Sign-in time of the current login: the Auth session's creation time when readable, and never
-- later than the first app session recorded for it.
CREATE OR REPLACE FUNCTION public.current_auth_login_at()
RETURNS timestamptz
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sid   uuid := public.current_auth_session_id();
  v_auth  timestamptz;
  v_first timestamptz;
BEGIN
  IF v_sid IS NULL OR auth.uid() IS NULL THEN RETURN NULL; END IF;

  BEGIN
    EXECUTE 'SELECT s.created_at FROM auth.sessions s WHERE s.id = $1 AND s.user_id = $2'
      INTO v_auth USING v_sid, auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_auth := NULL; -- auth.sessions not readable: fall back to our own records
  END;

  SELECT min(us.started_at) INTO v_first
  FROM public.user_sessions us
  WHERE us.auth_session_id = v_sid AND us.user_id = auth.uid();

  RETURN LEAST(v_auth, v_first); -- LEAST ignores NULLs
END; $$;
REVOKE ALL ON FUNCTION public.current_auth_login_at() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_auth_login_at() TO authenticated;

-- ============================================================
-- 4. start_session: refuse to restart an expired login (returns NULL)
-- ============================================================
CREATE OR REPLACE FUNCTION public.start_session(p_login_id bigint DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id       uuid;
  v_auth     uuid        := public.current_auth_session_id();
  v_login_at timestamptz := public.current_auth_login_at();
  v_timeout  integer     := public.current_session_timeout_minutes();
  v_last     timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- a) Daily cut-off: this login is from before today's midnight
  IF v_login_at IS NOT NULL AND v_login_at < public.session_day_start() THEN
    UPDATE public.user_sessions SET ended_at = now(), end_reason = 'midnight'
    WHERE user_id = auth.uid() AND auth_session_id = v_auth AND ended_at IS NULL;
    RETURN NULL;
  END IF;

  IF v_auth IS NOT NULL THEN
    -- b) This login already had an app session that ended (timeout, admin, logout, midnight)
    IF EXISTS (SELECT 1 FROM public.user_sessions
               WHERE user_id = auth.uid() AND auth_session_id = v_auth AND ended_at IS NOT NULL) THEN
      RETURN NULL;
    END IF;

    -- c) This login has been inactive longer than the profile timeout
    SELECT max(last_activity_at) INTO v_last FROM public.user_sessions
    WHERE user_id = auth.uid() AND auth_session_id = v_auth;
    IF v_last IS NOT NULL AND v_last < now() - make_interval(mins => v_timeout) THEN
      UPDATE public.user_sessions SET ended_at = now(), end_reason = 'timeout'
      WHERE user_id = auth.uid() AND auth_session_id = v_auth AND ended_at IS NULL;
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.user_sessions (user_id, login_id, auth_session_id)
  VALUES (auth.uid(),
          (SELECT id FROM public.login_history WHERE id = p_login_id AND user_id = auth.uid()),
          v_auth)
  RETURNING session_id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE ALL ON FUNCTION public.start_session(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_session(bigint) TO authenticated;

-- ============================================================
-- 5. touch_session: inactivity + daily cut-off, with reason and next cut-off
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row     public.user_sessions%ROWTYPE;
  v_timeout integer := public.current_session_timeout_minutes();
  v_auth    uuid    := public.current_auth_session_id();
BEGIN
  SELECT * INTO v_row FROM public.user_sessions
  WHERE session_id = p_session_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'timeout_minutes', v_timeout, 'reason', 'not_found');
  END IF;

  -- The stored id belongs to a previous login of the same user on this browser
  IF v_row.auth_session_id IS NOT NULL AND v_auth IS NOT NULL AND v_row.auth_session_id <> v_auth THEN
    RETURN jsonb_build_object('valid', false, 'timeout_minutes', v_timeout, 'reason', 'stale');
  END IF;

  IF v_row.ended_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'timeout_minutes', v_timeout,
                              'reason', CASE WHEN v_row.end_reason = 'midnight' THEN 'midnight' ELSE 'ended' END);
  END IF;

  IF v_row.started_at < public.session_day_start() THEN
    UPDATE public.user_sessions SET ended_at = now(), end_reason = 'midnight'
    WHERE session_id = p_session_id;
    RETURN jsonb_build_object('valid', false, 'timeout_minutes', v_timeout, 'reason', 'midnight');
  END IF;

  IF v_row.last_activity_at < now() - make_interval(mins => v_timeout) THEN
    UPDATE public.user_sessions SET ended_at = now(), end_reason = 'timeout'
    WHERE session_id = p_session_id;
    RETURN jsonb_build_object('valid', false, 'timeout_minutes', v_timeout, 'reason', 'timeout');
  END IF;

  UPDATE public.user_sessions SET last_activity_at = now() WHERE session_id = p_session_id;
  RETURN jsonb_build_object(
    'valid', true,
    'timeout_minutes', v_timeout,
    'expires_at', now() + make_interval(mins => v_timeout),
    'day_ends_at', public.session_day_end()
  );
END; $$;
REVOKE ALL ON FUNCTION public.touch_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_session(uuid) TO authenticated;

-- ============================================================
-- 6. end_session: accept 'midnight'
-- ============================================================
CREATE OR REPLACE FUNCTION public.end_session(p_session_id uuid, p_reason text DEFAULT 'logout')
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_reason NOT IN ('logout','timeout','midnight') THEN RAISE EXCEPTION 'Invalid end reason'; END IF;
  UPDATE public.user_sessions SET ended_at = now(), end_reason = p_reason
  WHERE session_id = p_session_id AND user_id = auth.uid() AND ended_at IS NULL;
END; $$;
REVOKE ALL ON FUNCTION public.end_session(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_session(uuid, text) TO authenticated;

-- ============================================================
-- 7. is_session_valid: also false after the daily cut-off
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_session_valid(p_session_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_sessions s
    WHERE s.session_id = p_session_id
      AND s.user_id = auth.uid()
      AND s.ended_at IS NULL
      AND s.started_at >= public.session_day_start()
      AND s.last_activity_at >= now() - make_interval(mins => public.current_session_timeout_minutes())
  );
$$;
REVOKE ALL ON FUNCTION public.is_session_valid(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_session_valid(uuid) TO authenticated;
