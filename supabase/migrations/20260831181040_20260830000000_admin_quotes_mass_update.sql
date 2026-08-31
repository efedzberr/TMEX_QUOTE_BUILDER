/*
# Admin → Wolke: mass update of quote properties (administrators only)

- quote_admin_update_log: one row per executed mass update (who, when, filters, changes, affected).
- lv_where_for(filters, logic): reusable builder that turns list-view style criteria into a WHERE
  fragment (same lv_criterion_sql used by KPI counts; supports $CURRENT_USER owner; rejects
  the special Recently Viewed criterion).
- admin_preview_quotes(filters, logic): total count + first 20 matching quotes.
- admin_mass_update_quotes(filters, logic, changes, expected): applies the changes to every match,
  writes one Quote History entry per quote describing old → new values, and one log row.
  Aborts if the match count no longer equals `expected` (the previewed number).

All three functions require an authenticated AAL2 administrator (user_profiles.is_admin) and are
SECURITY DEFINER, so they update quotes regardless of sharing rules and stage locks. The normal
triggers still run: stage/status changes move the clocks and write quote_stage_events, and
opportunity type / priority changes recalculate the due date.
*/

-- ============================================================
-- 1. Log table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quote_admin_update_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name text,
  performed_at timestamptz NOT NULL DEFAULT now(),
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  filter_logic text,
  changes jsonb NOT NULL,
  affected integer NOT NULL
);
ALTER TABLE public.quote_admin_update_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_admin_update_log_select" ON public.quote_admin_update_log;
CREATE POLICY "quote_admin_update_log_select" ON public.quote_admin_update_log FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.is_admin());

-- ============================================================
-- 2. WHERE builder (criteria + logic -> SQL fragment)
-- ============================================================
CREATE OR REPLACE FUNCTION public.lv_where_for(p_filters jsonb, p_logic text)
RETURNS text
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  f jsonb;
  frags text[] := ARRAY[]::text[];
  frag text;
  owner_sql text := NULL;
  logic text;
  toks text[];
  tok text;
  expr text;
  idx integer;
BEGIN
  FOR f IN SELECT value FROM jsonb_array_elements(COALESCE(p_filters, '[]'::jsonb)) LOOP
    IF f->>'special' IS NOT NULL THEN
      RAISE EXCEPTION 'This filter type is not supported here';
    END IF;
    IF f->>'field' = 'owner_user_id' AND f->>'operator' = 'equals' AND f->>'value' = '$CURRENT_USER' THEN
      owner_sql := 'q.owner_user_id = auth.uid()';
      CONTINUE;
    END IF;
    IF f->>'field' IS NULL OR f->>'operator' IS NULL THEN
      CONTINUE;
    END IF;
    frag := public.lv_criterion_sql(f->>'field', f->>'operator', f->>'value');
    IF frag IS NULL THEN
      RAISE EXCEPTION 'Unsupported filter field: %', f->>'field';
    END IF;
    frags := frags || frag;
  END LOOP;

  logic := btrim(COALESCE(p_logic, ''));
  IF array_length(frags, 1) IS NULL THEN
    expr := 'true';
  ELSIF logic = '' THEN
    expr := '(' || array_to_string(frags, ') AND (') || ')';
  ELSE
    toks := regexp_split_to_array(btrim(regexp_replace(logic, '([()])', ' \1 ', 'g')), '\s+');
    expr := '';
    FOREACH tok IN ARRAY toks LOOP
      IF tok = '' THEN
        CONTINUE;
      ELSIF tok IN ('(', ')') THEN
        expr := expr || tok;
      ELSIF upper(tok) IN ('AND', 'OR') THEN
        expr := expr || ' ' || upper(tok) || ' ';
      ELSIF tok ~ '^[0-9]+$' THEN
        idx := tok::integer;
        IF idx >= 1 AND idx <= array_length(frags, 1) THEN
          expr := expr || '(' || frags[idx] || ')';
        ELSE
          expr := expr || 'true';
        END IF;
      ELSE
        RAISE EXCEPTION 'Invalid filter logic token: %', tok;
      END IF;
    END LOOP;
  END IF;

  expr := '(' || expr || ')';
  IF owner_sql IS NOT NULL THEN
    expr := owner_sql || ' AND ' || expr;
  END IF;
  RETURN expr;
END;
$$;

