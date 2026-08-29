/*
# Quote Status & Time Tracking

## quotes — repurposed / new columns
- status: now the "pause" status: Active | On Hold | Waiting for Information | Cancelled. Existing rows -> Active.
- closed_at: set when the quote closes (stage Published = won, status Cancelled = lost); cleared on reopen.
- clock_state: effective | paused | closed — which clock is running now.
- clock_since: when the current clock state started.
- effective_seconds / paused_seconds: accumulated time of previous states (the running state is added at read time).

Clock rules (function quote_clock_state):
  closed    when status = 'Cancelled' OR stage = 'Published'
  paused    when status IN ('On Hold', 'Waiting for Information')
  effective otherwise

## quote_stage_events
One row per stage/status change: from/to values, clock state from/to, duration of the previous state, user.
Written by the trigger (SECURITY DEFINER); readable by all authenticated (AAL2).

## Backfill
Existing quotes: status = Active, clock_since = created_at, state derived from stage.
Quotes already Published: closed_at = updated_at, effective_seconds = updated_at - created_at.
*/

-- ============================================================
-- 1. Columns
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='quotes' AND column_name='closed_at') THEN
    ALTER TABLE public.quotes ADD COLUMN closed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='quotes' AND column_name='clock_state') THEN
    ALTER TABLE public.quotes ADD COLUMN clock_state text NOT NULL DEFAULT 'effective';
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_clock_state_check CHECK (clock_state IN ('effective', 'paused', 'closed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='quotes' AND column_name='clock_since') THEN
    ALTER TABLE public.quotes ADD COLUMN clock_since timestamptz NOT NULL DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='quotes' AND column_name='effective_seconds') THEN
    ALTER TABLE public.quotes ADD COLUMN effective_seconds bigint NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='quotes' AND column_name='paused_seconds') THEN
    ALTER TABLE public.quotes ADD COLUMN paused_seconds bigint NOT NULL DEFAULT 0;
  END IF;
END $$;

-- status: repurpose. Existing values (e.g. 'New') become 'Active'.
UPDATE public.quotes SET status = 'Active'
WHERE status IS NULL OR status NOT IN ('Active', 'On Hold', 'Waiting for Information', 'Cancelled');
ALTER TABLE public.quotes ALTER COLUMN status SET DEFAULT 'Active';
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('Active', 'On Hold', 'Waiting for Information', 'Cancelled'));

CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_clock_state ON public.quotes(clock_state);

-- ============================================================
-- 2. Events table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quote_stage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL DEFAULT now(),
  stage_from text,
  stage_to text,
  status_from text,
  status_to text,
  clock_state_from text,
  clock_state_to text,
  duration_seconds bigint NOT NULL DEFAULT 0,
  user_id uuid
);

CREATE INDEX IF NOT EXISTS idx_quote_stage_events_quote ON public.quote_stage_events(quote_id, changed_at);

ALTER TABLE public.quote_stage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quote_stage_events_select" ON public.quote_stage_events;
CREATE POLICY "quote_stage_events_select" ON public.quote_stage_events FOR SELECT
  TO authenticated
  USING ((SELECT auth.jwt()->>'aal') = 'aal2');

-- ============================================================
-- 3. Clock functions + trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.quote_clock_state(p_stage text, p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status = 'Cancelled' OR p_stage = 'Published' THEN 'closed'
    WHEN p_status IN ('On Hold', 'Waiting for Information') THEN 'paused'
    ELSE 'effective'
  END;
$$;

CREATE OR REPLACE FUNCTION public.trg_quotes_track_clock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_state text;
  v_elapsed bigint;
  v_now timestamptz := now();
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status := COALESCE(NEW.status, 'Active');
    v_new_state := public.quote_clock_state(NEW.stage, NEW.status);
    NEW.clock_state := v_new_state;
    NEW.clock_since := COALESCE(NEW.created_at, v_now);
    NEW.effective_seconds := 0;
    NEW.paused_seconds := 0;
    NEW.closed_at := CASE WHEN v_new_state = 'closed' THEN COALESCE(NEW.created_at, v_now) ELSE NULL END;
    RETURN NEW;
  END IF;

  -- UPDATE: only act on a real stage/status change
  IF NEW.stage IS NOT DISTINCT FROM OLD.stage AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  v_new_state := public.quote_clock_state(NEW.stage, NEW.status);
  v_elapsed := GREATEST(0, EXTRACT(EPOCH FROM (v_now - OLD.clock_since))::bigint);

  -- Accumulate the state that just ended
  IF OLD.clock_state = 'effective' THEN
    NEW.effective_seconds := OLD.effective_seconds + v_elapsed;
  ELSIF OLD.clock_state = 'paused' THEN
    NEW.paused_seconds := OLD.paused_seconds + v_elapsed;
  END IF;

  NEW.clock_state := v_new_state;
  NEW.clock_since := v_now;
  IF v_new_state = 'closed' THEN
    NEW.closed_at := COALESCE(CASE WHEN OLD.clock_state = 'closed' THEN OLD.closed_at END, v_now);
  ELSE
    NEW.closed_at := NULL;
  END IF;

  INSERT INTO public.quote_stage_events
    (quote_id, changed_at, stage_from, stage_to, status_from, status_to, clock_state_from, clock_state_to, duration_seconds, user_id)
  VALUES
    (NEW.id, v_now, OLD.stage, NEW.stage, OLD.status, NEW.status, OLD.clock_state, v_new_state, v_elapsed, auth.uid());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_track_clock ON public.quotes;
CREATE TRIGGER quotes_track_clock
  BEFORE INSERT OR UPDATE OF stage, status
  ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.trg_quotes_track_clock();

-- ============================================================
-- 4. Backfill existing quotes
-- ============================================================
UPDATE public.quotes
SET clock_state = public.quote_clock_state(stage, status),
    clock_since = CASE WHEN public.quote_clock_state(stage, status) = 'closed' THEN COALESCE(updated_at, created_at) ELSE created_at END,
    closed_at   = CASE WHEN public.quote_clock_state(stage, status) = 'closed' THEN COALESCE(updated_at, created_at) ELSE NULL END,
    effective_seconds = CASE WHEN public.quote_clock_state(stage, status) = 'closed'
                             THEN GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(updated_at, created_at) - created_at))::bigint)
                             ELSE 0 END,
    paused_seconds = 0;