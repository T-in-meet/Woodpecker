ALTER TABLE public.review_logs
  ADD COLUMN notification_claimed_at timestamptz NULL,
  ADD COLUMN notification_dispatched_at timestamptz NULL,
  ADD COLUMN notification_base_scheduled_at timestamptz NULL,
  ADD COLUMN notification_dispatch_attempts integer DEFAULT 0 NOT NULL,
  ADD COLUMN notification_dispatch_failed_at timestamptz NULL,
  ADD CONSTRAINT review_logs_notification_dispatch_attempts_check
    CHECK (notification_dispatch_attempts >= 0);

COMMENT ON COLUMN public.review_logs.notification_base_scheduled_at IS
  'Stores the unshifted cadence timestamp so clearing a custom notification time can restore the review schedule.';

ALTER TABLE public.notifications
  ADD COLUMN review_log_id uuid NULL REFERENCES public.review_logs(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX notifications_review_log_id_type_key
  ON public.notifications (review_log_id, type);

CREATE INDEX review_logs_pending_dispatch_idx
  ON public.review_logs (scheduled_at, notification_claimed_at)
  WHERE completed_at IS NULL
    AND notification_dispatched_at IS NULL
    AND notification_dispatch_failed_at IS NULL;