-- ============================================================
-- 3. Preview
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_preview_quotes(p_filters jsonb, p_logic text DEFAULT NULL)
RETURNS TABLE(total bigint, sample jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  where_sql text;
  v_total bigint;
  v_sample jsonb;
BEGIN
  IF (SELECT auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrators only';
  END IF;
  where_sql := public.lv_where_for(p_filters, p_logic);
  EXECUTE 'SELECT count(*)::bigint FROM public.quotes q WHERE ' || where_sql INTO v_total;
  EXECUTE 'SELECT COALESCE(jsonb_agg(s), ''[]''::jsonb) FROM (
             SELECT q.quote_number, q.generated_quote_name, q.owner_name, q.stage, q.status, q.priority, q.opportunity_type
             FROM public.quotes q WHERE ' || where_sql || ' ORDER BY q.created_at DESC LIMIT 20
           ) s' INTO v_sample;
  total := v_total;
  sample := v_sample;
  RETURN NEXT;
END;
$$;

-- ============================================================
-- 4. Mass update
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_mass_update_quotes(
  p_filters jsonb,
  p_logic text,
  p_changes jsonb,
  p_expected integer
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  where_sql text;
  v_admin uuid := auth.uid();
  v_admin_name text;
  v_owner uuid;
  v_owner_name text;
  v_priority text := p_changes->>'priority';
  v_opp text := p_changes->>'opportunity_type';
  v_status text := p_changes->>'status';
  v_stage text := p_changes->>'stage';
  v_count integer;
  set_sql text := '';
BEGIN
  IF (SELECT auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrators only';
  END IF;

  -- Validate requested changes
  IF p_changes ? 'owner_user_id' THEN
    v_owner := (p_changes->>'owner_user_id')::uuid;
    SELECT display_name INTO v_owner_name FROM public.user_profiles WHERE id = v_owner;
    IF v_owner_name IS NULL OR btrim(v_owner_name) = '' THEN
      RAISE EXCEPTION 'The selected owner does not exist or has no display name';
    END IF;
    set_sql := set_sql || format(', owner_user_id = %L::uuid, owner_name = %L', v_owner, v_owner_name);
  END IF;
  IF v_priority IS NOT NULL THEN
    IF v_priority NOT IN ('Standard', 'Low', 'High') THEN RAISE EXCEPTION 'Invalid priority'; END IF;
    set_sql := set_sql || format(', priority = %L', v_priority);
  END IF;
  IF v_opp IS NOT NULL THEN
    IF v_opp NOT IN ('BID', 'CONTRACT', 'STANDARD PUBLISH') THEN RAISE EXCEPTION 'Invalid opportunity type'; END IF;
    set_sql := set_sql || format(', opportunity_type = %L', v_opp);
  END IF;
  IF v_status IS NOT NULL THEN
    IF v_status NOT IN ('Active', 'On Hold', 'Waiting for Information', 'Cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
    set_sql := set_sql || format(', status = %L', v_status);
  END IF;
  IF v_stage IS NOT NULL THEN
    IF v_stage NOT IN ('New', 'In Progress', 'Completed', 'Branch Manager Approval', 'Sent to Customer', 'Published') THEN RAISE EXCEPTION 'Invalid stage'; END IF;
    set_sql := set_sql || format(', stage = %L', v_stage);
  END IF;
  IF set_sql = '' THEN
    RAISE EXCEPTION 'No changes were provided';
  END IF;
  set_sql := substr(set_sql, 3); -- drop leading ", "

  SELECT COALESCE(display_name, 'Administrator') INTO v_admin_name FROM public.user_profiles WHERE id = v_admin;

  where_sql := public.lv_where_for(p_filters, p_logic);

  -- Freeze the targets and their old values
  CREATE TEMP TABLE _admin_mu ON COMMIT DROP AS
    SELECT q.id, q.owner_name, q.priority, q.opportunity_type, q.status, q.stage FROM public.quotes q WHERE false;
  EXECUTE 'INSERT INTO _admin_mu SELECT q.id, q.owner_name, q.priority, q.opportunity_type, q.status, q.stage FROM public.quotes q WHERE ' || where_sql;
  SELECT count(*) INTO v_count FROM _admin_mu;

  IF p_expected IS NOT NULL AND v_count <> p_expected THEN
    RAISE EXCEPTION 'The number of matching quotes changed (now %). Run the preview again.', v_count;
  END IF;
  IF v_count = 0 THEN
    RETURN 0;
  END IF;

  EXECUTE 'UPDATE public.quotes q SET ' || set_sql || ' WHERE q.id IN (SELECT id FROM _admin_mu)';

  -- One history entry per quote with old -> new values
  INSERT INTO public.quote_history (quote_id, date, user_name, action, notes)
  SELECT m.id, now(), v_admin_name, 'Admin Mass Update',
    array_to_string(ARRAY(
      SELECT x FROM (VALUES
        (CASE WHEN v_owner IS NOT NULL AND COALESCE(m.owner_name, '') IS DISTINCT FROM v_owner_name THEN 'Owner: ' || COALESCE(m.owner_name, '—') || ' → ' || v_owner_name END),
        (CASE WHEN v_priority IS NOT NULL AND COALESCE(m.priority, '') <> v_priority THEN 'Priority: ' || COALESCE(m.priority, '—') || ' → ' || v_priority END),
        (CASE WHEN v_opp IS NOT NULL AND COALESCE(m.opportunity_type, '') <> v_opp THEN 'Opportunity Type: ' || COALESCE(m.opportunity_type, '—') || ' → ' || v_opp END),
        (CASE WHEN v_status IS NOT NULL AND COALESCE(m.status, '') <> v_status THEN 'Status: ' || COALESCE(m.status, '—') || ' → ' || v_status END),
        (CASE WHEN v_stage IS NOT NULL AND COALESCE(m.stage, '') <> v_stage THEN 'Stage: ' || COALESCE(m.stage, '—') || ' → ' || v_stage END)
      ) AS t(x) WHERE x IS NOT NULL
    ), ' · ')
  FROM _admin_mu m;

  -- Drop empty-notes entries (nothing actually changed for that quote)
  DELETE FROM public.quote_history h
  WHERE h.action = 'Admin Mass Update' AND h.date = now() AND (h.notes IS NULL OR h.notes = '');

  INSERT INTO public.quote_admin_update_log (performed_by, performed_by_name, filters, filter_logic, changes, affected)
  VALUES (v_admin, v_admin_name, COALESCE(p_filters, '[]'::jsonb), p_logic, p_changes, v_count);

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.lv_where_for(jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_preview_quotes(jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_mass_update_quotes(jsonb, text, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lv_where_for(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_preview_quotes(jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mass_update_quotes(jsonb, text, jsonb, integer) TO authenticated;