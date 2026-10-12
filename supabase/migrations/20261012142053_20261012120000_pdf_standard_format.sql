/*
# Global standard PDF format for quotes

1. New table `pdf_standard_format`: a single row (singleton) holding the admin-managed
   content of the quote PDF (title bar, header, banner, footer) as JSON.
2. RLS: any MFA-authenticated user can read it; only users with admin.pdf_format (edit) can change it.
3. New permission key admin.pdf_format granted to the Full Access system profile.
*/

CREATE TABLE IF NOT EXISTS public.pdf_standard_format (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton = true),
  config_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.pdf_standard_format ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pdf_standard_format_select" ON public.pdf_standard_format;
CREATE POLICY "pdf_standard_format_select" ON public.pdf_standard_format FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');

DROP POLICY IF EXISTS "pdf_standard_format_insert" ON public.pdf_standard_format;
CREATE POLICY "pdf_standard_format_insert" ON public.pdf_standard_format FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('admin.pdf_format', 'edit'));

DROP POLICY IF EXISTS "pdf_standard_format_update" ON public.pdf_standard_format;
CREATE POLICY "pdf_standard_format_update" ON public.pdf_standard_format FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('admin.pdf_format', 'edit'))
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('admin.pdf_format', 'edit'));

INSERT INTO public.pdf_standard_format (singleton, config_data)
VALUES (true, '{}'::jsonb)
ON CONFLICT (singleton) DO NOTHING;

INSERT INTO public.profile_permissions (profile_id, permission_key, can_view, can_create, can_edit, can_delete)
VALUES ('b0000000-0000-0000-0000-000000000001', 'admin.pdf_format', true, true, true, true)
ON CONFLICT (profile_id, permission_key) DO NOTHING;
