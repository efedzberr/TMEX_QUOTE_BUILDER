/*
  # Global Picklists (block G1)

  Admin-managed value lists shared across the app (Salesforce "Global Value Sets" style).

  1. New table `picklist_values`
    - one row per value of a global list: `picklist_key`, `value`, `sort_order`,
      `is_default`, `is_system`, `is_active`, plus the standard audit fields
    - values are unique per list ignoring case and surrounding spaces
    - at most one default value per list
  2. Rules (enforced by trigger)
    - a value's text and list cannot be changed after it is created
    - built-in values (`is_system`) cannot be deactivated; values are never deleted
  3. Security
    - every signed-in user (MFA) can read the lists
    - only users with the `admin.picklists` permission (edit) can add, reorder, set the
      default or deactivate values; the key is granted to the Full Access profile
  4. Seed
    - current hard-coded values (built-in) for: Equipment Type, Lane Type, Load Frequency,
      Commitment Type, Live Load or Drop, Lane Priority, MX Sales Rep, US Sales Rep
    - any other value already stored on quotes / lanes / accessorials / terms is added as a
      regular value so nothing in use is missing from its list
  5. RPCs: `add_picklist_value`, `reorder_picklist_values`, `set_picklist_default`
*/

CREATE TABLE IF NOT EXISTS public.picklist_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  picklist_key text NOT NULL CHECK (picklist_key IN (
    'equipment_type', 'lane_type', 'load_frequency', 'commitment_type',
    'live_load_or_drop', 'lane_priority', 'mx_sales_rep', 'us_sales_rep')),
  value text NOT NULL CHECK (char_length(btrim(value)) BETWEEN 1 AND 80),
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_by_name text,
  updated_by uuid,
  updated_by_name text
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_picklist_values_key_value ON public.picklist_values (picklist_key, lower(btrim(value)));
CREATE UNIQUE INDEX IF NOT EXISTS uq_picklist_values_one_default ON public.picklist_values (picklist_key) WHERE is_default;
CREATE INDEX IF NOT EXISTS idx_picklist_values_key_order ON public.picklist_values (picklist_key, sort_order);

-- Rules ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.trg_picklist_values_rules()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.value := btrim(regexp_replace(NEW.value, '\s+', ' ', 'g'));
    RETURN NEW;
  END IF;
  IF NEW.value IS DISTINCT FROM OLD.value OR NEW.picklist_key IS DISTINCT FROM OLD.picklist_key
     OR NEW.is_system IS DISTINCT FROM OLD.is_system THEN
    RAISE EXCEPTION 'Picklist values cannot be renamed or moved to another list.' USING ERRCODE = '23514';
  END IF;
  IF OLD.is_system AND NOT NEW.is_active THEN
    RAISE EXCEPTION 'Built-in values cannot be deactivated.' USING ERRCODE = '23514';
  END IF;
  IF NOT NEW.is_active THEN NEW.is_default := false; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS picklist_values_rules ON public.picklist_values;
CREATE TRIGGER picklist_values_rules BEFORE INSERT OR UPDATE ON public.picklist_values
  FOR EACH ROW EXECUTE FUNCTION public.trg_picklist_values_rules();

-- Seed (before the audit trigger so built-in rows are not stamped with a user) -----------

