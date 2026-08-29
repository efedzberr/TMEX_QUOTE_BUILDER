/*
# KPI Sets (shared, named KPI strips defined per profile) + user phone

## New
- kpi_sets: id, object, name, description, is_default (exactly one default per object), created_by.
- kpi_tiles.set_id: a tile belongs to a set OR to a user (owner_user_id), never both. Max 8 per set.
- profiles.default_kpi_set_id: default set for users of that profile (optional).
- user_profiles.phone.
- has_permission(key, level): SECURITY DEFINER helper used by RLS (profile_permissions of the caller; admins always true).
- Permission key module.kpi_sets ("KPI Sets") granted to Full Access.
- Seed: set "Default KPIs" (is_default) with tiles for the 3 system views.

## RLS
- kpi_sets: readable by all authenticated (AAL2); insert/update/delete require has_permission('module.kpi_sets').
- kpi_tiles: set tiles readable by all; writable with has_permission('module.kpi_sets'). Personal tiles unchanged.
*/

-- ============================================================
-- 1. has_permission helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_permission(p_key text, p_level text DEFAULT 'view')
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
    FROM public.user_profiles p WHERE p.id = auth.uid()
  ), false);
$$;
REVOKE ALL ON FUNCTION public.has_permission(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(text, text) TO authenticated;

INSERT INTO public.profile_permissions (profile_id, permission_key, can_view, can_create, can_edit, can_delete)
VALUES ('b0000000-0000-0000-0000-000000000001', 'module.kpi_sets', true, true, true, true)
ON CONFLICT (profile_id, permission_key) DO NOTHING;

-- ============================================================
-- 2. kpi_sets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kpi_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  object text NOT NULL DEFAULT 'quote',
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  description text,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (object, name)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kpi_sets_default_per_object ON public.kpi_sets(object) WHERE is_default;

ALTER TABLE public.kpi_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "kpi_sets_select" ON public.kpi_sets;
CREATE POLICY "kpi_sets_select" ON public.kpi_sets FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');
DROP POLICY IF EXISTS "kpi_sets_write" ON public.kpi_sets;
CREATE POLICY "kpi_sets_write" ON public.kpi_sets FOR ALL TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('module.kpi_sets'))
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('module.kpi_sets'));

-- The default set cannot be deleted
CREATE OR REPLACE FUNCTION public.trg_kpi_sets_prevent_default_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.is_default THEN RAISE EXCEPTION 'The default KPI set cannot be deleted. Make another set the default first.'; END IF;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS kpi_sets_prevent_default_delete ON public.kpi_sets;
CREATE TRIGGER kpi_sets_prevent_default_delete BEFORE DELETE ON public.kpi_sets
  FOR EACH ROW EXECUTE FUNCTION public.trg_kpi_sets_prevent_default_delete();

-- Setting a set as default clears the previous default (same object)
CREATE OR REPLACE FUNCTION public.trg_kpi_sets_single_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.is_default THEN
    UPDATE public.kpi_sets SET is_default = false WHERE object = NEW.object AND id <> NEW.id AND is_default;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS kpi_sets_single_default ON public.kpi_sets;
CREATE TRIGGER kpi_sets_single_default BEFORE INSERT OR UPDATE ON public.kpi_sets
  FOR EACH ROW EXECUTE FUNCTION public.trg_kpi_sets_single_default();

