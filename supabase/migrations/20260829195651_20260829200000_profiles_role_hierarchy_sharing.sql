/*
# Profiles, Role Hierarchy and Record Sharing (Salesforce-style)

## Renames (data preserved)
- roles            -> profiles            (what a user can see / do)
- role_permissions -> profile_permissions (+ can_create)
- user_profiles.role_id -> user_profiles.profile_id

## New
- profile_object_access (profile_id, object, view_all, modify_all): bypass the hierarchy per object.
- roles: the hierarchy. name, parent_id (tree, no cycles), description.
- user_profiles.role_id: position in the hierarchy (NULL = sees own records only).
- sharing_defaults (object, default_access): private | public_read | public_read_write.
  Seeded: quote = public_read_write (deliberately: nobody has a role yet, so Private would hide
  every quote that is not yours). Switch to private from Admin once roles are assigned.

## Access functions (SECURITY DEFINER, STABLE)
- is_admin()
- role_is_descendant(child, ancestor)
- user_can_view_owner(owner, object) / user_can_edit_owner(owner, object)
  owner NULL -> shared; owner = me; admin; public default; profile View All / Modify All;
  owner's role below my role (read + write).

## RLS
Only ADDS RESTRICTIVE policies for role `authenticated` on quotes, quote_lanes, quote_history,
quote_stage_events. No existing policy is dropped or modified; anon (customer portal) and the
service role (edge functions) are unaffected.

## Owner backfill
quotes.owner_user_id is set from user_profiles.display_name matching quotes.owner_name
(case/space-insensitive). Non-matching quotes keep their current value.
*/

-- ============================================================
-- 0. Helper: is_admin (idempotent re-declaration)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT p.is_admin FROM public.user_profiles p WHERE p.id = auth.uid()), false); $$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- 1. Rename roles -> profiles, role_permissions -> profile_permissions
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='roles')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='profiles') THEN
    ALTER TABLE public.roles RENAME TO profiles;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='role_permissions') THEN
    ALTER TABLE public.role_permissions RENAME TO profile_permissions;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profile_permissions' AND column_name='role_id') THEN
    ALTER TABLE public.profile_permissions RENAME COLUMN role_id TO profile_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profile_permissions' AND column_name='can_create') THEN
    ALTER TABLE public.profile_permissions ADD COLUMN can_create boolean NOT NULL DEFAULT false;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='role_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='profile_id') THEN
    ALTER TABLE public.user_profiles RENAME COLUMN role_id TO profile_id;
  END IF;
END $$;

-- Full Access gets can_create everywhere
UPDATE public.profile_permissions SET can_create = true
WHERE profile_id = 'b0000000-0000-0000-0000-000000000001';

-- Old trigger referenced user_profiles.role_id: redefine against profile_id
DROP TRIGGER IF EXISTS roles_prevent_delete ON public.profiles;
DROP FUNCTION IF EXISTS public.trg_roles_prevent_delete();
CREATE OR REPLACE FUNCTION public.trg_profiles_prevent_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_users integer;
BEGIN
  IF OLD.is_system THEN RAISE EXCEPTION 'System profiles cannot be deleted'; END IF;
  SELECT COUNT(*) INTO v_users FROM public.user_profiles WHERE profile_id = OLD.id;
  IF v_users > 0 THEN RAISE EXCEPTION 'Profile is assigned to % user(s) and cannot be deleted', v_users; END IF;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS profiles_prevent_delete ON public.profiles;
CREATE TRIGGER profiles_prevent_delete BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_profiles_prevent_delete();

-- Re-create policies on the renamed tables using is_admin() (drop old-named ones)
DROP POLICY IF EXISTS "roles_select" ON public.profiles;
DROP POLICY IF EXISTS "roles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "roles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "roles_delete_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND is_system = false AND public.is_admin());
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND is_system = false AND public.is_admin())
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND is_system = false);
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND is_system = false AND public.is_admin());

