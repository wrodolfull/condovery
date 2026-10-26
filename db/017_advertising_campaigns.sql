-- ADS: ativação global e campanhas por condomínio.
CREATE TABLE IF NOT EXISTS ads_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ads_settings(id,enabled) VALUES(true,false) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS advertising_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
  merchant_name varchar(100) NOT NULL,
  headline varchar(140) NOT NULL,
  description varchar(400) NOT NULL DEFAULT '',
  location varchar(120) NOT NULL,
  image_url text NOT NULL,
  destination_url text NOT NULL,
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_ad_dates CHECK(expires_at > starts_at),
  CONSTRAINT valid_ad_image CHECK(image_url ~ '^https://[^[:space:]]+$'),
  CONSTRAINT valid_ad_destination CHECK(destination_url ~ '^https://[^[:space:]]+$')
);
CREATE INDEX IF NOT EXISTS ads_active_window_idx ON advertising_campaigns(condominium_id,enabled,starts_at,expires_at);
