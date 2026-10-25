-- Payment preference only. No funds, card numbers or Pix keys flow through Condovery.
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS payment_methods text[] NOT NULL DEFAULT ARRAY['pix','credit_card','debit_card','cash']::text[];
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text;
-- Existing historical orders may have null, but new order requests require a choice.
ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_payment_methods_valid;
ALTER TABLE public.shops ADD CONSTRAINT shops_payment_methods_valid CHECK (
 cardinality(payment_methods) BETWEEN 1 AND 4
 AND payment_methods <@ ARRAY['pix','credit_card','debit_card','cash']::text[]
 AND cardinality(ARRAY(SELECT DISTINCT unnest(payment_methods))) >= 1
);
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_valid;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_valid CHECK (
 payment_method IS NULL OR payment_method = ANY(ARRAY['pix','credit_card','debit_card','cash']::text[])
);
