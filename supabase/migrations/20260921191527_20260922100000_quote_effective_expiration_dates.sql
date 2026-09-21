/*
  # Quote effective and expiration dates

  - quotes.effective_date (date): defaults to the creation day.
  - quotes.expiration_date (date): effective_date + global_variables.quote_link_expiration_days.
  - Trigger fills defaults on insert and recomputes expiration when effective changes and the
    expiration was not changed in the same statement.
  - Existing quotes are backfilled from created_at.
*/

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS effective_date date,
  ADD COLUMN IF NOT EXISTS expiration_date date;

CREATE OR REPLACE FUNCTION public.quote_expiration_days()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT quote_link_expiration_days FROM public.global_variables ORDER BY updated_at DESC NULLS LAST LIMIT 1), 30);
$$;

CREATE OR REPLACE FUNCTION public.trg_quotes_effective_expiration()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_days integer := public.quote_expiration_days();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.effective_date IS NULL THEN NEW.effective_date := COALESCE(NEW.created_at, now())::date; END IF;
    IF NEW.expiration_date IS NULL THEN NEW.expiration_date := NEW.effective_date + v_days; END IF;
  ELSE
    IF NEW.effective_date IS NULL THEN NEW.effective_date := OLD.effective_date; END IF;
    IF NEW.effective_date IS DISTINCT FROM OLD.effective_date
       AND NEW.expiration_date IS NOT DISTINCT FROM OLD.expiration_date THEN
      NEW.expiration_date := NEW.effective_date + v_days;
    END IF;
    IF NEW.expiration_date IS NULL THEN NEW.expiration_date := NEW.effective_date + v_days; END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS quotes_effective_expiration ON public.quotes;
CREATE TRIGGER quotes_effective_expiration BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.trg_quotes_effective_expiration();

-- Backfill existing quotes (the trigger only fires on statements after this point)
UPDATE public.quotes
SET effective_date = created_at::date,
    expiration_date = created_at::date + public.quote_expiration_days()
WHERE effective_date IS NULL;