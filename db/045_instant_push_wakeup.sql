-- PostgreSQL NOTIFY is delivered only after the transaction commits.
-- Payload intentionally contains no personal information or tokens.
-- The persistent worker listens for this channel and dispatches immediately.
-- Periodic fallback still recovers dropped signals and scheduled retries.
CREATE OR REPLACE FUNCTION public.elevadoor_push_wakeup()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('elevadoor_push_ready', '');
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_elevadoor_push_wakeup ON public.push_deliveries;
CREATE TRIGGER trg_elevadoor_push_wakeup
AFTER INSERT ON public.push_deliveries
FOR EACH STATEMENT EXECUTE FUNCTION public.elevadoor_push_wakeup();
