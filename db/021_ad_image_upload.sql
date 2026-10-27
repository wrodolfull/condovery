-- Institutional advertisements have no shop/user owner. Preserve mutual exclusivity for personal/shop media.
ALTER TABLE public.media_assets DROP CONSTRAINT IF EXISTS media_assets_exactly_one_owner;
ALTER TABLE public.media_assets DROP CONSTRAINT IF EXISTS media_assets_owner_check;
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_owner_check CHECK (shop_id IS NULL OR user_id IS NULL);

ALTER TABLE advertising_campaigns DROP CONSTRAINT IF EXISTS valid_ad_image;
-- URLs antigas continuam legíveis; novos anúncios usam somente o endpoint de upload.
ALTER TABLE advertising_campaigns ADD CONSTRAINT valid_ad_image CHECK (
 image_url ~ '^/api/media/[0-9a-fA-F-]{36}$'
 OR image_url ~ '^https://[^[:space:]]+$'
);
