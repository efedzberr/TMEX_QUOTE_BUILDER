/*
# count_list_views: support time-tracking fields (age_days, total_hours, effective_hours, hold_hours)
# (also re-declares the due-field support from the previous migration)
Extends lv_criterion_sql so list views (and KPI tiles) can filter server-side on:
- priority (picklist)
- due_date (date column, absolute and relative dates)
- due_status (computed: On time / Due soon / Overdue / Closed — same rules as src/lib/dueStatus.ts)
count_list_views itself is unchanged.
*/

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
  IF p_field IN ('opportunity_type','stage','status','currency','type_of_service','priority') THEN
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

  -- Time tracking (computed): age in days, hours per clock
  IF p_field IN ('age_days','total_hours','effective_hours','hold_hours') THEN
    IF v !~ '^-?[0-9]+(\.[0-9]+)?$' THEN RETURN 'false'; END IF;
    col := CASE p_field
      WHEN 'age_days' THEN
        'floor(EXTRACT(EPOCH FROM (COALESCE(CASE WHEN q.clock_state = ''closed'' THEN q.closed_at END, now()) - q.created_at)) / 86400)'
      WHEN 'total_hours' THEN
        '(EXTRACT(EPOCH FROM (COALESCE(CASE WHEN q.clock_state = ''closed'' THEN q.closed_at END, now()) - q.created_at)) / 3600)'
      WHEN 'effective_hours' THEN
        '((q.effective_seconds + CASE WHEN q.clock_state = ''effective'' THEN EXTRACT(EPOCH FROM (now() - q.clock_since)) ELSE 0 END) / 3600)'
      ELSE
        '((q.paused_seconds + CASE WHEN q.clock_state = ''paused'' THEN EXTRACT(EPOCH FROM (now() - q.clock_since)) ELSE 0 END) / 3600)'
    END;
    RETURN CASE p_operator
      WHEN 'eq'  THEN format('round((%s)::numeric, 1) = %s',  col, v)
      WHEN 'neq' THEN format('round((%s)::numeric, 1) <> %s', col, v)
      WHEN 'lt'  THEN format('(%s) < %s',  col, v)
      WHEN 'lte' THEN format('(%s) <= %s', col, v)
      WHEN 'gt'  THEN format('(%s) > %s',  col, v)
      WHEN 'gte' THEN format('(%s) >= %s', col, v)
      ELSE 'true'
    END;
  END IF;

  -- Due Status: computed from due_date / stage / warning days (labels must match src/lib/dueStatus.ts)
  IF p_field = 'due_status' THEN
    col := format($c$lower(CASE
      WHEN q.due_date IS NULL THEN '—'
      WHEN q.stage IN ('Sent to Customer', 'Published') THEN 'Closed'
      WHEN q.due_date < (now() AT TIME ZONE %L)::date THEN 'Overdue'
      WHEN (q.due_date - (now() AT TIME ZONE %L)::date) <= COALESCE(q.due_warning_days, 1) THEN 'Due soon'
      ELSE 'On time' END)$c$, tz, tz);
    RETURN CASE p_operator
      WHEN 'equals'    THEN format('%s = %L', col, lower(v))
      WHEN 'not_equal' THEN format('%s <> %L', col, lower(v))
      ELSE 'true'
    END;
  END IF;

  -- Date-only field (due_date is a DATE column)
  IF p_field = 'due_date' THEN
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
        WHEN 'equals'       THEN format('(q.due_date >= %L::date AND q.due_date < %L::date)', (rs AT TIME ZONE tz)::date, (re AT TIME ZONE tz)::date)
        WHEN 'before'       THEN format('q.due_date < %L::date', (rs AT TIME ZONE tz)::date)
        WHEN 'after'        THEN format('q.due_date >= %L::date', (re AT TIME ZONE tz)::date)
        WHEN 'on_or_before' THEN format('q.due_date < %L::date', (re AT TIME ZONE tz)::date)
        WHEN 'on_or_after'  THEN format('q.due_date >= %L::date', (rs AT TIME ZONE tz)::date)
        ELSE 'true'
      END;
    END IF;
    IF v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN RETURN 'false'; END IF;
    RETURN CASE p_operator
      WHEN 'equals'       THEN format('q.due_date = %L::date',  left(v, 10))
      WHEN 'before'       THEN format('q.due_date < %L::date',  left(v, 10))
      WHEN 'after'        THEN format('q.due_date > %L::date',  left(v, 10))
      WHEN 'on_or_before' THEN format('q.due_date <= %L::date', left(v, 10))
      WHEN 'on_or_after'  THEN format('q.due_date >= %L::date', left(v, 10))
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
