/*
  # Transfer records from one user to another

  Deleting a user fails ("Database error deleting user") while the user still owns
  quotes or list views. This migration adds an administrator-only process that moves
  everything a user owns to another user, so the first one can then be deleted.

  1. New table
    - `user_record_transfers`: one row per transfer (who, from whom, to whom, how many
      records of each kind). It has no foreign keys, so it survives the deletion of
      the users it mentions. Administrators can read it; nobody writes to it directly.

  2. New functions (administrators only, two-factor session required)
    - `user_record_summary(p_user)`: what the user owns, plus any other reference
      that would still block the deletion.
    - `transfer_user_records(p_from, p_to)`: moves, in one transaction (all or nothing):
        - quotes owned by the user (owner and owner name), whatever their stage or status
        - quotes where the user's name is the US / MX sales rep (the name is replaced
          and added to the sales rep list when missing)
        - list views, private and public
        - personal KPI tiles, up to the limit of 8 per strip of the receiving user

  3. Not changed
    - "Created by" / "Last modified by" names and the quote history keep the original user.
    - Nothing is deleted. Deleting the user remains a separate step.
*/

CREATE TABLE IF NOT EXISTS public.user_record_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  from_user_name text,
  to_user_id uuid NOT NULL,
  to_user_name text,
  performed_by uuid,
  performed_by_name text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_record_transfers_created ON public.user_record_transfers (created_at DESC);

ALTER TABLE public.user_record_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_select_user_record_transfers" ON public.user_record_transfers;
CREATE POLICY "admins_select_user_record_transfers" ON public.user_record_transfers
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.is_admin());

