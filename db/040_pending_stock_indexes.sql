-- Pending orders allocate available stock until seller confirmation/cancellation.
-- Improve lookups for buyer product lists and serialized checkout checks.
CREATE INDEX IF NOT EXISTS idx_order_items_product_order
  ON order_items(product_id, order_id);
CREATE INDEX IF NOT EXISTS idx_orders_pending_shop
  ON orders(condominium_id, shop_id, id)
  WHERE status='awaiting_confirmation';
