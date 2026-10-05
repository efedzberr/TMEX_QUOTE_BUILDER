/*
  # Accounts: duplicate protection + automatic Bill To / Shipper (block C1)

  1. Normalization
    - `normalize_account_name(text)`: lower-case, no accents, no spaces, no punctuation.
      Two names with the same normalized value are the same account.
    - `account_similarity_key(text)`: same, also ignoring legal suffixes (LLC, INC, SA DE CV...).
      Used only for the non-blocking "similar accounts" hint.

  2. Data clean-up
    - Type values: `Direct` -> `Direct Customer`, `3PL` -> `Transportation Company`
      on accounts, bill_to and shippers.
    - Placeholder account code `XXXXXX` -> empty (the code is optional: prospects have none).

  3. Duplicate protection (database level, every insert path)
    - Trigger `accounts_block_duplicates` rejects a new account, or a rename, whose
      normalized name already exists, and a non-empty Account Code that is already assigned.
      Existing duplicates are left untouched until they are cleaned up.

  4. Bill To / Shipper per account
    - `bill_to.account_id` and `shippers.account_id` link each record to its account.
    - `ensure_account_children(account_id)`: links an existing same-named Bill To / Shipper,
      otherwise creates "<Account Name> Bill To" and "<Account Name> Shipper" inheriting
      type, account code and status.
    - Backfill for every existing account.

  5. RPCs
    - `find_account_duplicates(name, code, exclude_id)`: live check used by the modals.
    - `create_account_with_children(name, type, code, status, email)`: creates the account,
      its Bill To and its Shipper in one transaction.
*/

-- 1. Normalization -----------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.normalize_account_name(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
    translate(lower(coalesce(p_name, '')),
      'áàäâãåéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÅÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
      'aaaaaaeeeeiiiiooooouuuuncaaaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9]+', '', 'g');
$$;

CREATE OR REPLACE FUNCTION public.account_similarity_key(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
    regexp_replace(
      ' ' || regexp_replace(
        replace(
          translate(lower(coalesce(p_name, '')),
            'áàäâãåéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÅÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
            'aaaaaaeeeeiiiiooooouuuuncaaaaaaeeeeiiiiooooouuuunc'),
          '.', ''),
        '[^a-z0-9]+', ' ', 'g') || ' ',
      ' (sa|de|cv|s|rl|sapi|sab|llc|inc|incorporated|corp|corporation|co|company|ltd|lp|the)(?= )', '', 'g'),
    ' ', '', 'g');
$$;

-- 2. Data clean-up -----------------------------------------------------------------------

UPDATE public.accounts SET type = 'Direct Customer'        WHERE lower(btrim(type)) IN ('direct', 'direct customer') AND type <> 'Direct Customer';
UPDATE public.accounts SET type = 'Transportation Company' WHERE lower(btrim(type)) IN ('3pl', 'transportation company') AND type <> 'Transportation Company';
UPDATE public.bill_to  SET type = 'Direct Customer'        WHERE lower(btrim(type)) IN ('direct', 'direct customer') AND type <> 'Direct Customer';
UPDATE public.bill_to  SET type = 'Transportation Company' WHERE lower(btrim(type)) IN ('3pl', 'transportation company') AND type <> 'Transportation Company';
UPDATE public.shippers SET type = 'Direct Customer'        WHERE lower(btrim(type)) IN ('direct', 'direct customer') AND type <> 'Direct Customer';
UPDATE public.shippers SET type = 'Transportation Company' WHERE lower(btrim(type)) IN ('3pl', 'transportation company') AND type <> 'Transportation Company';

UPDATE public.accounts SET account_code = '' WHERE upper(btrim(account_code)) = 'XXXXXX';

-- 3. Duplicate protection ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_accounts_normalized_name ON public.accounts (public.normalize_account_name(account_name));

CREATE OR REPLACE FUNCTION public.trg_accounts_block_duplicates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_norm text;
  v_code text;
  v_existing text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.account_name := btrim(regexp_replace(coalesce(NEW.account_name, ''), '\s+', ' ', 'g'));
    NEW.account_code := upper(btrim(coalesce(NEW.account_code, '')));
    IF NEW.account_code = 'XXXXXX' THEN NEW.account_code := ''; END IF;
    IF coalesce(NEW.name, '') = '' THEN NEW.name := NEW.account_name; END IF;
  END IF;

  v_norm := public.normalize_account_name(NEW.account_name);
  v_code := upper(btrim(coalesce(NEW.account_code, '')));
  IF v_code = 'XXXXXX' THEN v_code := ''; END IF;

  IF TG_OP = 'INSERT' OR public.normalize_account_name(OLD.account_name) IS DISTINCT FROM v_norm THEN
    IF v_norm = '' THEN
      RAISE EXCEPTION 'Account Name is required.' USING ERRCODE = '23514';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('sph-account-name:' || v_norm));
    SELECT a.account_name INTO v_existing FROM public.accounts a
      WHERE a.id <> NEW.id AND public.normalize_account_name(a.account_name) = v_norm LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'An account named "%" already exists.', v_existing USING ERRCODE = '23505';
    END IF;
  END IF;

  IF v_code <> '' AND (TG_OP = 'INSERT' OR upper(btrim(coalesce(OLD.account_code, ''))) IS DISTINCT FROM v_code) THEN
    PERFORM pg_advisory_xact_lock(hashtext('sph-account-code:' || v_code));
    SELECT a.account_name INTO v_existing FROM public.accounts a
      WHERE a.id <> NEW.id AND upper(btrim(a.account_code)) = v_code LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION 'Account Code % is already assigned to "%".', v_code, v_existing USING ERRCODE = '23505';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS accounts_block_duplicates ON public.accounts;
