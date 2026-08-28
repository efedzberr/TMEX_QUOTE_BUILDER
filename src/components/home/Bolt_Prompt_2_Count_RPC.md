Create ONE new Supabase migration file and apply it. Do NOT modify any file under `src/`. Do NOT touch any other migration.

File: `supabase/migrations/20260828130000_add_count_list_views_rpc.sql`

Use exactly this SQL:

```sql
/*
# RPC count_list_views — server-side record count per List View

## Summary
Adds three functions so KPI tiles (and later the list header) can count the
records matching a saved List View on the server, against the full table,
respecting RLS.

- lv_relative_range(token, n): resolves relative date tokens (TODAY, LAST_N_DAYS,
  THIS_QUARTER, ...) to a [start, end) timestamptz range. Same semantics as
  src/lib/relativeDates.ts. Local day boundaries use time zone America/Monterrey.
- lv_criterion_sql(field, operator, value): translates ONE filter criterion into a
  SQL predicate over alias "q". Field and operator allow-listed (quote field catalog).
  Returns NULL when the criterion cannot be evaluated server-side
  (customer_review_status), which makes the whole view return NULL count.
- count_list_views(view_ids uuid[]): returns (view_id, record_count) for every
  requested id. record_count is NULL when the view is not visible to the caller,
  is not object 'quote', uses an unsupported field, or has invalid filter_logic.
  Owner scope ($CURRENT_USER) and the "Recently Viewed" special view are handled.

## Security
- All functions SECURITY INVOKER: RLS on list_views, quotes and recent_record_views applies.
- Only 'authenticated' can execute; revoked from public/anon.
- Dynamic SQL is built exclusively from allow-listed identifiers and %L-quoted literals.
*/

-- ============================================================
-- 1. Relative date ranges
-- ============================================================
CREATE OR REPLACE FUNCTION public.lv_relative_range(
  p_token text,
  p_n integer,
  OUT r_start timestamptz,
  OUT r_end timestamptz
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  tz constant text := 'America/Monterrey';
  today timestamp := date_trunc('day', now() AT TIME ZONE tz);
  mon timestamp := date_trunc('week', date_trunc('day', now() AT TIME ZONE tz));
  som timestamp := date_trunc('month', date_trunc('day', now() AT TIME ZONE tz));
  soq timestamp := date_trunc('quarter', date_trunc('day', now() AT TIME ZONE tz));
  soy timestamp := date_trunc('year', date_trunc('day', now() AT TIME ZONE tz));
  n integer := GREATEST(COALESCE(p_n, 1), 1);
  s timestamp;
  e timestamp;
BEGIN
  CASE p_token
    -- Day
    WHEN 'TODAY'        THEN s := today;                           e := today + interval '1 day';
    WHEN 'YESTERDAY'    THEN s := today - interval '1 day';        e := today;
    WHEN 'TOMORROW'     THEN s := today + interval '1 day';        e := today + interval '2 day';
    WHEN 'LAST_N_DAYS'  THEN s := today - (interval '1 day' * n); e := today + interval '1 day';
    WHEN 'NEXT_N_DAYS'  THEN s := today;                           e := today + (interval '1 day' * (n + 1));
    WHEN 'N_DAYS_AGO'   THEN s := today - (interval '1 day' * n); e := s + interval '1 day';
    -- Week (Monday start)
    WHEN 'THIS_WEEK'    THEN s := mon;                             e := mon + interval '7 day';
    WHEN 'LAST_WEEK'    THEN s := mon - interval '7 day';          e := mon;
    WHEN 'NEXT_WEEK'    THEN s := mon + interval '7 day';          e := mon + interval '14 day';
    WHEN 'LAST_N_WEEKS' THEN s := mon - (interval '7 day' * n);   e := mon;
    WHEN 'NEXT_N_WEEKS' THEN s := mon + interval '7 day';          e := s + (interval '7 day' * n);
    WHEN 'N_WEEKS_AGO'  THEN s := mon - (interval '7 day' * n);   e := s + interval '7 day';
    -- Month
    WHEN 'THIS_MONTH'    THEN s := som;                               e := som + interval '1 month';
    WHEN 'LAST_MONTH'    THEN s := som - interval '1 month';          e := som;
    WHEN 'NEXT_MONTH'    THEN s := som + interval '1 month';          e := som + interval '2 month';
    WHEN 'LAST_N_MONTHS' THEN s := som - (interval '1 month' * n);   e := som;
    WHEN 'NEXT_N_MONTHS' THEN s := som + interval '1 month';          e := som + (interval '1 month' * (n + 1));
    WHEN 'N_MONTHS_AGO'  THEN s := som - (interval '1 month' * n);   e := som - (interval '1 month' * (n - 1));
    -- Quarter
    WHEN 'THIS_QUARTER'    THEN s := soq;                               e := soq + interval '3 month';
    WHEN 'LAST_QUARTER'    THEN s := soq - interval '3 month';          e := soq;
    WHEN 'NEXT_QUARTER'    THEN s := soq + interval '3 month';          e := soq + interval '6 month';
    WHEN 'LAST_N_QUARTERS' THEN s := soq - (interval '3 month' * n);   e := soq;
    WHEN 'NEXT_N_QUARTERS' THEN s := soq + interval '3 month';          e := soq + (interval '3 month' * (n + 1));
    WHEN 'N_QUARTERS_AGO'  THEN s := soq - (interval '3 month' * n);   e := soq - (interval '3 month' * (n - 1));
    -- Year
    WHEN 'THIS_YEAR'    THEN s := soy;                              e := soy + interval '1 year';
    WHEN 'LAST_YEAR'    THEN s := soy - interval '1 year';          e := soy;
    WHEN 'NEXT_YEAR'    THEN s := soy + interval '1 year';          e := soy + interval '2 year';
    WHEN 'LAST_N_YEARS' THEN s := soy - (interval '1 year' * n);   e := soy;
    WHEN 'NEXT_N_YEARS' THEN s := soy + interval '1 year';          e := soy + (interval '1 year' * (n + 1));
    WHEN 'N_YEARS_AGO'  THEN s := soy - (interval '1 year' * n);   e := soy - (interval '1 year' * (n - 1));
    ELSE
      r_start := NULL; r_end := NULL; RETURN;
  END CASE;
  r_start := s AT TIME ZONE tz;
  r_end := e AT TIME ZONE tz;
END;
$$;

-- ============================================================
-- 2. One criterion -> SQL predicate over alias q (quotes)
-- ============================================================
CREATE OR REPLACE FUNCTION public.lv_criterion_sql(p_field text, p_operator text, p_value text)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  tz constant text := 'America/Monterrey';
  v text := COALESCE(p_value, '');
  col text;
  esc text;
  rel jsonb;
  rs timestamptz;
  re timestamptz;
BEGIN
  -- Text / user fields: case-insensitive
  IF p_field IN ('generated_quote_name','quote_number','bill_to_customer','partner_account',
                 'shipper','opportunity','units','us_sales_rep','mx_sales_rep','owner_name') THEN
    col := format('lower(coalesce(q.%I::text, %L))', p_field, '');
    esc := replace(replace(replace(lower(v), '\', '\\'), '%', '\%'), '_', '\_');
    RETURN CASE p_operator
      WHEN 'equals'       THEN format('%s = %L', col, lower(v))
      WHEN 'not_equal'    THEN format('%s <> %L', col, lower(v))
      WHEN 'contains'     THEN format('%s LIKE %L ESCAPE %L', col, '%' || esc || '%', '\')
      WHEN 'not_contains' THEN format('%s NOT LIKE %L ESCAPE %L', col, '%' || esc || '%', '\')
      WHEN 'starts_with'  THEN format('%s LIKE %L ESCAPE %L', col, esc || '%', '\')
      ELSE 'true'
    END;
  END IF;

  -- Picklist fields: case-insensitive equals / not_equal
  IF p_field IN ('opportunity_type','stage','status','currency','type_of_service') THEN
    col := format('lower(coalesce(q.%I::text, %L))', p_field, '');
    RETURN CASE p_operator
      WHEN 'equals'    THEN format('%s = %L', col, lower(v))
      WHEN 'not_equal' THEN format('%s <> %L', col, lower(v))
      ELSE 'true'
    END;
  END IF;

  -- Numeric / currency fields
  IF p_field IN ('total_amount','us_portion','mx_rate','border_crossing_fee') THEN
    IF v !~ '^-?[0-9]+(\.[0-9]+)?$' THEN RETURN 'false'; END IF;
    RETURN CASE p_operator
      WHEN 'eq'  THEN format('q.%I = %s',  p_field, v)
      WHEN 'neq' THEN format('q.%I <> %s', p_field, v)
      WHEN 'lt'  THEN format('q.%I < %s',  p_field, v)
      WHEN 'lte' THEN format('q.%I <= %s', p_field, v)
      WHEN 'gt'  THEN format('q.%I > %s',  p_field, v)
      WHEN 'gte' THEN format('q.%I >= %s', p_field, v)
      ELSE 'true'
    END;
  END IF;

  -- Datetime field
  IF p_field = 'created_at' THEN
    IF left(v, 1) = '{' THEN
      BEGIN
        rel := v::jsonb;
      EXCEPTION WHEN OTHERS THEN
        RETURN 'false';
      END;
      SELECT r_start, r_end INTO rs, re
      FROM public.lv_relative_range(rel->>'token', NULLIF(rel->>'n', '')::integer);
      IF rs IS NULL THEN RETURN 'false'; END IF;
      RETURN CASE p_operator
        WHEN 'equals'       THEN format('(q.created_at >= %L AND q.created_at < %L)', rs, re)
        WHEN 'before'       THEN format('q.created_at < %L', rs)
        WHEN 'after'        THEN format('q.created_at >= %L', re)
        WHEN 'on_or_before' THEN format('q.created_at < %L', re)
        WHEN 'on_or_after'  THEN format('q.created_at >= %L', rs)
        ELSE 'true'
      END;
    END IF;
    IF v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN RETURN 'false'; END IF;
    col := format('(q.created_at AT TIME ZONE %L)::date', tz);
    RETURN CASE p_operator
      WHEN 'equals'       THEN format('%s = %L::date',  col, left(v, 10))
      WHEN 'before'       THEN format('%s < %L::date',  col, left(v, 10))
      WHEN 'after'        THEN format('%s > %L::date',  col, left(v, 10))
      WHEN 'on_or_before' THEN format('%s <= %L::date', col, left(v, 10))
      WHEN 'on_or_after'  THEN format('%s >= %L::date', col, left(v, 10))
      ELSE 'true'
    END;
  END IF;

  -- Computed on the client only: cannot be counted server-side
  IF p_field = 'customer_review_status' THEN RETURN NULL; END IF;

  -- Unknown field: client ignores it (evaluates true)
  RETURN 'true';
END;
$$;

-- ============================================================
-- 3. count_list_views
-- ============================================================
CREATE OR REPLACE FUNCTION public.count_list_views(p_view_ids uuid[])
RETURNS TABLE(view_id uuid, record_count bigint)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  vid uuid;
  v record;
  f jsonb;
  frags text[];
  frag text;
  owner_sql text;
  is_recent boolean;
  unsupported boolean;
  logic text;
  toks text[];
  tok text;
  expr text;
  idx integer;
  where_sql text;
  cnt bigint;
BEGIN
  IF p_view_ids IS NULL THEN RETURN; END IF;

  FOREACH vid IN ARRAY p_view_ids LOOP
    view_id := vid;
    record_count := NULL;

    SELECT lv.id, lv.object, lv.filters, lv.filter_logic
    INTO v
    FROM public.list_views lv
    WHERE lv.id = vid;

    IF NOT FOUND OR v.object <> 'quote' THEN
      RETURN NEXT;
      CONTINUE;
    END IF;

    BEGIN
      frags := ARRAY[]::text[];
      owner_sql := NULL;
      is_recent := false;
      unsupported := false;

      FOR f IN SELECT value FROM jsonb_array_elements(COALESCE(v.filters, '[]'::jsonb)) LOOP
        IF f->>'special' = 'recently_viewed' THEN
          is_recent := true;
          CONTINUE;
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
          unsupported := true;
          EXIT;
        END IF;
        frags := frags || frag;
      END LOOP;

      IF unsupported THEN
        RETURN NEXT;
        CONTINUE;
      END IF;

      -- Recently Viewed: last 50 records viewed by the caller that still exist
      IF is_recent THEN
        SELECT count(*) INTO cnt
        FROM (
          SELECT r.record_id
          FROM public.recent_record_views r
          WHERE r.user_id = auth.uid() AND r.object = 'quote'
          ORDER BY r.viewed_at DESC
          LIMIT 50
        ) r
        JOIN public.quotes q ON q.id = r.record_id;
        record_count := cnt;
        RETURN NEXT;
        CONTINUE;
      END IF;

      -- Combine criteria: filter_logic (1 AND (2 OR 3)) or implicit AND
      logic := btrim(COALESCE(v.filter_logic, ''));
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
            RAISE EXCEPTION 'Invalid filter_logic token: %', tok;
          END IF;
        END LOOP;
      END IF;

      where_sql := '(' || expr || ')';
      IF owner_sql IS NOT NULL THEN
        where_sql := owner_sql || ' AND ' || where_sql;
      END IF;

      EXECUTE 'SELECT count(*) FROM public.quotes q WHERE ' || where_sql INTO cnt;
      record_count := cnt;
    EXCEPTION WHEN OTHERS THEN
      record_count := NULL;
    END;

    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.lv_relative_range(text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lv_criterion_sql(text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.count_list_views(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lv_relative_range(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lv_criterion_sql(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_list_views(uuid[]) TO authenticated;
```

After applying, confirm the migration ran without errors. Do not generate any TypeScript, components, or additional migrations.
