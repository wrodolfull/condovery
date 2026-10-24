-- 008: item customizations, delivery fees and auditable order totals.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS option_groups jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS delivery_fee_cents integer NOT NULL DEFAULT 0;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='shops_delivery_fee_bounds') THEN
  ALTER TABLE public.shops ADD CONSTRAINT shops_delivery_fee_bounds
   CHECK(delivery_fee_cents BETWEEN 0 AND 1000000);
 END IF;
END $$;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal_cents integer NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee_cents integer NOT NULL DEFAULT 0;
UPDATE public.orders SET subtotal_cents=total_cents WHERE subtotal_cents=0;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '[]'::jsonb;