CREATE TRIGGER accounts_block_duplicates BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.trg_accounts_block_duplicates();

-- 4. Bill To / Shipper per account -------------------------------------------------------

ALTER TABLE public.bill_to  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
ALTER TABLE public.shippers ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bill_to_account_id  ON public.bill_to (account_id);
CREATE INDEX IF NOT EXISTS idx_shippers_account_id ON public.shippers (account_id);

CREATE OR REPLACE FUNCTION public.ensure_account_children(p_account_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  a record;
  v_plain text;
  v_suffixed text;
  v_id uuid;
BEGIN
  SELECT id, account_name, account_code, type, status INTO a FROM public.accounts WHERE id = p_account_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_plain := public.normalize_account_name(a.account_name);
  IF v_plain = '' THEN RETURN; END IF;

  -- Bill To
  IF NOT EXISTS (SELECT 1 FROM public.bill_to WHERE account_id = a.id) THEN
    v_suffixed := public.normalize_account_name(a.account_name || ' Bill To');
    SELECT b.id INTO v_id FROM public.bill_to b
      WHERE b.account_id IS NULL AND public.normalize_account_name(b.bill_to_name) IN (v_plain, v_suffixed)
      ORDER BY (public.normalize_account_name(b.bill_to_name) = v_suffixed) DESC, b.created_at LIMIT 1;
    IF FOUND THEN
      UPDATE public.bill_to SET account_id = a.id WHERE id = v_id;
    ELSIF NOT EXISTS (SELECT 1 FROM public.bill_to b WHERE public.normalize_account_name(b.bill_to_name) = v_suffixed) THEN
      INSERT INTO public.bill_to (bill_to_name, account_code, type, status, account_id)
      VALUES (a.account_name || ' Bill To', coalesce(a.account_code, ''), a.type, a.status, a.id);
    END IF;
  END IF;

  -- Shipper
  IF NOT EXISTS (SELECT 1 FROM public.shippers WHERE account_id = a.id) THEN
    v_suffixed := public.normalize_account_name(a.account_name || ' Shipper');
    SELECT s.id INTO v_id FROM public.shippers s
      WHERE s.account_id IS NULL AND public.normalize_account_name(s.shipper_name) IN (v_plain, v_suffixed)
      ORDER BY (public.normalize_account_name(s.shipper_name) = v_suffixed) DESC, s.created_at LIMIT 1;
    IF FOUND THEN
      UPDATE public.shippers SET account_id = a.id WHERE id = v_id;
    ELSIF NOT EXISTS (SELECT 1 FROM public.shippers s WHERE public.normalize_account_name(s.shipper_name) = v_suffixed) THEN
      INSERT INTO public.shippers (shipper_name, account_code, type, status, account_id)
      VALUES (a.account_name || ' Shipper', coalesce(a.account_code, ''), a.type, a.status, a.id);
    END IF;
  END IF;
END; $$;

-- Backfill: every existing account gets (or is linked to) its Bill To and Shipper
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.accounts ORDER BY created_at, id LOOP
    PERFORM public.ensure_account_children(r.id);
  END LOOP;
END $$;

-- 5. RPCs --------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.find_account_duplicates(
  p_name text,
  p_code text DEFAULT '',
  p_exclude_id uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, account_name text, account_code text, type text, status text, match_kind text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH input AS (
    SELECT public.normalize_account_name(p_name) AS norm,
           public.account_similarity_key(p_name) AS sim,
           CASE WHEN upper(btrim(coalesce(p_code, ''))) = 'XXXXXX' THEN '' ELSE upper(btrim(coalesce(p_code, ''))) END AS code
  ),
  candidates AS (
    SELECT a.id, a.account_name, a.account_code, a.type, a.status,
           CASE
             WHEN i.norm <> '' AND public.normalize_account_name(a.account_name) = i.norm THEN 'name'
             WHEN i.code <> '' AND upper(btrim(a.account_code)) = i.code THEN 'code'
             WHEN length(i.sim) >= 3 AND public.account_similarity_key(a.account_name) = i.sim THEN 'similar'
             WHEN length(i.sim) >= 4 AND public.account_similarity_key(a.account_name) LIKE i.sim || '%' THEN 'similar'
             WHEN length(public.account_similarity_key(a.account_name)) >= 4
                  AND i.sim LIKE public.account_similarity_key(a.account_name) || '%' THEN 'similar'
           END AS match_kind
    FROM public.accounts a CROSS JOIN input i
    WHERE p_exclude_id IS NULL OR a.id <> p_exclude_id
  )
  SELECT c.id, c.account_name, c.account_code, c.type, c.status, c.match_kind
  FROM candidates c
  WHERE c.match_kind IS NOT NULL
  ORDER BY CASE c.match_kind WHEN 'name' THEN 0 WHEN 'code' THEN 1 ELSE 2 END, c.account_name
  LIMIT 10;
$$;

CREATE OR REPLACE FUNCTION public.create_account_with_children(
  p_account_name text,
  p_type text,
  p_account_code text DEFAULT '',
  p_status text DEFAULT 'Active',
  p_customer_email text DEFAULT ''
)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_name text := btrim(regexp_replace(coalesce(p_account_name, ''), '\s+', ' ', 'g'));
  v_account public.accounts%ROWTYPE;
  v_bill_to text;
  v_shipper text;
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION 'Account Name is required.' USING ERRCODE = '23514';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('Direct Customer', 'Transportation Company') THEN
    RAISE EXCEPTION 'Account Type is required.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.accounts (name, account_name, account_code, type, status, customer_email)
  VALUES (v_name, v_name, coalesce(p_account_code, ''), p_type, coalesce(nullif(btrim(p_status), ''), 'Active'), nullif(btrim(coalesce(p_customer_email, '')), ''))
  RETURNING * INTO v_account;

  PERFORM public.ensure_account_children(v_account.id);

  SELECT b.bill_to_name INTO v_bill_to FROM public.bill_to b WHERE b.account_id = v_account.id ORDER BY b.created_at LIMIT 1;
  SELECT s.shipper_name INTO v_shipper FROM public.shippers s WHERE s.account_id = v_account.id ORDER BY s.created_at LIMIT 1;

  RETURN jsonb_build_object(
    'id', v_account.id,
    'account_name', v_account.account_name,
    'account_code', v_account.account_code,
    'type', v_account.type,
    'status', v_account.status,
    'bill_to_name', v_bill_to,
    'shipper_name', v_shipper
  );
END; $$;

REVOKE ALL ON FUNCTION public.find_account_duplicates(text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_account_with_children(text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ensure_account_children(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_account_duplicates(text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_account_with_children(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_account_children(uuid) TO authenticated;
