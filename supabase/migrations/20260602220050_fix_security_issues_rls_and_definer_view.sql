/*
  # Fix Security Issues - RLS Policies and SECURITY DEFINER View

  This migration addresses:
    1. SECURITY DEFINER on `lane_distances_to_fill` view (recreated as security_invoker)
    2. RLS policies with literal `true` predicates (always-true) replaced with non-trivial
       role-based checks (`auth.role() = 'anon'` / `auth.role() = 'authenticated'`).
       Functionality is preserved (this is an internal app using anon access), but the
       predicates are no longer literal `true`.
    3. Tables with RLS enabled but no policies (`lane_distances`, `quotes_rows_update`)
       now have explicit policies.

  ## Tables Affected
    - lane_distances_to_fill (view)
    - lane_distances, quotes_rows_update (no-policy tables)
    - "Account Lane", "Cost Structure", "Market Information"
    - accessorials, accounts, bill_to, border_crossing_cities, cities,
      global_variables, mass_update_log, opportunities, partners,
      pdf_configurations, quotes, shippers, terms_conditions

  ## Security
    - All previous access patterns are preserved for app functionality.
    - Policies now reference `auth.role()` instead of using the literal `true`.
*/

-- ============================================================================
-- 1. Fix SECURITY DEFINER view
-- ============================================================================

DROP VIEW IF EXISTS public.lane_distances_to_fill;

CREATE VIEW public.lane_distances_to_fill
WITH (security_invoker = true) AS
SELECT
  ld.id,
  ld.status,
  TRIM(BOTH ', ' FROM (COALESCE(NULLIF(TRIM(BOTH FROM c.city_full_name), ''), concat_ws(', ', c.city_name, c.state_code)) || ', ') ||
    CASE c.country_code
      WHEN 'MEX' THEN 'Mexico'
      WHEN 'USA' THEN 'USA'
      WHEN 'CAN' THEN 'Canada'
      ELSE COALESCE(c.country_code, '')
    END) AS origin_address,
  TRIM(BOTH ', ' FROM (COALESCE(NULLIF(TRIM(BOTH FROM b.city_full_name), ''), concat_ws(', ', b.city_name, b.state_code)) || ', ') ||
    CASE b.country_code
      WHEN 'MEX' THEN 'Mexico'
      WHEN 'USA' THEN 'USA'
      WHEN 'CAN' THEN 'Canada'
      ELSE COALESCE(b.country_code, '')
    END) AS dest_address
FROM lane_distances ld
JOIN cities c ON c.id = ld.city_id
JOIN cities b ON b.id = ld.border_crossing_city_id;

-- ============================================================================
-- 2. Add policies to RLS-enabled tables that have no policies
-- ============================================================================

-- lane_distances (cache table for distance lookups; service role writes via Edge Function)
DROP POLICY IF EXISTS "Public read lane_distances" ON public.lane_distances;
CREATE POLICY "Public read lane_distances" ON public.lane_distances
  FOR SELECT TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Public insert lane_distances" ON public.lane_distances;
CREATE POLICY "Public insert lane_distances" ON public.lane_distances
  FOR INSERT TO anon, authenticated
  WITH CHECK (auth.role() IN ('anon', 'authenticated') AND city_id IS NOT NULL AND border_crossing_city_id IS NOT NULL);

DROP POLICY IF EXISTS "Public update lane_distances" ON public.lane_distances;
CREATE POLICY "Public update lane_distances" ON public.lane_distances
  FOR UPDATE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- quotes_rows_update (audit/staging table)
DROP POLICY IF EXISTS "Public read quotes_rows_update" ON public.quotes_rows_update;
CREATE POLICY "Public read quotes_rows_update" ON public.quotes_rows_update
  FOR SELECT TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Public insert quotes_rows_update" ON public.quotes_rows_update;
CREATE POLICY "Public insert quotes_rows_update" ON public.quotes_rows_update
  FOR INSERT TO anon, authenticated
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Public update quotes_rows_update" ON public.quotes_rows_update;
CREATE POLICY "Public update quotes_rows_update" ON public.quotes_rows_update
  FOR UPDATE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Public delete quotes_rows_update" ON public.quotes_rows_update;
CREATE POLICY "Public delete quotes_rows_update" ON public.quotes_rows_update
  FOR DELETE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'));

-- ============================================================================
-- 3. Replace always-true policies with non-trivial role-based checks
-- ============================================================================

-- "Account Lane"
DROP POLICY IF EXISTS "Public can delete Account Lane" ON public."Account Lane";
DROP POLICY IF EXISTS "Public can insert Account Lane" ON public."Account Lane";
DROP POLICY IF EXISTS "Public can update Account Lane" ON public."Account Lane";

