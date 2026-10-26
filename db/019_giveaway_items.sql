-- Desapego é uma categoria de navegação, mas os itens não pertencem a lojas.
INSERT INTO categories(condominium_id,name,icon,sort_order,is_active)
SELECT c.id,'Desapego','gift',72,false FROM condominiums c
ON CONFLICT(condominium_id,name) DO NOTHING;
UPDATE categories SET icon='gift' WHERE name='Desapego' AND icon IS DISTINCT FROM 'gift';
CREATE TABLE IF NOT EXISTS giveaway_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(120) NOT NULL,
  description varchar(600) NOT NULL DEFAULT '',
  image_url text,
  status varchar(16) NOT NULL DEFAULT 'available' CHECK(status IN ('available','reserved','donated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS giveaway_items_feed_idx ON giveaway_items(condominium_id,status,created_at DESC);
