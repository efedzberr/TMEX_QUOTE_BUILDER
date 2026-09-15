/*
  # Password policy helpers

  - get_password_policy(): readable by ANY authenticated user regardless of AAL (invite and
    recovery sessions are aal1 and must still see the rules). Contains no sensitive data.
  - my_password_status(): tells the current user whether they must change their password
    (admin flag or expiration). Used by the app in the next step.
  - service_role may call activity_write() so the Edge Function can log "Password Changed".
*/

CREATE OR REPLACE FUNCTION public.get_password_policy()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'expiration_days',    p.expiration_days,
    'history_count',      p.history_count,
    'min_length',         p.min_length,
    'complexity',         p.complexity,
    'max_login_attempts', p.max_login_attempts,
    'lockout_minutes',    p.lockout_minutes,
    'disallow_username',  p.disallow_username
  ) FROM public.password_policies p WHERE p.id = 1;
$$;
REVOKE ALL ON FUNCTION public.get_password_policy() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_password_policy() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_password_status()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE s record; p record; v_expired boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('must_change', false, 'expired', false); END IF;
  SELECT * INTO s FROM public.user_security WHERE user_id = auth.uid();
  SELECT * INTO p FROM public.password_policies WHERE id = 1;
  IF s IS NOT NULL AND p.expiration_days IS NOT NULL THEN
    v_expired := s.password_changed_at < now() - make_interval(days => p.expiration_days);
  END IF;
  RETURN jsonb_build_object(
    'must_change', COALESCE(s.must_change_password, false),
    'expired', v_expired,
    'password_changed_at', s.password_changed_at
  );
END; $$;
REVOKE ALL ON FUNCTION public.my_password_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_password_status() TO authenticated;

GRANT EXECUTE ON FUNCTION public.activity_write(uuid, text, text, text, uuid, text, text, uuid, text) TO service_role;