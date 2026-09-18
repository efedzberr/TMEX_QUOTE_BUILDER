/*
  # Delegated administration

  Replaces is_admin() gates with has_permission(key, level) on:
  - profiles, profile_permissions, profile_object_access   -> admin.profiles (edit)
  - roles, sharing_defaults                                -> admin.roles (edit)
  - password_policies (update)                             -> admin.password_policies (edit)
  - login_history, user_sessions, user_activity_log (read all users) -> admin.security_logs (view)
  - set_profile_session_timeout                            -> admin.profiles (edit)
  - admin_unlock_user, admin_force_password_change, admin_end_user_sessions, admin_get_user_security -> admin.users (edit)
  Adds user_has_permission() for the admin-users Edge Function (service role only).
  New keys are granted to the Full Access profile. Mass Update / Update Log remain is_admin().
*/

-- New permission keys on Full Access
INSERT INTO public.profile_permissions (profile_id, permission_key, can_view, can_create, can_edit, can_delete)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'admin.password_policies', true, true, true, true),
  ('b0000000-0000-0000-0000-000000000001', 'admin.security_logs', true, true, true, true)
ON CONFLICT (profile_id, permission_key) DO NOTHING;

-- Service-role helper: permission check for an arbitrary user (used by Edge Functions)
CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id uuid, p_key text, p_level text DEFAULT 'view')
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN p.is_admin THEN true
      ELSE EXISTS (
        SELECT 1 FROM public.profile_permissions pp
        WHERE pp.profile_id = p.profile_id AND pp.permission_key = p_key
          AND CASE p_level
                WHEN 'create' THEN pp.can_create
                WHEN 'edit'   THEN pp.can_edit
                WHEN 'delete' THEN pp.can_delete
                ELSE pp.can_view END
      )
    END
    FROM public.user_profiles p WHERE p.id = p_user_id
  ), false);
$$;
REVOKE ALL ON FUNCTION public.user_has_permission(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission(uuid, text, text) TO service_role;

-- ---------- profiles / permissions / object access -> admin.profiles ----------
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND is_system = false AND public.has_permission('admin.profiles', 'edit'));
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND is_system = false AND public.has_permission('admin.profiles', 'edit'))
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND is_system = false AND public.has_permission('admin.profiles', 'edit'));
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND is_system = false AND public.has_permission('admin.profiles', 'edit'));

DROP POLICY IF EXISTS "profile_permissions_write_admin" ON public.profile_permissions;
CREATE POLICY "profile_permissions_write_admin" ON public.profile_permissions FOR ALL TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('admin.profiles', 'edit')
         AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.is_system = false))
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('admin.profiles', 'edit')
         AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.is_system = false));

DROP POLICY IF EXISTS "profile_object_access_write_admin" ON public.profile_object_access;
CREATE POLICY "profile_object_access_write_admin" ON public.profile_object_access FOR ALL TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('admin.profiles', 'edit')
         AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.is_system = false))
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('admin.profiles', 'edit')
         AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.is_system = false));

CREATE OR REPLACE FUNCTION public.set_profile_session_timeout(p_profile_id uuid, p_minutes integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (SELECT auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' THEN RAISE EXCEPTION 'MFA required'; END IF;
  IF NOT public.has_permission('admin.profiles', 'edit') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_minutes NOT IN (15, 30, 60, 120, 240) THEN RAISE EXCEPTION 'Invalid session timeout'; END IF;
  UPDATE public.profiles SET session_timeout_minutes = p_minutes WHERE id = p_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
END; $$;

-- ---------- roles / sharing -> admin.roles ----------
DROP POLICY IF EXISTS "roles_hierarchy_write_admin" ON public.roles;
CREATE POLICY "roles_hierarchy_write_admin" ON public.roles FOR ALL TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('admin.roles', 'edit'))
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('admin.roles', 'edit'));

DROP POLICY IF EXISTS "sharing_defaults_write_admin" ON public.sharing_defaults;
CREATE POLICY "sharing_defaults_write_admin" ON public.sharing_defaults FOR ALL TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('admin.roles', 'edit'))
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('admin.roles', 'edit'));

-- ---------- password policies -> admin.password_policies ----------
DROP POLICY IF EXISTS "password_policies_update_admin" ON public.password_policies;
CREATE POLICY "password_policies_update_admin" ON public.password_policies FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('admin.password_policies', 'edit'))
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('admin.password_policies', 'edit'));

-- ---------- security logs -> admin.security_logs (own rows always visible) ----------
DROP POLICY IF EXISTS "login_history_select" ON public.login_history;
CREATE POLICY "login_history_select" ON public.login_history FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND (user_id = auth.uid() OR public.has_permission('admin.security_logs', 'view')));
DROP POLICY IF EXISTS "user_sessions_select" ON public.user_sessions;
CREATE POLICY "user_sessions_select" ON public.user_sessions FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND (user_id = auth.uid() OR public.has_permission('admin.security_logs', 'view')));
DROP POLICY IF EXISTS "user_activity_log_select" ON public.user_activity_log;
CREATE POLICY "user_activity_log_select" ON public.user_activity_log FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND (user_id = auth.uid() OR public.has_permission('admin.security_logs', 'view')));

-- ---------- user security actions -> admin.users (edit) ----------
CREATE OR REPLACE FUNCTION public.admin_unlock_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' THEN RAISE EXCEPTION 'MFA required'; END IF;
  IF NOT public.has_permission('admin.users', 'edit') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.user_security (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.user_security
  SET failed_login_attempts = 0, locked_until = NULL, locked_forever = false, updated_at = now()
  WHERE user_id = p_user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_force_password_change(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' THEN RAISE EXCEPTION 'MFA required'; END IF;
  IF NOT public.has_permission('admin.users', 'edit') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT public.is_admin() AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id AND is_admin) THEN
    RAISE EXCEPTION 'Only administrators can act on administrator accounts';
  END IF;
  INSERT INTO public.user_security (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  UPDATE public.user_security SET must_change_password = true, updated_at = now() WHERE user_id = p_user_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_end_user_sessions(p_user_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF (SELECT auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' THEN RAISE EXCEPTION 'MFA required'; END IF;
  IF NOT public.has_permission('admin.users', 'edit') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT public.is_admin() AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_user_id AND is_admin) THEN
    RAISE EXCEPTION 'Only administrators can act on administrator accounts';
  END IF;
  UPDATE public.user_sessions SET ended_at = now(), end_reason = 'admin' WHERE user_id = p_user_id AND ended_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_get_user_security(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN public.has_permission('admin.users', 'view') AND (SELECT auth.jwt()->>'aal') = 'aal2' THEN
    (SELECT jsonb_build_object(
       'password_changed_at',   s.password_changed_at,
       'must_change_password',  s.must_change_password,
       'failed_login_attempts', s.failed_login_attempts,
       'locked_until',          s.locked_until,
       'locked_forever',        s.locked_forever,
       'last_login_at',         s.last_login_at,
       'active_sessions',       (SELECT COUNT(*) FROM public.user_sessions x WHERE x.user_id = s.user_id AND x.ended_at IS NULL)
     ) FROM public.user_security s WHERE s.user_id = p_user_id)
  ELSE NULL END;
$$;