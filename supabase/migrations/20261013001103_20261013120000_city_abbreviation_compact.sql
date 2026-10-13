/*
# City abbreviation (compact) for search

1. cities.city_abbreviation_compact = upper(city_code || state_code) with only letters and digits
   (no separator), e.g. SATX. NULL when city_code or state_code is blank.
2. Maintained by the existing BEFORE INSERT/UPDATE trigger function cities_set_abbreviation().
   It does not depend on the separator, so changing the separator does not affect it.
3. Index for exact matches. Backfill of all existing cities.
*/

ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS city_abbreviation_compact text;

CREATE OR REPLACE FUNCTION public.build_city_abbreviation_compact(p_city_code text, p_state_code text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN NULLIF(btrim(p_city_code), '') IS NULL OR NULLIF(btrim(p_state_code), '') IS NULL THEN NULL
    ELSE regexp_replace(upper(btrim(p_city_code) || btrim(p_state_code)), '[^A-Z0-9]', '', 'g')
  END;
$$;

CREATE OR REPLACE FUNCTION public.cities_set_abbreviation()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.city_abbreviation := public.build_city_abbreviation(NEW.city_code, NEW.state_code);
  NEW.city_abbreviation_compact := public.build_city_abbreviation_compact(NEW.city_code, NEW.state_code);
  RETURN NEW;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_cities_city_abbreviation_compact
  ON public.cities (city_abbreviation_compact);

UPDATE public.cities
   SET city_abbreviation_compact = public.build_city_abbreviation_compact(city_code, state_code)
 WHERE city_abbreviation_compact IS DISTINCT FROM public.build_city_abbreviation_compact(city_code, state_code);