DROP POLICY IF EXISTS "role_permissions_select" ON public.profile_permissions;
DROP POLICY IF EXISTS "role_permissions_write_admin" ON public.profile_permissions;
DROP POLICY IF EXISTS "profile_permissions_select" ON public.profile_permissions;
DROP POLICY IF EXISTS "profile_permissions_write_admin" ON public.profile_permissions;
CREATE POLICY "profile_permissions_select" ON public.profile_permissions FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');
CREATE POLICY "profile_permissions_write_admin" ON public.profile_permissions FOR ALL TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.is_admin()
         AND NOT EXISTS (SELECT 1 FROM public.profiles r WHERE r.id = profile_id AND r.is_system = true))
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.is_admin()
         AND NOT EXISTS (SELECT 1 FROM public.profiles r WHERE r.id = profile_id AND r.is_system = true));

-- ============================================================
-- 2. profile_object_access (View All / Modify All per object)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profile_object_access (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  object text NOT NULL,
  view_all boolean NOT NULL DEFAULT false,
  modify_all boolean NOT NULL DEFAULT false,
  PRIMARY KEY (profile_id, object)
);
ALTER TABLE public.profile_object_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile_object_access_select" ON public.profile_object_access;
CREATE POLICY "profile_object_access_select" ON public.profile_object_access FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');
DROP POLICY IF EXISTS "profile_object_access_write_admin" ON public.profile_object_access;
CREATE POLICY "profile_object_access_write_admin" ON public.profile_object_access FOR ALL TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.is_admin()
         AND NOT EXISTS (SELECT 1 FROM public.profiles r WHERE r.id = profile_id AND r.is_system = true))
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.is_admin()
         AND NOT EXISTS (SELECT 1 FROM public.profiles r WHERE r.id = profile_id AND r.is_system = true));

INSERT INTO public.profile_object_access (profile_id, object, view_all, modify_all)
VALUES ('b0000000-0000-0000-0000-000000000001', 'quote', true, true)
ON CONFLICT (profile_id, object) DO NOTHING;

-- ============================================================
-- 3. roles = hierarchy
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  parent_id uuid REFERENCES public.roles(id) ON DELETE RESTRICT,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_roles_parent ON public.roles(parent_id);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "roles_hierarchy_select" ON public.roles;
CREATE POLICY "roles_hierarchy_select" ON public.roles FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');
DROP POLICY IF EXISTS "roles_hierarchy_write_admin" ON public.roles;
CREATE POLICY "roles_hierarchy_write_admin" ON public.roles FOR ALL TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.is_admin())
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.is_admin());

-- No cycles; a role cannot be its own ancestor
CREATE OR REPLACE FUNCTION public.trg_roles_no_cycle()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_cur uuid := NEW.parent_id; v_depth integer := 0;
BEGIN
  NEW.updated_at := now();
  WHILE v_cur IS NOT NULL LOOP
    IF v_cur = NEW.id THEN RAISE EXCEPTION 'A role cannot be its own ancestor'; END IF;
    SELECT parent_id INTO v_cur FROM public.roles WHERE id = v_cur;
    v_depth := v_depth + 1;
    IF v_depth > 100 THEN RAISE EXCEPTION 'Role hierarchy too deep'; END IF;
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS roles_no_cycle ON public.roles;
CREATE TRIGGER roles_no_cycle BEFORE INSERT OR UPDATE OF parent_id ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_roles_no_cycle();

-- Cannot delete a role with users or child roles
CREATE OR REPLACE FUNCTION public.trg_roles_hierarchy_prevent_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_users integer; v_children integer;
BEGIN
  SELECT COUNT(*) INTO v_users FROM public.user_profiles WHERE role_id = OLD.id;
  IF v_users > 0 THEN RAISE EXCEPTION 'Role is assigned to % user(s) and cannot be deleted', v_users; END IF;
  SELECT COUNT(*) INTO v_children FROM public.roles WHERE parent_id = OLD.id;
  IF v_children > 0 THEN RAISE EXCEPTION 'Role has % child role(s) and cannot be deleted', v_children; END IF;
  RETURN OLD;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='role_id') THEN
    ALTER TABLE public.user_profiles ADD COLUMN role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_hier ON public.user_profiles(role_id);