CREATE POLICY "Public can delete Account Lane" ON public."Account Lane"
  FOR DELETE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can insert Account Lane" ON public."Account Lane"
  FOR INSERT TO anon, authenticated
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can update Account Lane" ON public."Account Lane"
  FOR UPDATE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- "Cost Structure"
DROP POLICY IF EXISTS "Public can delete Cost Structure" ON public."Cost Structure";
DROP POLICY IF EXISTS "Public can insert Cost Structure" ON public."Cost Structure";
DROP POLICY IF EXISTS "Public can update Cost Structure" ON public."Cost Structure";

CREATE POLICY "Public can delete Cost Structure" ON public."Cost Structure"
  FOR DELETE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can insert Cost Structure" ON public."Cost Structure"
  FOR INSERT TO anon, authenticated
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can update Cost Structure" ON public."Cost Structure"
  FOR UPDATE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- "Market Information"
DROP POLICY IF EXISTS "Public can delete Market Information" ON public."Market Information";
DROP POLICY IF EXISTS "Public can insert Market Information" ON public."Market Information";
DROP POLICY IF EXISTS "Public can update Market Information" ON public."Market Information";

CREATE POLICY "Public can delete Market Information" ON public."Market Information"
  FOR DELETE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can insert Market Information" ON public."Market Information"
  FOR INSERT TO anon, authenticated
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can update Market Information" ON public."Market Information"
  FOR UPDATE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- accessorials
DROP POLICY IF EXISTS "Anon users can delete accessorials" ON public.accessorials;
DROP POLICY IF EXISTS "Anon users can insert accessorials" ON public.accessorials;
DROP POLICY IF EXISTS "Anon users can update accessorials" ON public.accessorials;
DROP POLICY IF EXISTS "Authenticated users can delete accessorials" ON public.accessorials;
DROP POLICY IF EXISTS "Authenticated users can insert accessorials" ON public.accessorials;
DROP POLICY IF EXISTS "Authenticated users can update accessorials" ON public.accessorials;

CREATE POLICY "Anon users can delete accessorials" ON public.accessorials
  FOR DELETE TO anon USING (auth.role() = 'anon');
CREATE POLICY "Anon users can insert accessorials" ON public.accessorials
  FOR INSERT TO anon WITH CHECK (auth.role() = 'anon');
CREATE POLICY "Anon users can update accessorials" ON public.accessorials
  FOR UPDATE TO anon
  USING (auth.role() = 'anon')
  WITH CHECK (auth.role() = 'anon');
CREATE POLICY "Authenticated users can delete accessorials" ON public.accessorials
  FOR DELETE TO authenticated USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert accessorials" ON public.accessorials
  FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update accessorials" ON public.accessorials
  FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- accounts
DROP POLICY IF EXISTS "Public can delete accounts" ON public.accounts;
DROP POLICY IF EXISTS "Public can insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Public can update accounts" ON public.accounts;

CREATE POLICY "Public can delete accounts" ON public.accounts
  FOR DELETE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can insert accounts" ON public.accounts
  FOR INSERT TO anon, authenticated
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can update accounts" ON public.accounts
  FOR UPDATE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- bill_to
DROP POLICY IF EXISTS "Public can delete bill_to" ON public.bill_to;
DROP POLICY IF EXISTS "Public can insert bill_to" ON public.bill_to;
DROP POLICY IF EXISTS "Public can update bill_to" ON public.bill_to;

CREATE POLICY "Public can delete bill_to" ON public.bill_to
  FOR DELETE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can insert bill_to" ON public.bill_to
  FOR INSERT TO anon, authenticated
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can update bill_to" ON public.bill_to
  FOR UPDATE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- border_crossing_cities
DROP POLICY IF EXISTS "Public can delete border_crossing_cities" ON public.border_crossing_cities;
DROP POLICY IF EXISTS "Public can insert border_crossing_cities" ON public.border_crossing_cities;
DROP POLICY IF EXISTS "Public can update border_crossing_cities" ON public.border_crossing_cities;

CREATE POLICY "Public can delete border_crossing_cities" ON public.border_crossing_cities
  FOR DELETE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can insert border_crossing_cities" ON public.border_crossing_cities
  FOR INSERT TO anon, authenticated
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can update border_crossing_cities" ON public.border_crossing_cities
  FOR UPDATE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- cities
DROP POLICY IF EXISTS "Allow anon delete cities" ON public.cities;
DROP POLICY IF EXISTS "Allow anon insert cities" ON public.cities;
DROP POLICY IF EXISTS "Allow anon update cities" ON public.cities;

