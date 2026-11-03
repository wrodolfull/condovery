-- Expand the existing inbox to include seller reviews and completion reminders,
-- plus a buyer notification when their published review is moderated.
-- Idempotent for the project's re-runnable migration process.
ALTER TABLE public.push_notifications
  DROP CONSTRAINT IF EXISTS push_notifications_kind_check;
ALTER TABLE public.push_notifications
  ADD CONSTRAINT push_notifications_kind_check
  CHECK (kind IN ('condominium','shop','order','seller_order',
                 'seller_review','seller_reminder','review_update',
                 'discovery_shop','discovery_products','discovery_sunday'));

-- Worker scans only confirmed orders past their next action time.
CREATE INDEX IF NOT EXISTS idx_orders_completion_reminder_due
  ON public.orders(updated_at, id) WHERE status='confirmed';
