/*
  # Fix Security Issues: Indexes, RLS Performance, and Policy Cleanup

  1. Indexes
    - Add index on `lane_accessorials.lane_id` for FK `lane_accessorials_lane_id_fkey`
    - Add index on `lane_accessorials.accessorial_id` for FK `lane_accessorials_accessorial_id_fkey`

  2. RLS Performance (terms_conditions)
    - Replace `auth.uid()` with `(select auth.uid())` in all authenticated policies
      to avoid re-evaluating per row

  3. Duplicate Policy Cleanup
    - `accounts`: Remove overlapping authenticated-only policies when broader
      anon+authenticated policies already exist
    - `opportunities`: Remove duplicate `Users can read all opportunities` (public)
      since `Authenticated users can view all opportunities` covers authenticated
    - `partners`: Remove duplicate `Users can read all partners` (public)
      since `Authenticated users can view all partners` covers authenticated
    - `quotes`: Remove duplicate `Users can read all quotes` (public)
      since `Authenticated users can view all quotes` covers authenticated
      and `Anon can read quotes by review_token` covers anon

  4. Important Notes
    - No data is modified; only indexes and policies are changed
    - The app uses anon key access, so anon+authenticated policies are preserved
    - All tables retain full CRUD access as before, just without redundant overlapping policies
*/

-- ============================================================
-- 1. Add missing FK indexes on lane_accessorials
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_lane_accessorials_lane_id
  ON public.lane_accessorials (lane_id);

CREATE INDEX IF NOT EXISTS idx_lane_accessorials_accessorial_id
  ON public.lane_accessorials (accessorial_id);


-- ============================================================
-- 2. Fix terms_conditions RLS auth initialization
--    Replace auth.uid() with (select auth.uid()) for performance
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can read terms_conditions" ON public.terms_conditions;
CREATE POLICY "Authenticated users can read terms_conditions"
  ON public.terms_conditions
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert terms_conditions" ON public.terms_conditions;
CREATE POLICY "Authenticated users can insert terms_conditions"
  ON public.terms_conditions
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update terms_conditions" ON public.terms_conditions;
CREATE POLICY "Authenticated users can update terms_conditions"
  ON public.terms_conditions
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete terms_conditions" ON public.terms_conditions;
CREATE POLICY "Authenticated users can delete terms_conditions"
  ON public.terms_conditions
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);


-- ============================================================
-- 3. Remove duplicate/redundant policies on accounts
--    Keep the broader "Public can ..." (anon,authenticated) policies
--    and remove the narrower "Authenticated users can ..." duplicates
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can view all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users can read all accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can create accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated users can delete accounts" ON public.accounts;


-- ============================================================
-- 4. Remove duplicate SELECT policies on opportunities
--    Keep "Authenticated users can view all opportunities"
--    Remove the redundant public role policy
-- ============================================================

DROP POLICY IF EXISTS "Users can read all opportunities" ON public.opportunities;


-- ============================================================
-- 5. Remove duplicate SELECT policies on partners
--    Keep "Authenticated users can view all partners"
--    Remove the redundant public role policy
-- ============================================================

DROP POLICY IF EXISTS "Users can read all partners" ON public.partners;


-- ============================================================
-- 6. Remove duplicate SELECT policies on quotes
--    Keep "Authenticated users can view all quotes" for authenticated
--    Keep "Anon can read quotes by review_token" for anon portal access
--    Remove the overly broad "Users can read all quotes" (public/true)
-- ============================================================

DROP POLICY IF EXISTS "Users can read all quotes" ON public.quotes;
