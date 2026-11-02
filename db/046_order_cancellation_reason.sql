-- 046: optional cancellation explanation, scoped to the order owner/seller API.
-- Old orders and old clients remain compatible (NULL reason).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancellation_reason varchar(200);
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='orders_cancellation_reason_valid'
      AND conrelid='public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_cancellation_reason_valid
      CHECK (cancellation_reason IS NULL OR
        (char_length(btrim(cancellation_reason)) BETWEEN 3 AND 200));
  END IF;
END $$;
