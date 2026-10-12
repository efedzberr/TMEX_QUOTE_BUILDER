/*
# Active currencies (administrative setting)

1. New column global_variables.active_currencies (text[]).
   - USD and MXN are always included; CAD is optional.
   - Only supported codes are allowed: USD, MXN, CAD.
2. CAD is turned off: active_currencies = {USD, MXN}.
3. Existing quotes / lanes that use CAD are NOT modified.
*/

ALTER TABLE public.global_variables
  ADD COLUMN IF NOT EXISTS active_currencies text[] NOT NULL DEFAULT ARRAY['USD','MXN']::text[];

UPDATE public.global_variables SET active_currencies = ARRAY['USD','MXN']::text[];

ALTER TABLE public.global_variables DROP CONSTRAINT IF EXISTS global_variables_active_currencies_check;
ALTER TABLE public.global_variables ADD CONSTRAINT global_variables_active_currencies_check
  CHECK (
    active_currencies @> ARRAY['USD','MXN']::text[]
    AND active_currencies <@ ARRAY['USD','MXN','CAD']::text[]
  );
