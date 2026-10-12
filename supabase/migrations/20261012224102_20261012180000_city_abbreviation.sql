/*
# City Abbreviation

1. global_variables.city_abbreviation_separator (text, default ' ', max 3 chars, can be '').
2. cities.city_abbreviation (text) = upper(city_code) || separator || upper(state_code),
   or NULL when city_code or state_code is blank.
3. A BEFORE INSERT/UPDATE trigger on cities always derives the value (cannot be typed).
4. Changing the separator recalculates every city.
5. Backfill of all existing cities.
*/

-- 1. Separator setting
ALTER TABLE public.global_variables
  ADD COLUMN IF NOT EXISTS city_abbreviation_separator text NOT NULL DEFAULT ' ';

ALTER TABLE public.global_variables DROP CONSTRAINT IF EXISTS global_variables_city_abbreviation_separator_check;
ALTER TABLE public.global_variables ADD CONSTRAINT global_variables_city_abbreviation_separator_check
  CHECK (char_length(city_abbreviation_separator) <= 3);

-- 2. New column
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS city_abbreviation text;

-- Builder (single source of truth)
CREATE OR REPLACE FUNCTION public.build_city_abbreviation(p_city_code text, p_state_code text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN NULLIF(btrim(p_city_code), '') IS NULL OR NULLIF(btrim(p_state_code), '') IS NULL THEN NULL
    ELSE upper(btrim(p_city_code))
         || COALESCE((SELECT gv.city_abbreviation_separator FROM public.global_variables gv LIMIT 1), ' ')
         || upper(btrim(p_state_code))
  END;
$$;

-- 3. Always derive on insert / update
CREATE OR REPLACE FUNCTION public.cities_set_abbreviation()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.city_abbreviation := public.build_city_abbreviation(NEW.city_code, NEW.state_code);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cities_set_abbreviation ON public.cities;
CREATE TRIGGER trg_cities_set_abbreviation
  BEFORE INSERT OR UPDATE ON public.cities
  FOR EACH ROW EXECUTE FUNCTION public.cities_set_abbreviation();

-- 4. Recalculate all cities when the separator changes
CREATE OR REPLACE FUNCTION public.global_variables_recalc_city_abbreviation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.cities c
     SET city_abbreviation = public.build_city_abbreviation(c.city_code, c.state_code)
   WHERE c.city_abbreviation IS DISTINCT FROM public.build_city_abbreviation(c.city_code, c.state_code);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_global_variables_recalc_city_abbreviation ON public.global_variables;
CREATE TRIGGER trg_global_variables_recalc_city_abbreviation
  AFTER UPDATE OF city_abbreviation_separator ON public.global_variables
  FOR EACH ROW
  WHEN (OLD.city_abbreviation_separator IS DISTINCT FROM NEW.city_abbreviation_separator)
  EXECUTE FUNCTION public.global_variables_recalc_city_abbreviation();

-- 5. Backfill
UPDATE public.cities
   SET city_abbreviation = public.build_city_abbreviation(city_code, state_code)
 WHERE city_abbreviation IS DISTINCT FROM public.build_city_abbreviation(city_code, state_code);