-- Name comparison used for text fields: case and spacing do not matter
CREATE OR REPLACE FUNCTION public.urt_norm(p_text text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT lower(btrim(regexp_replace(COALESCE(p_text, ''), '\s+', ' ', 'g')));
$$;

-- References to a user that block its deletion and that the transfer does not move
CREATE OR REPLACE FUNCTION public.urt_other_blockers(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  v_count bigint;
  v_out jsonb := '[]'::jsonb;
BEGIN
  FOR r IN
    SELECT cl.relname AS table_name, att.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND ns.nspname = 'public'
      AND array_length(con.conkey, 1) = 1
      AND con.confdeltype IN ('a', 'r')
      AND con.confrelid IN (to_regclass('auth.users'), to_regclass('public.user_profiles'))
      AND NOT (cl.relname = 'quotes' AND att.attname = 'owner_user_id')
      AND NOT (cl.relname = 'list_views' AND att.attname = 'owner_user_id')
    ORDER BY cl.relname, att.attname
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I = $1', r.table_name, r.column_name) INTO v_count USING p_user;
    IF v_count > 0 THEN
      v_out := v_out || jsonb_build_object('table', r.table_name, 'column', r.column_name, 'count', v_count);
    END IF;
  END LOOP;
  RETURN v_out;
END; $$;

CREATE OR REPLACE FUNCTION public.user_record_summary(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_norm text;
  v_quotes bigint;
  v_rep bigint := 0;
  v_private bigint;
  v_public bigint;
  v_tiles bigint;
BEGIN
  IF (SELECT auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrators only';
  END IF;

  SELECT display_name INTO v_name FROM public.user_profiles WHERE id = p_user;
  v_norm := public.urt_norm(v_name);

  SELECT count(*) INTO v_quotes FROM public.quotes q
  WHERE q.owner_user_id = p_user
     OR (q.owner_user_id IS NULL AND v_norm <> '' AND public.urt_norm(q.owner_name) = v_norm);

  IF v_norm <> '' THEN
    SELECT count(*) INTO v_rep FROM public.quotes q
    WHERE public.urt_norm(q.us_sales_rep) = v_norm OR public.urt_norm(q.mx_sales_rep) = v_norm;
  END IF;

  SELECT count(*) FILTER (WHERE visibility <> 'public'), count(*) FILTER (WHERE visibility = 'public')
    INTO v_private, v_public
  FROM public.list_views WHERE owner_user_id = p_user;

  SELECT count(*) INTO v_tiles FROM public.kpi_tiles WHERE owner_user_id = p_user;

  RETURN jsonb_build_object(
    'user_name', v_name,
    'quotes', v_quotes,
    'sales_rep_quotes', v_rep,
    'list_views_private', v_private,
    'list_views_public', v_public,
    'kpi_tiles', v_tiles,
    'other_blockers', public.urt_other_blockers(p_user)
  );
END; $$;

CREATE OR REPLACE FUNCTION public.transfer_user_records(p_from uuid, p_to uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_admin_name text;
  v_from_name text;
  v_to_name text;
  v_from_norm text;
  v_n bigint;
  v_quotes bigint := 0;
  v_us bigint := 0;
  v_mx bigint := 0;
  v_views bigint := 0;
  v_tiles bigint := 0;
  v_tiles_left bigint := 0;
  v_room integer;
  v_pos integer;
  t record;
  v_summary jsonb;
BEGIN
  IF (SELECT auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrators only';
  END IF;
  IF p_from IS NULL OR p_to IS NULL THEN RAISE EXCEPTION 'Both users are required'; END IF;
  IF p_from = p_to THEN RAISE EXCEPTION 'Choose a different user to receive the records'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_from) THEN
    RAISE EXCEPTION 'The user to transfer from does not exist';
  END IF;
  SELECT display_name INTO v_from_name FROM public.user_profiles WHERE id = p_from;
  SELECT display_name INTO v_to_name FROM public.user_profiles WHERE id = p_to;
  IF v_to_name IS NULL OR btrim(v_to_name) = '' THEN
    RAISE EXCEPTION 'The user that receives the records does not exist or has no display name';
  END IF;
  v_from_norm := public.urt_norm(v_from_name);
  SELECT COALESCE(display_name, 'Administrator') INTO v_admin_name FROM public.user_profiles WHERE id = v_admin;

  -- 1. Quotes owned by the user (any stage, any status, locked or not)
  UPDATE public.quotes SET owner_user_id = p_to, owner_name = v_to_name WHERE owner_user_id = p_from;
  GET DIAGNOSTICS v_quotes = ROW_COUNT;

  -- Quotes that carry the user's name as owner without the link to the user
  IF v_from_norm <> '' AND v_from_norm <> public.urt_norm(v_to_name) THEN
    UPDATE public.quotes SET owner_user_id = p_to, owner_name = v_to_name
    WHERE owner_user_id IS NULL AND public.urt_norm(owner_name) = v_from_norm;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_quotes := v_quotes + v_n;
  END IF;

  -- Legacy owner column, when the database still has it
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'owner_id' AND data_type = 'uuid') THEN
    EXECUTE 'UPDATE public.quotes SET owner_id = $2 WHERE owner_id = $1' USING p_from, p_to;
  END IF;

  -- 2. Sales rep text fields that name the user
  IF v_from_norm <> '' AND v_from_norm <> public.urt_norm(v_to_name) THEN
    UPDATE public.quotes SET us_sales_rep = v_to_name WHERE public.urt_norm(us_sales_rep) = v_from_norm;
    GET DIAGNOSTICS v_us = ROW_COUNT;
    UPDATE public.quotes SET mx_sales_rep = v_to_name WHERE public.urt_norm(mx_sales_rep) = v_from_norm;
    GET DIAGNOSTICS v_mx = ROW_COUNT;

    IF to_regclass('public.picklist_values') IS NOT NULL THEN
      IF v_us > 0 THEN
        INSERT INTO public.picklist_values (picklist_key, value, sort_order)
        SELECT 'us_sales_rep', v_to_name, COALESCE((SELECT max(sort_order) FROM public.picklist_values WHERE picklist_key = 'us_sales_rep'), 0) + 10
        WHERE NOT EXISTS (SELECT 1 FROM public.picklist_values WHERE picklist_key = 'us_sales_rep' AND lower(btrim(value)) = lower(btrim(v_to_name)));
      END IF;
      IF v_mx > 0 THEN
        INSERT INTO public.picklist_values (picklist_key, value, sort_order)
        SELECT 'mx_sales_rep', v_to_name, COALESCE((SELECT max(sort_order) FROM public.picklist_values WHERE picklist_key = 'mx_sales_rep'), 0) + 10
        WHERE NOT EXISTS (SELECT 1 FROM public.picklist_values WHERE picklist_key = 'mx_sales_rep' AND lower(btrim(value)) = lower(btrim(v_to_name)));
      END IF;
    END IF;
  END IF;

  -- 3. List views, private and public
  UPDATE public.list_views SET owner_user_id = p_to, updated_at = now() WHERE owner_user_id = p_from;
  GET DIAGNOSTICS v_views = ROW_COUNT;

  -- 4. Personal KPI tiles, appended after the receiving user's tiles (max 8 per strip)
  FOR t IN SELECT id, object FROM public.kpi_tiles WHERE owner_user_id = p_from ORDER BY object, position, created_at LOOP
    SELECT 8 - count(*), COALESCE(max(position), -1) + 1 INTO v_room, v_pos
    FROM public.kpi_tiles WHERE owner_user_id = p_to AND object = t.object;
    IF v_room > 0 THEN
      UPDATE public.kpi_tiles SET owner_user_id = p_to, position = v_pos WHERE id = t.id;
      v_tiles := v_tiles + 1;
    ELSE
      v_tiles_left := v_tiles_left + 1;
    END IF;
  END LOOP;

  v_summary := jsonb_build_object(
    'quotes', v_quotes,
    'us_sales_rep_quotes', v_us,
    'mx_sales_rep_quotes', v_mx,
    'list_views', v_views,
    'kpi_tiles', v_tiles,
    'kpi_tiles_not_moved', v_tiles_left,
    'other_blockers', public.urt_other_blockers(p_from)
  );

  INSERT INTO public.user_record_transfers (from_user_id, from_user_name, to_user_id, to_user_name, performed_by, performed_by_name, summary)
  VALUES (p_from, v_from_name, p_to, v_to_name, v_admin, v_admin_name, v_summary);

  RETURN v_summary || jsonb_build_object('from_user_name', v_from_name, 'to_user_name', v_to_name);
END; $$;

REVOKE ALL ON FUNCTION public.urt_norm(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.urt_other_blockers(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_record_summary(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_user_records(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.urt_norm(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_record_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_user_records(uuid, uuid) TO authenticated;