INSERT INTO public.picklist_values (picklist_key, value, sort_order, is_system, created_by_name, updated_by_name)
SELECT v.k, v.val, v.ord * 10, true, 'System', 'System'
FROM (VALUES
  ('equipment_type', 'Dry Van', 1), ('equipment_type', 'Flatbed', 2), ('equipment_type', 'Refrigerated / Reefer', 3),
  ('equipment_type', 'Hazmat', 4), ('equipment_type', 'Step Deck', 5), ('equipment_type', 'Tanker', 6), ('equipment_type', 'Intermodal', 7),
  ('lane_type', 'Recurring', 1), ('lane_type', 'Spot', 2), ('lane_type', 'Project', 3),
  ('load_frequency', 'Daily', 1), ('load_frequency', 'Weekly', 2), ('load_frequency', 'Bi-Weekly', 3),
  ('load_frequency', 'Monthly', 4), ('load_frequency', 'Yearly', 5), ('load_frequency', 'On-Demand', 6),
  ('commitment_type', 'Primary', 1), ('commitment_type', 'Secondary', 2),
  ('live_load_or_drop', 'Live Load', 1), ('live_load_or_drop', 'Drop', 2),
  ('lane_priority', 'Priority 1', 1), ('lane_priority', 'Priority 2', 2), ('lane_priority', 'Priority 3', 3),
  ('lane_priority', 'Priority 4', 4), ('lane_priority', 'Priority 5', 5),
  ('mx_sales_rep', 'Alberto Paz', 1), ('mx_sales_rep', 'Estrella García', 2), ('mx_sales_rep', 'Octavio Paz', 3),
  ('mx_sales_rep', 'Marianna Beltrán', 4), ('mx_sales_rep', 'Alejandro Nájera', 5), ('mx_sales_rep', 'Marcela Zambrano', 6),
  ('mx_sales_rep', 'Cesar Ruiz', 7), ('mx_sales_rep', 'Héctor Ayala', 8), ('mx_sales_rep', 'Gustavo Jacobo', 9),
  ('mx_sales_rep', 'Jorge Gordillo', 10), ('mx_sales_rep', 'Ricardo García', 11), ('mx_sales_rep', 'Monica Elizondo', 12),
  ('mx_sales_rep', 'TOP Management', 13),
  ('us_sales_rep', 'Connie Hills', 1), ('us_sales_rep', 'Adam Trask', 2), ('us_sales_rep', 'Cassie Baldwin', 3),
  ('us_sales_rep', 'Kristy Welsh', 4), ('us_sales_rep', 'John Bartman', 5), ('us_sales_rep', 'Sean Kelley', 6),
  ('us_sales_rep', 'Zack Palmer', 7), ('us_sales_rep', 'Todd Ridgeway', 8), ('us_sales_rep', 'Bryant Glass', 9),
  ('us_sales_rep', 'Chris Castro', 10), ('us_sales_rep', 'Jacob Bushman', 11), ('us_sales_rep', 'Kamron Proos', 12),
  ('us_sales_rep', 'Pleasent Norris - PQ', 13), ('us_sales_rep', 'Steven Gacho', 14), ('us_sales_rep', 'Shane Hoss', 15),
  ('us_sales_rep', 'Jim Rich', 16)
) AS v(k, val, ord)
ON CONFLICT DO NOTHING;

-- Values already stored in the data that are missing from their list
INSERT INTO public.picklist_values (picklist_key, value, sort_order, is_system, created_by_name, updated_by_name)
SELECT d.k, d.val, 1000 + (row_number() OVER (PARTITION BY d.k ORDER BY d.val))::int * 10, false, 'System (from existing records)', 'System (from existing records)'
FROM (
  SELECT DISTINCT ON (x.k, lower(x.val)) x.k, x.val
  FROM (
    SELECT 'equipment_type' AS k, btrim(regexp_replace(type_of_service, '\s+', ' ', 'g')) AS val FROM public.quotes
    UNION ALL SELECT 'equipment_type', btrim(regexp_replace(equipment_type, '\s+', ' ', 'g')) FROM public.quote_lanes
    UNION ALL SELECT 'equipment_type', btrim(regexp_replace(type_of_service, '\s+', ' ', 'g')) FROM public.quote_lanes
    UNION ALL SELECT 'equipment_type', btrim(regexp_replace(commodity, '\s+', ' ', 'g')) FROM public.accessorials
    UNION ALL SELECT 'equipment_type', btrim(regexp_replace(equipment_type, '\s+', ' ', 'g')) FROM public.terms_conditions
    UNION ALL SELECT 'lane_type', btrim(regexp_replace(lane_type, '\s+', ' ', 'g')) FROM public.quote_lanes
    UNION ALL SELECT 'load_frequency', btrim(regexp_replace(load_frequency, '\s+', ' ', 'g')) FROM public.quote_lanes
    UNION ALL SELECT 'commitment_type', btrim(regexp_replace(commitment_type, '\s+', ' ', 'g')) FROM public.quote_lanes
    UNION ALL SELECT 'live_load_or_drop', btrim(regexp_replace(live_load_or_drop, '\s+', ' ', 'g')) FROM public.quote_lanes
    UNION ALL SELECT 'lane_priority', btrim(regexp_replace(priority, '\s+', ' ', 'g')) FROM public.quote_lanes
    UNION ALL SELECT 'mx_sales_rep', btrim(regexp_replace(mx_sales_rep, '\s+', ' ', 'g')) FROM public.quotes
    UNION ALL SELECT 'us_sales_rep', btrim(regexp_replace(us_sales_rep, '\s+', ' ', 'g')) FROM public.quotes
  ) x
  WHERE x.val IS NOT NULL AND x.val <> '' AND char_length(x.val) <= 80 AND lower(x.val) NOT IN ('all', 'n/a')
  ORDER BY x.k, lower(x.val), x.val
) d
ON CONFLICT DO NOTHING;

