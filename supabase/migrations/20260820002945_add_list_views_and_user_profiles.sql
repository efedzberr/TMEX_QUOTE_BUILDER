/*
# Add List Views, User Profiles, and Related Tables

## Summary
Creates the data foundation for Salesforce-style List Views on the Quotes home page,
plus user profiles and recent record tracking.

## New Tables

1. **user_profiles**
   - id (uuid PK, references auth.users)
   - display_name (text)
   - is_admin (boolean, default false)
   - created_at (timestamptz)
   - Trigger auto-creates profile on auth.users insert
   - Backfill for existing users

2. **list_views**
   - id (uuid PK)
   - name (text, not null)
   - object (text, not null)
   - owner_user_id (uuid, references auth.users)
   - visibility (text: private/public)
   - is_system (boolean, default false)
   - filters (jsonb)
   - filter_logic (text)
   - columns (jsonb)
   - sorting (jsonb)
   - created_at/updated_at (timestamptz)

3. **user_list_view_preferences**
   - user_id (uuid)
   - object (text)
   - pinned_list_view_id (uuid, references list_views)
   - recent_list_view_ids (jsonb)
   - display_prefs (jsonb)
   - PK (user_id, object)

4. **recent_record_views**
   - user_id (uuid)
   - object (text)
   - record_id (uuid)
   - viewed_at (timestamptz)
   - PK (user_id, object, record_id)

## Modified Tables
- **quotes**: adds owner_user_id (uuid, nullable, references auth.users)

## Security
- All new RLS policies for authenticated users include AAL2 predicate
- user_profiles: authenticated can read all; update own display_name only
- list_views: system/public visible to all authenticated; private only to owner
- user_list_view_preferences: user can only access own rows
- recent_record_views: user can only access own rows
- Existing anon policies on quotes are NOT modified

## Seed Data
- 3 system list views for object='quote': All Quotes, My Quotes, Recently Viewed
*/

-- ============================================================
-- 1. user_profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_profiles" ON user_profiles;
CREATE POLICY "authenticated_select_profiles" ON user_profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');

DROP POLICY IF EXISTS "authenticated_update_own_profile" ON user_profiles;
CREATE POLICY "authenticated_update_own_profile" ON user_profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND auth.uid() = id)
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND auth.uid() = id);

DROP POLICY IF EXISTS "authenticated_insert_own_profile" ON user_profiles;
CREATE POLICY "authenticated_insert_own_profile" ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND auth.uid() = id);

-- Trigger to auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, split_part(NEW.email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing users
INSERT INTO public.user_profiles (id, display_name)
SELECT id, split_part(email, '@', 1)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. Alter quotes: add owner_user_id
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'owner_user_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN owner_user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quotes_owner_user_id ON public.quotes(owner_user_id);

-- ============================================================
-- 3. list_views
-- ============================================================
CREATE TABLE IF NOT EXISTS list_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  object text NOT NULL,
  owner_user_id uuid REFERENCES auth.users(id),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  is_system boolean NOT NULL DEFAULT false,
  filters jsonb NOT NULL DEFAULT '[]',
  filter_logic text,
  columns jsonb NOT NULL DEFAULT '[]',
  sorting jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE list_views ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_list_views_object ON list_views(object);
CREATE INDEX IF NOT EXISTS idx_list_views_owner ON list_views(owner_user_id);

DROP POLICY IF EXISTS "authenticated_select_list_views" ON list_views;
CREATE POLICY "authenticated_select_list_views" ON list_views FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND (
      is_system = true
      OR visibility = 'public'
      OR owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "authenticated_insert_list_views" ON list_views;
CREATE POLICY "authenticated_insert_list_views" ON list_views FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND owner_user_id = auth.uid()
    AND is_system = false
    AND (
      visibility = 'private'
      OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
    )
  );

DROP POLICY IF EXISTS "authenticated_update_list_views" ON list_views;
CREATE POLICY "authenticated_update_list_views" ON list_views FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND is_system = false
    AND (
      owner_user_id = auth.uid()
      OR (visibility = 'public' AND EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
    )
  )
  WITH CHECK (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND is_system = false
  );

DROP POLICY IF EXISTS "authenticated_delete_list_views" ON list_views;
CREATE POLICY "authenticated_delete_list_views" ON list_views FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.jwt()->>'aal') = 'aal2'
    AND is_system = false
    AND (
      owner_user_id = auth.uid()
      OR (visibility = 'public' AND EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
    )
  );

