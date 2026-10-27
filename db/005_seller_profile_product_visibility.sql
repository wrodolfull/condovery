-- Condovery: storefront visibility, seller identity images and buyer WhatsApp recovery.
-- Preserve legacy unavailable products as HIDDEN: they were not previously shown.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS visibility text;
UPDATE public.products SET visibility=CASE WHEN is_available THEN 'available' ELSE 'hidden' END
 WHERE visibility IS NULL;
ALTER TABLE public.products ALTER COLUMN visibility SET DEFAULT 'available';
ALTER TABLE public.products ALTER COLUMN visibility SET NOT NULL;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='products_visibility_allowed') THEN
   ALTER TABLE public.products ADD CONSTRAINT products_visibility_allowed
     CHECK(visibility IN ('available','unavailable','hidden'));
 END IF;
END $$;
UPDATE public.products SET is_available=(visibility='available')
 WHERE is_available IS DISTINCT FROM (visibility='available');
CREATE INDEX IF NOT EXISTS products_public_visibility_idx
  ON public.products(condominium_id,visibility,created_at DESC)
  WHERE visibility IN ('available','unavailable');

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_image text;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS logo_image text;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.media_assets ALTER COLUMN shop_id DROP NOT NULL;
-- Imagens de anúncios publicitários não pertencem a loja nem a usuário.
-- Imagens de Desapego também podem usar esse formato de mídia compartilhada.
-- Proibir somente a combinação de dois proprietários ao mesmo tempo.
-- A substituição é reexecutável e preserva arquivos e metadados existentes.
ALTER TABLE public.media_assets DROP CONSTRAINT IF EXISTS media_assets_exactly_one_owner;
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_exactly_one_owner
  CHECK (shop_id IS NULL OR user_id IS NULL);
CREATE INDEX IF NOT EXISTS media_assets_personal_idx ON public.media_assets(user_id)
  WHERE user_id IS NOT NULL;

-- Retry-safe checkout attempts: never create a duplicate order on a lost response.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS client_order_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_key_idx
  ON public.orders(buyer_id,client_order_key) WHERE client_order_key IS NOT NULL;
