-- Efficient keyset history for buyer and seller queries. These coexist with
-- created_at indexes used by older reports.
CREATE INDEX IF NOT EXISTS idx_orders_buyer_history_code
  ON orders(condominium_id,buyer_id,code DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shop_history_code
  ON orders(condominium_id,shop_id,code DESC);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_history_status_code
  ON orders(condominium_id,buyer_id,status,code DESC);