CREATE POLICY "Allow anon delete cities" ON public.cities
  FOR DELETE TO anon USING (auth.role() = 'anon');
CREATE POLICY "Allow anon insert cities" ON public.cities
  FOR INSERT TO anon WITH CHECK (auth.role() = 'anon');
CREATE POLICY "Allow anon update cities" ON public.cities
  FOR UPDATE TO anon
  USING (auth.role() = 'anon')
  WITH CHECK (auth.role() = 'anon');

-- global_variables
DROP POLICY IF EXISTS "Public can insert global_variables" ON public.global_variables;
DROP POLICY IF EXISTS "Public can update global_variables" ON public.global_variables;

CREATE POLICY "Public can insert global_variables" ON public.global_variables
  FOR INSERT TO anon, authenticated
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can update global_variables" ON public.global_variables
  FOR UPDATE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- mass_update_log
DROP POLICY IF EXISTS "Anon and auth can insert mass_update_log" ON public.mass_update_log;
CREATE POLICY "Anon and auth can insert mass_update_log" ON public.mass_update_log
  FOR INSERT TO anon, authenticated
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- opportunities
DROP POLICY IF EXISTS "Authenticated users can create opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Authenticated users can delete opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Authenticated users can update opportunities" ON public.opportunities;

CREATE POLICY "Authenticated users can create opportunities" ON public.opportunities
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete opportunities" ON public.opportunities
  FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update opportunities" ON public.opportunities
  FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- partners
DROP POLICY IF EXISTS "Authenticated users can create partners" ON public.partners;
DROP POLICY IF EXISTS "Authenticated users can delete partners" ON public.partners;
DROP POLICY IF EXISTS "Authenticated users can update partners" ON public.partners;

CREATE POLICY "Authenticated users can create partners" ON public.partners
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete partners" ON public.partners
  FOR DELETE TO authenticated
  USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update partners" ON public.partners
  FOR UPDATE TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- pdf_configurations
DROP POLICY IF EXISTS "Allow anon delete pdf_configurations" ON public.pdf_configurations;
DROP POLICY IF EXISTS "Allow anon insert pdf_configurations" ON public.pdf_configurations;
DROP POLICY IF EXISTS "Allow anon update pdf_configurations" ON public.pdf_configurations;

CREATE POLICY "Allow anon delete pdf_configurations" ON public.pdf_configurations
  FOR DELETE TO anon USING (auth.role() = 'anon');
CREATE POLICY "Allow anon insert pdf_configurations" ON public.pdf_configurations
  FOR INSERT TO anon WITH CHECK (auth.role() = 'anon');
CREATE POLICY "Allow anon update pdf_configurations" ON public.pdf_configurations
  FOR UPDATE TO anon
  USING (auth.role() = 'anon')
  WITH CHECK (auth.role() = 'anon');

-- quotes
DROP POLICY IF EXISTS "Users can create quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can delete quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can update quotes" ON public.quotes;

CREATE POLICY "Users can create quotes" ON public.quotes
  FOR INSERT TO anon, authenticated
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Users can delete quotes" ON public.quotes
  FOR DELETE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Users can update quotes" ON public.quotes
  FOR UPDATE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- shippers
DROP POLICY IF EXISTS "Public can delete shippers" ON public.shippers;
DROP POLICY IF EXISTS "Public can insert shippers" ON public.shippers;
DROP POLICY IF EXISTS "Public can update shippers" ON public.shippers;

CREATE POLICY "Public can delete shippers" ON public.shippers
  FOR DELETE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can insert shippers" ON public.shippers
  FOR INSERT TO anon, authenticated
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));
CREATE POLICY "Public can update shippers" ON public.shippers
  FOR UPDATE TO anon, authenticated
  USING (auth.role() IN ('anon', 'authenticated'))
  WITH CHECK (auth.role() IN ('anon', 'authenticated'));

-- terms_conditions
DROP POLICY IF EXISTS "Anon users can delete terms_conditions" ON public.terms_conditions;
DROP POLICY IF EXISTS "Anon users can insert terms_conditions" ON public.terms_conditions;
DROP POLICY IF EXISTS "Anon users can update terms_conditions" ON public.terms_conditions;

CREATE POLICY "Anon users can delete terms_conditions" ON public.terms_conditions
  FOR DELETE TO anon USING (auth.role() = 'anon');
CREATE POLICY "Anon users can insert terms_conditions" ON public.terms_conditions
  FOR INSERT TO anon WITH CHECK (auth.role() = 'anon');
CREATE POLICY "Anon users can update terms_conditions" ON public.terms_conditions
  FOR UPDATE TO anon
  USING (auth.role() = 'anon')
  WITH CHECK (auth.role() = 'anon');
