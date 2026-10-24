-- Execute against PostgreSQL 15+ with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS condominiums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  invite_code_hash text NOT NULL,
  towers jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES condominiums(id),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'resident' CHECK (role IN ('resident','admin')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended')),
  tower text NOT NULL,
  apartment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_condo_status ON users(condominium_id,status);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  ip text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(email, ip, occurred_at);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES condominiums(id),
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'shopping-bag',
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE(condominium_id,name)
);

CREATE TABLE IF NOT EXISTS shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES condominiums(id),
  owner_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  whatsapp text NOT NULL,
  cover_image text,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','suspended')),
  is_open boolean NOT NULL DEFAULT true,
  delivery_enabled boolean NOT NULL DEFAULT true,
  pickup_enabled boolean NOT NULL DEFAULT true,
  lead_time text NOT NULL DEFAULT '',
  pickup_instructions text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id)
);
CREATE INDEX IF NOT EXISTS idx_shops_condo_status ON shops(condominium_id,status);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES condominiums(id),
  shop_id uuid NOT NULL REFERENCES shops(id),
  category_id uuid REFERENCES categories(id),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_cents integer NOT NULL CHECK(price_cents > 0),
  promo_price_cents integer CHECK(promo_price_cents > 0),
  stock integer CHECK(stock >= 0),
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  lead_time text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (promo_price_cents IS NULL OR promo_price_cents < price_cents)
);
CREATE INDEX IF NOT EXISTS idx_products_condo_shop ON products(condominium_id,shop_id,is_available);

CREATE TABLE IF NOT EXISTS media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES condominiums(id),
  shop_id uuid NOT NULL REFERENCES shops(id),
  mime text NOT NULL CHECK(mime IN ('image/jpeg','image/png','image/webp')),
  bytes bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  condominium_id uuid NOT NULL REFERENCES condominiums(id),
  buyer_id uuid NOT NULL REFERENCES users(id),
  shop_id uuid NOT NULL REFERENCES shops(id),
  status text NOT NULL DEFAULT 'awaiting_confirmation'
    CHECK(status IN ('awaiting_confirmation','confirmed','completed','cancelled')),
  fulfillment text NOT NULL CHECK (fulfillment IN ('delivery','pickup')),
  delivery_day date,
  delivery_window text NOT NULL DEFAULT '',
  delivery_instructions jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text NOT NULL DEFAULT '',
  total_cents integer NOT NULL CHECK (total_cents > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(condominium_id,buyer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_shop ON orders(condominium_id,shop_id,created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  name_snapshot text NOT NULL,
  quantity integer NOT NULL CHECK(quantity > 0),
  unit_price_cents integer NOT NULL CHECK(unit_price_cents > 0),
  note text NOT NULL DEFAULT ''
);