DROP TRIGGER IF EXISTS roles_hierarchy_prevent_delete ON public.roles;
CREATE TRIGGER roles_hierarchy_prevent_delete BEFORE DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_roles_hierarchy_prevent_delete();

-- ============================================================
-- 4. sharing_defaults
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sharing_defaults (
  object text PRIMARY KEY,
  default_access text NOT NULL DEFAULT 'private' CHECK (default_access IN ('private', 'public_read', 'public_read_write')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sharing_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sharing_defaults_select" ON public.sharing_defaults;
CREATE POLICY "sharing_defaults_select" ON public.sharing_defaults FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');
DROP POLICY IF EXISTS "sharing_defaults_write_admin" ON public.sharing_defaults;
CREATE POLICY "sharing_defaults_write_admin" ON public.sharing_defaults FOR ALL TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.is_admin())
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.is_admin());

INSERT INTO public.sharing_defaults (object, default_access) VALUES ('quote', 'public_read_write')
ON CONFLICT (object) DO NOTHING;

-- ============================================================
-- 5. Access functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.role_is_descendant(p_child uuid, p_ancestor uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE up AS (
    SELECT id, parent_id, 0 AS depth FROM public.roles WHERE id = p_child
    UNION ALL
    SELECT r.id, r.parent_id, up.depth + 1 FROM public.roles r JOIN up ON r.id = up.parent_id WHERE up.depth < 100
  )
  SELECT p_child IS NOT NULL AND p_ancestor IS NOT NULL AND p_child <> p_ancestor
         AND EXISTS (SELECT 1 FROM up WHERE up.parent_id = p_ancestor);
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_owner(p_owner uuid, p_object text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_default text;
  v_my_profile uuid;
  v_my_role uuid;
  v_owner_role uuid;
BEGIN
  IF v_me IS NULL THEN RETURN false; END IF;
  IF p_owner IS NULL OR p_owner = v_me THEN RETURN true; END IF;
  IF public.is_admin() THEN RETURN true; END IF;
  SELECT default_access INTO v_default FROM public.sharing_defaults WHERE object = p_object;
  IF v_default IN ('public_read', 'public_read_write') THEN RETURN true; END IF;
  SELECT profile_id, role_id INTO v_my_profile, v_my_role FROM public.user_profiles WHERE id = v_me;
  IF v_my_profile IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.profile_object_access a WHERE a.profile_id = v_my_profile AND a.object = p_object AND (a.view_all OR a.modify_all)
     ) THEN RETURN true; END IF;
  IF v_my_role IS NULL THEN RETURN false; END IF;
  SELECT role_id INTO v_owner_role FROM public.user_profiles WHERE id = p_owner;
  RETURN public.role_is_descendant(v_owner_role, v_my_role);
END; $$;

CREATE OR REPLACE FUNCTION public.user_can_edit_owner(p_owner uuid, p_object text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_default text;
  v_my_profile uuid;
  v_my_role uuid;
  v_owner_role uuid;
BEGIN
  IF v_me IS NULL THEN RETURN false; END IF;
  IF p_owner IS NULL OR p_owner = v_me THEN RETURN true; END IF;
  IF public.is_admin() THEN RETURN true; END IF;
  SELECT default_access INTO v_default FROM public.sharing_defaults WHERE object = p_object;
  IF v_default = 'public_read_write' THEN RETURN true; END IF;
  SELECT profile_id, role_id INTO v_my_profile, v_my_role FROM public.user_profiles WHERE id = v_me;
  IF v_my_profile IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.profile_object_access a WHERE a.profile_id = v_my_profile AND a.object = p_object AND a.modify_all
     ) THEN RETURN true; END IF;
  IF v_my_role IS NULL THEN RETURN false; END IF;
  SELECT role_id INTO v_owner_role FROM public.user_profiles WHERE id = p_owner;
  RETURN public.role_is_descendant(v_owner_role, v_my_role);
END; $$;

REVOKE ALL ON FUNCTION public.role_is_descendant(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_view_owner(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_edit_owner(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.role_is_descendant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_view_owner(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_edit_owner(uuid, text) TO authenticated;

-- ============================================================
-- 6. my_permissions() v2 (profile_id, can_create)
-- ============================================================
DROP FUNCTION IF EXISTS public.my_permissions();
CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS TABLE(permission_key text, can_view boolean, can_create boolean, can_edit boolean, can_delete boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT pp.permission_key, pp.can_view, pp.can_create, pp.can_edit, pp.can_delete
  FROM public.user_profiles p
  JOIN public.profile_permissions pp
    ON pp.profile_id = CASE WHEN p.is_admin THEN 'b0000000-0000-0000-0000-000000000001'::uuid ELSE p.profile_id END
  WHERE p.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated;

CREATE OR REPLACE FUNCTION public.my_object_access()
RETURNS TABLE(object text, view_all boolean, modify_all boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT a.object, a.view_all, a.modify_all
  FROM public.user_profiles p
  JOIN public.profile_object_access a
    ON a.profile_id = CASE WHEN p.is_admin THEN 'b0000000-0000-0000-0000-000000000001'::uuid ELSE p.profile_id END
  WHERE p.id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.my_object_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_object_access() TO authenticated;

-- ============================================================
-- 7. RESTRICTIVE sharing policies (authenticated only; nothing dropped)
-- ============================================================
DROP POLICY IF EXISTS "sharing_quotes_select" ON public.quotes;
CREATE POLICY "sharing_quotes_select" ON public.quotes AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.user_can_view_owner(owner_user_id, 'quote'));
DROP POLICY IF EXISTS "sharing_quotes_update" ON public.quotes;
CREATE POLICY "sharing_quotes_update" ON public.quotes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.user_can_edit_owner(owner_user_id, 'quote'));
DROP POLICY IF EXISTS "sharing_quotes_delete" ON public.quotes;
CREATE POLICY "sharing_quotes_delete" ON public.quotes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.user_can_edit_owner(owner_user_id, 'quote'));
DROP POLICY IF EXISTS "sharing_quotes_insert" ON public.quotes;
CREATE POLICY "sharing_quotes_insert" ON public.quotes AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (owner_user_id IS NULL OR owner_user_id = auth.uid() OR public.is_admin()
              OR public.user_can_edit_owner(owner_user_id, 'quote'));

-- Children inherit from the quote (quotes is itself RLS-filtered inside the EXISTS)
DROP POLICY IF EXISTS "sharing_quote_lanes_select" ON public.quote_lanes;
CREATE POLICY "sharing_quote_lanes_select" ON public.quote_lanes AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id));
DROP POLICY IF EXISTS "sharing_quote_lanes_write" ON public.quote_lanes;
CREATE POLICY "sharing_quote_lanes_write" ON public.quote_lanes AS RESTRICTIVE FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND public.user_can_edit_owner(q.owner_user_id, 'quote')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id AND public.user_can_edit_owner(q.owner_user_id, 'quote')));

DROP POLICY IF EXISTS "sharing_quote_history_select" ON public.quote_history;
CREATE POLICY "sharing_quote_history_select" ON public.quote_history AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id));

DROP POLICY IF EXISTS "sharing_quote_stage_events_select" ON public.quote_stage_events;
CREATE POLICY "sharing_quote_stage_events_select" ON public.quote_stage_events AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_id));

-- ============================================================
-- 8. Owner backfill by display name
-- ============================================================
UPDATE public.quotes q
SET owner_user_id = p.id
FROM public.user_profiles p
WHERE p.display_name IS NOT NULL
  AND lower(regexp_replace(p.display_name, '\s+', ' ', 'g')) = lower(regexp_replace(COALESCE(q.owner_name, ''), '\s+', ' ', 'g'))
  AND (q.owner_user_id IS DISTINCT FROM p.id);