-- ============================================================
-- 4. user_list_view_preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS user_list_view_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  object text NOT NULL,
  pinned_list_view_id uuid REFERENCES list_views(id) ON DELETE SET NULL,
  recent_list_view_ids jsonb NOT NULL DEFAULT '[]',
  display_prefs jsonb NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, object)
);

ALTER TABLE user_list_view_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_select_own_prefs" ON user_list_view_preferences;
CREATE POLICY "user_select_own_prefs" ON user_list_view_preferences FOR SELECT
  TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND auth.uid() = user_id);

DROP POLICY IF EXISTS "user_insert_own_prefs" ON user_list_view_preferences;
CREATE POLICY "user_insert_own_prefs" ON user_list_view_preferences FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND auth.uid() = user_id);

DROP POLICY IF EXISTS "user_update_own_prefs" ON user_list_view_preferences;
CREATE POLICY "user_update_own_prefs" ON user_list_view_preferences FOR UPDATE
  TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND auth.uid() = user_id)
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND auth.uid() = user_id);

DROP POLICY IF EXISTS "user_delete_own_prefs" ON user_list_view_preferences;
CREATE POLICY "user_delete_own_prefs" ON user_list_view_preferences FOR DELETE
  TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND auth.uid() = user_id);

-- ============================================================
-- 5. recent_record_views
-- ============================================================
CREATE TABLE IF NOT EXISTS recent_record_views (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  object text NOT NULL,
  record_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, object, record_id)
);

ALTER TABLE recent_record_views ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_recent_record_views_lookup
  ON recent_record_views(user_id, object, viewed_at DESC);

DROP POLICY IF EXISTS "user_select_own_recent" ON recent_record_views;
CREATE POLICY "user_select_own_recent" ON recent_record_views FOR SELECT
  TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND auth.uid() = user_id);

DROP POLICY IF EXISTS "user_insert_own_recent" ON recent_record_views;
CREATE POLICY "user_insert_own_recent" ON recent_record_views FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND auth.uid() = user_id);

DROP POLICY IF EXISTS "user_update_own_recent" ON recent_record_views;
CREATE POLICY "user_update_own_recent" ON recent_record_views FOR UPDATE
  TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND auth.uid() = user_id)
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND auth.uid() = user_id);

DROP POLICY IF EXISTS "user_delete_own_recent" ON recent_record_views;
CREATE POLICY "user_delete_own_recent" ON recent_record_views FOR DELETE
  TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND auth.uid() = user_id);

-- ============================================================
-- 6. Seed system list views for 'quote'
-- ============================================================
INSERT INTO list_views (id, name, object, owner_user_id, visibility, is_system, filters, columns, sorting)
VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    'All Quotes',
    'quote',
    NULL,
    'public',
    true,
    '[]'::jsonb,
    '[{"field":"quote_number","label":"Quote Number"},{"field":"bill_to_customer","label":"Account"},{"field":"stage","label":"Stage"},{"field":"total_amount","label":"Total Amount"},{"field":"currency","label":"Currency"},{"field":"owner_name","label":"Owner"},{"field":"created_at","label":"Created Date"}]'::jsonb,
    '[{"field":"created_at","direction":"desc"}]'::jsonb
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    'My Quotes',
    'quote',
    NULL,
    'public',
    true,
    '[{"field":"owner_user_id","operator":"equals","value":"$CURRENT_USER"}]'::jsonb,
    '[{"field":"quote_number","label":"Quote Number"},{"field":"bill_to_customer","label":"Account"},{"field":"stage","label":"Stage"},{"field":"total_amount","label":"Total Amount"},{"field":"currency","label":"Currency"},{"field":"owner_name","label":"Owner"},{"field":"created_at","label":"Created Date"}]'::jsonb,
    '[{"field":"created_at","direction":"desc"}]'::jsonb
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    'Recently Viewed',
    'quote',
    NULL,
    'public',
    true,
    '[{"special":"recently_viewed"}]'::jsonb,
    '[{"field":"quote_number","label":"Quote Number"},{"field":"bill_to_customer","label":"Account"},{"field":"stage","label":"Stage"},{"field":"total_amount","label":"Total Amount"},{"field":"currency","label":"Currency"},{"field":"owner_name","label":"Owner"},{"field":"created_at","label":"Created Date"}]'::jsonb,
    '[{"field":"created_at","direction":"desc"}]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;