-- ============================================================
-- 3. kpi_tiles.set_id + policies for set tiles
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='kpi_tiles' AND column_name='set_id') THEN
    ALTER TABLE public.kpi_tiles ADD COLUMN set_id uuid REFERENCES public.kpi_sets(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_kpi_tiles_set ON public.kpi_tiles(set_id, position);
ALTER TABLE public.kpi_tiles DROP CONSTRAINT IF EXISTS kpi_tiles_owner_or_set;
ALTER TABLE public.kpi_tiles ADD CONSTRAINT kpi_tiles_owner_or_set
  CHECK ((owner_user_id IS NOT NULL AND set_id IS NULL) OR (owner_user_id IS NULL AND set_id IS NOT NULL));

-- Max 8 per strip: personal (owner) or set
CREATE OR REPLACE FUNCTION public.trg_kpi_tiles_max_eight()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.kpi_tiles t
  WHERE t.object = NEW.object
    AND t.owner_user_id IS NOT DISTINCT FROM NEW.owner_user_id
    AND t.set_id IS NOT DISTINCT FROM NEW.set_id
    AND t.id <> NEW.id;
  IF v_count >= 8 THEN RAISE EXCEPTION 'Maximum of 8 KPI tiles per strip reached'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS kpi_tiles_max_eight ON public.kpi_tiles;
CREATE TRIGGER kpi_tiles_max_eight BEFORE INSERT OR UPDATE OF owner_user_id, set_id, object ON public.kpi_tiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_kpi_tiles_max_eight();

-- Replace tile policies: personal (owner) unchanged; set tiles readable by all, writable with permission
DROP POLICY IF EXISTS "kpi_tiles_select" ON public.kpi_tiles;
CREATE POLICY "kpi_tiles_select" ON public.kpi_tiles FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND (owner_user_id = auth.uid() OR set_id IS NOT NULL));
DROP POLICY IF EXISTS "kpi_tiles_insert" ON public.kpi_tiles;
CREATE POLICY "kpi_tiles_insert" ON public.kpi_tiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2'
    AND ((owner_user_id = auth.uid()) OR (set_id IS NOT NULL AND public.has_permission('module.kpi_sets'))));
DROP POLICY IF EXISTS "kpi_tiles_update" ON public.kpi_tiles;
CREATE POLICY "kpi_tiles_update" ON public.kpi_tiles FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2'
    AND ((owner_user_id = auth.uid()) OR (set_id IS NOT NULL AND public.has_permission('module.kpi_sets'))))
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2'
    AND ((owner_user_id = auth.uid()) OR (set_id IS NOT NULL AND public.has_permission('module.kpi_sets'))));
DROP POLICY IF EXISTS "kpi_tiles_delete" ON public.kpi_tiles;
CREATE POLICY "kpi_tiles_delete" ON public.kpi_tiles FOR DELETE TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2'
    AND ((owner_user_id = auth.uid()) OR (set_id IS NOT NULL AND public.has_permission('module.kpi_sets'))));

-- ============================================================
-- 4. profiles.default_kpi_set_id, user_profiles.phone
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='default_kpi_set_id') THEN
    ALTER TABLE public.profiles ADD COLUMN default_kpi_set_id uuid REFERENCES public.kpi_sets(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_profiles' AND column_name='phone') THEN
    ALTER TABLE public.user_profiles ADD COLUMN phone text;
  END IF;
END $$;

-- Users with the KPI Sets permission may assign default sets to profiles (only that column matters here;
-- the existing admin-only update policy still governs the rest)
DROP POLICY IF EXISTS "profiles_update_kpi_default" ON public.profiles;
CREATE POLICY "profiles_update_kpi_default" ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('module.kpi_sets'))
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('module.kpi_sets'));

-- ============================================================
-- 5. Seed the system default set
-- ============================================================
INSERT INTO public.kpi_sets (id, object, name, description, is_default)
VALUES ('e0000000-0000-0000-0000-000000000001', 'quote', 'Default KPIs', 'System default. Shown to users who have not chosen a set.', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kpi_tiles (object, set_id, list_view_id, title, color, align, position)
SELECT 'quote', 'e0000000-0000-0000-0000-000000000001', v.id, v.name, c.color, 'left', c.pos
FROM (VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, 1, 0),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 0, 1),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 6, 2)
) AS c(view_id, color, pos)
JOIN public.list_views v ON v.id = c.view_id
WHERE NOT EXISTS (SELECT 1 FROM public.kpi_tiles t WHERE t.set_id = 'e0000000-0000-0000-0000-000000000001');