-- Audit fields (same trigger as the other business tables)
DO $$ BEGIN
  IF to_regproc('public.trg_set_audit_fields') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS picklist_values_set_audit_fields ON public.picklist_values;
    CREATE TRIGGER picklist_values_set_audit_fields BEFORE INSERT OR UPDATE ON public.picklist_values
      FOR EACH ROW EXECUTE FUNCTION public.trg_set_audit_fields();
  END IF;
END $$;

-- Security -------------------------------------------------------------------------------

INSERT INTO public.profile_permissions (profile_id, permission_key, can_view, can_create, can_edit, can_delete)
VALUES ('b0000000-0000-0000-0000-000000000001', 'admin.picklists', true, true, true, true)
ON CONFLICT (profile_id, permission_key) DO NOTHING;

ALTER TABLE public.picklist_values ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "picklist_values_select" ON public.picklist_values;
CREATE POLICY "picklist_values_select" ON public.picklist_values FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');

DROP POLICY IF EXISTS "picklist_values_insert" ON public.picklist_values;
CREATE POLICY "picklist_values_insert" ON public.picklist_values FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND is_system = false AND public.has_permission('admin.picklists', 'edit'));

DROP POLICY IF EXISTS "picklist_values_update" ON public.picklist_values;
CREATE POLICY "picklist_values_update" ON public.picklist_values FOR UPDATE TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('admin.picklists', 'edit'))
  WITH CHECK ((SELECT auth.jwt()->>'aal') = 'aal2' AND public.has_permission('admin.picklists', 'edit'));

-- RPCs (run with the caller's rights: the policies above apply) ---------------------------

CREATE OR REPLACE FUNCTION public.add_picklist_value(p_key text, p_value text)
RETURNS public.picklist_values LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_value text := btrim(regexp_replace(coalesce(p_value, ''), '\s+', ' ', 'g'));
  v_existing public.picklist_values%ROWTYPE;
  v_row public.picklist_values%ROWTYPE;
BEGIN
  IF v_value = '' THEN
    RAISE EXCEPTION 'Value is required.' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_existing FROM public.picklist_values WHERE picklist_key = p_key AND lower(btrim(value)) = lower(v_value);
  IF FOUND THEN
    IF v_existing.is_active THEN
      RAISE EXCEPTION 'The value "%" already exists in this list.', v_existing.value USING ERRCODE = '23505';
    END IF;
    RAISE EXCEPTION 'The value "%" already exists in this list but is inactive. Reactivate it instead.', v_existing.value USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.picklist_values (picklist_key, value, sort_order)
  VALUES (p_key, v_value, COALESCE((SELECT max(sort_order) FROM public.picklist_values WHERE picklist_key = p_key), 0) + 10)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;

CREATE OR REPLACE FUNCTION public.reorder_picklist_values(p_key text, p_ids uuid[])
RETURNS void LANGUAGE sql SET search_path = public AS $$
  UPDATE public.picklist_values pv SET sort_order = o.ord::int * 10
  FROM unnest(p_ids) WITH ORDINALITY AS o(id, ord)
  WHERE pv.id = o.id AND pv.picklist_key = p_key AND pv.sort_order IS DISTINCT FROM o.ord::int * 10;
$$;

CREATE OR REPLACE FUNCTION public.set_picklist_default(p_key text, p_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.picklist_values SET is_default = false WHERE picklist_key = p_key AND is_default AND id IS DISTINCT FROM p_id;
  IF p_id IS NOT NULL THEN
    UPDATE public.picklist_values SET is_default = true WHERE id = p_id AND picklist_key = p_key AND is_active AND NOT is_default;
  END IF;
END; $$;

REVOKE ALL ON FUNCTION public.add_picklist_value(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reorder_picklist_values(text, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_picklist_default(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_picklist_value(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_picklist_values(text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_picklist_default(text, uuid) TO authenticated;
