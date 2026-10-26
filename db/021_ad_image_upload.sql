ALTER TABLE advertising_campaigns DROP CONSTRAINT IF EXISTS valid_ad_image;
ALTER TABLE advertising_campaigns ADD CONSTRAINT valid_ad_image CHECK (image_url ~ '^/api/media/[0-9a-fA-F-]{36}$');
