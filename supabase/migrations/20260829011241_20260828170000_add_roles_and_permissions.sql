/*
# Roles & Permissions foundation (Phase 1: view permissions, UI-enforced)

## New tables
- roles: id, name (unique), description, is_system
- role_permissions: (role_id, permission_key) -> can_view / can_edit / can_delete
  Phase 1 uses can_view only; can_edit / can_delete are reserved for later.

## Modified tables
- user_profiles: adds role_id (uuid, nullable, FK roles ON DELETE SET NULL).
  A user with role_id NULL sees Home only. is_admin bypasses everything.

## Seed
- System role "Full Access" (fixed id b0000000-0000-0000-0000-000000000001) with every
  permission key set to true. All existing user_profiles are backfilled to it.

## Functions
- my_permissions(): rows (permission_key, can_view, can_edit, can_delete) for the caller.
  Admins get the Full Access rows.
- Trigger: a role cannot be deleted while users are assigned to it; system roles cannot be deleted.

## Security
- roles / role_permissions: readable by all authenticated (AAL2); writable by admins only;
  system role rows are immutable.
- user_profiles: new policy lets admins update any profile (needed to assign role_id).
  Existing policies are not modified.
*/

-- ============================================================
-- 1. roles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select" ON public.roles;
CREATE POLICY "roles_select" ON public.roles FOR SELECT
  TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');

DROP POLICY IF EXISTS "roles_insert_admin" ON public.roles;
CREATE POLICY "roles_insert_admin" ON public.roles FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND is_system = false
    AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "roles_update_admin" ON public.roles;
CREATE POLICY "roles_update_admin" ON public.roles FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND is_system = false
    AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND is_system = false
  );

DROP POLICY IF EXISTS "roles_delete_admin" ON public.roles;
CREATE POLICY "roles_delete_admin" ON public.roles FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND is_system = false
    AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- ============================================================
-- 2. role_permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role_id, permission_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_permissions_select" ON public.role_permissions;
CREATE POLICY "role_permissions_select" ON public.role_permissions FOR SELECT
  TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');

DROP POLICY IF EXISTS "role_permissions_write_admin" ON public.role_permissions;
CREATE POLICY "role_permissions_write_admin" ON public.role_permissions FOR ALL
  TO authenticated
  USING (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
    AND NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.is_system = true)
  )
  WITH CHECK (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
    AND NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.is_system = true)
  );

-- ============================================================
-- 3. user_profiles.role_id + admin update policy
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'role_id'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role_id);

DROP POLICY IF EXISTS "admin_update_any_profile" ON public.user_profiles;
CREATE POLICY "admin_update_any_profile" ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- ============================================================
-- 4. Guard: cannot delete a role that has users; cannot delete system roles
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_roles_prevent_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_users integer;
BEGIN
  IF OLD.is_system THEN
    RAISE EXCEPTION 'System roles cannot be deleted';
  END IF;
  SELECT COUNT(*) INTO v_users FROM public.user_profiles WHERE role_id = OLD.id;
  IF v_users > 0 THEN
    RAISE EXCEPTION 'Role is assigned to % user(s) and cannot be deleted', v_users;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS roles_prevent_delete ON public.roles;
CREATE TRIGGER roles_prevent_delete
  BEFORE DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_roles_prevent_delete();

CREATE OR REPLACE FUNCTION public.trg_roles_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS roles_set_updated_at ON public.roles;
CREATE TRIGGER roles_set_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.trg_roles_set_updated_at();

-- ============================================================
-- 5. Seed "Full Access" + backfill existing users
-- ============================================================
INSERT INTO public.roles (id, name, description, is_system)
VALUES ('b0000000-0000-0000-0000-000000000001', 'Full Access', 'Can see every module and every section. System role.', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_key, can_view, can_edit, can_delete)
SELECT 'b0000000-0000-0000-0000-000000000001', k, true, true, true
FROM unnest(ARRAY[
  'module.quotes', 'module.mass_update', 'module.customers', 'module.dashboards', 'module.import',
  'admin.users', 'admin.cost_structure', 'admin.market_information', 'admin.account_lanes', 'admin.roles',
  'quote.header', 'quote.history', 'quote.tab_lanes', 'quote.tab_accessorials', 'quote.tab_terms', 'quote.tab_pdf'
]) AS k
ON CONFLICT (role_id, permission_key) DO NOTHING;

UPDATE public.user_profiles
SET role_id = 'b0000000-0000-0000-0000-000000000001'
WHERE role_id IS NULL;

-- ============================================================
-- 6. my_permissions()
-- ============================================================
CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS TABLE(permission_key text, can_view boolean, can_edit boolean, can_delete boolean)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT rp.permission_key, rp.can_view, rp.can_edit, rp.can_delete
  FROM public.user_profiles p
  JOIN public.role_permissions rp
    ON rp.role_id = CASE
      WHEN p.is_admin THEN 'b0000000-0000-0000-0000-000000000001'::uuid
      ELSE p.role_id
    END
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_permissions() TO authenticated;