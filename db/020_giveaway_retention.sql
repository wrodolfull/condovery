ALTER TABLE giveaway_items ADD COLUMN IF NOT EXISTS donated_at timestamptz;
UPDATE giveaway_items SET donated_at=updated_at WHERE status='donated' AND donated_at IS NULL;
CREATE INDEX IF NOT EXISTS giveaway_donated_expiry_idx ON giveaway_items(donated_at) WHERE status='donated';
