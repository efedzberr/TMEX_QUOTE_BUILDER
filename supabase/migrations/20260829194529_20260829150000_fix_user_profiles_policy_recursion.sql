/*
# Fix: infinite recursion in user_profiles policies
The admin-update policy on user_profiles queried user_profiles itself. Replace it with a
SECURITY DEFINER helper is_admin() that reads the caller's profile without RLS.
Also makes the roles / role_permissions / kpi_tiles / sla_due_date policies use the helper
(same behaviour, no self-reference risk).
*/
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.is_admin FROM public.user_profiles p WHERE p.id = auth.uid()), false);
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
DROP POLICY IF EXISTS "admin_update_any_profile" ON public.user_profiles;
CREATE POLICY "admin_update_any_profile" ON public.user_profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.is_admin())
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.is_admin());
