-- Persist shop bookmarks per resident and condominium.
-- No direct Data API access: only the authenticated Condovery backend may query.
CREATE TABLE IF NOT EXISTS shop_favorites (
  condominium_id uuid NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (condominium_id, user_id, shop_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_favorites_user_recent
  ON shop_favorites(condominium_id,user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_favorites_shop
  ON shop_favorites(shop_id);
ALTER TABLE shop_favorites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE shop_favorites FROM PUBLIC;
