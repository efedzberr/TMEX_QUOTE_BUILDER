/*
  # Server-side quote number allocation

  Problem: the client computed the next quote_number / quote_name_sequence by reading
  MAX() from `quotes`. That SELECT is filtered by sharing RLS, so a user who cannot see
  the highest-numbered quote computes a number that already exists and the insert fails
  with `quotes_quote_number_key`. It is also a race under concurrent users.

  Fix: two Postgres sequences seeded from the true table maximum, plus a SECURITY DEFINER
  RPC `allocate_quote_identifiers()` that returns the next values regardless of RLS.
*/

CREATE SEQUENCE IF NOT EXISTS public.quotes_quote_number_seq;
CREATE SEQUENCE IF NOT EXISTS public.quotes_name_sequence_seq;

-- Seed both sequences from the current true maximum (idempotent: only moves forward)
DO $$
DECLARE
  v_max_num bigint;
  v_max_seq bigint;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(quote_number, '\D', '', 'g'), '')::bigint), 0)
    INTO v_max_num FROM public.quotes;
  SELECT COALESCE(MAX(quote_name_sequence), 0) INTO v_max_seq FROM public.quotes;

  PERFORM setval('public.quotes_quote_number_seq',
    GREATEST(v_max_num, COALESCE((SELECT last_value FROM public.quotes_quote_number_seq), 0)), true);
  PERFORM setval('public.quotes_name_sequence_seq',
    GREATEST(v_max_seq, COALESCE((SELECT last_value FROM public.quotes_name_sequence_seq), 0)), true);
END $$;

CREATE OR REPLACE FUNCTION public.allocate_quote_identifiers(p_with_name_sequence boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num bigint;
  v_seq bigint := NULL;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Never hand out a number that already exists (handles rows inserted outside the sequence)
  LOOP
    v_num := nextval('public.quotes_quote_number_seq');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.quotes WHERE quote_number = 'TMQ-' || lpad(v_num::text, 8, '0')
    );
  END LOOP;

  IF p_with_name_sequence THEN
    v_seq := nextval('public.quotes_name_sequence_seq');
  END IF;

  RETURN jsonb_build_object(
    'quote_number', 'TMQ-' || lpad(v_num::text, 8, '0'),
    'quote_name_sequence', v_seq
  );
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_quote_identifiers(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.allocate_quote_identifiers(boolean) TO authenticated;