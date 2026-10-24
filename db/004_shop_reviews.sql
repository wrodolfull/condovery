-- Verified, order-linked reviews. Only the buyer of a completed order may review.
-- The API enforces review ownership, shop ownership and tenant authorization.
CREATE TABLE IF NOT EXISTS public.shop_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES public.condominiums(id),
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id),
  buyer_id uuid NOT NULL REFERENCES public.users(id),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 200),
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  moderated_by uuid REFERENCES public.users(id),
  moderated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status='pending' AND moderated_at IS NULL AND moderated_by IS NULL)
      OR (status IN ('approved','rejected') AND moderated_at IS NOT NULL AND moderated_by IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS shop_reviews_approved_idx
  ON public.shop_reviews(condominium_id,shop_id,created_at DESC)
  WHERE status='approved';
CREATE INDEX IF NOT EXISTS shop_reviews_moderation_idx
  ON public.shop_reviews(condominium_id,shop_id,status,created_at DESC);

-- Block accidental association with an unrelated or unfinished order even
-- when a future backend route or trusted DB writer makes an insertion mistake.
CREATE OR REPLACE FUNCTION public.validate_condovery_review() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE found_order record;
BEGIN
 SELECT o.condominium_id, o.shop_id, o.buyer_id, o.status,
        s.owner_id
 INTO found_order FROM public.orders o
 JOIN public.shops s ON s.id=o.shop_id
 WHERE o.id=NEW.order_id;
 IF NOT FOUND OR found_order.status <> 'completed'
    OR found_order.condominium_id <> NEW.condominium_id
    OR found_order.shop_id <> NEW.shop_id
    OR found_order.buyer_id <> NEW.buyer_id
    OR found_order.owner_id = NEW.buyer_id THEN
   RAISE EXCEPTION 'Avaliação exige pedido concluído do próprio comprador';
 END IF;
 RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_validate_condovery_review ON public.shop_reviews;
CREATE TRIGGER trg_validate_condovery_review
 BEFORE INSERT OR UPDATE OF order_id,condominium_id,shop_id,buyer_id
 ON public.shop_reviews FOR EACH ROW EXECUTE FUNCTION public.validate_condovery_review();

DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='auth') THEN
   ALTER TABLE public.shop_reviews ENABLE ROW LEVEL SECURITY;
 END IF;
END $$;
