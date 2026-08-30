BEGIN;

ALTER TABLE public.admin_notification_events
  ADD COLUMN IF NOT EXISTS feedback_id uuid;

-- 기존 FEEDBACK_CREATED 이벤트 중 현재 피드백을 가리키는 정상 metadata만 backfill한다.
UPDATE public.admin_notification_events AS event
SET feedback_id = feedback.id
FROM public.feedbacks AS feedback
WHERE event.type = 'FEEDBACK_CREATED'
  AND event.feedback_id IS NULL
  AND feedback.id = CASE
    WHEN event.metadata ->> 'feedbackId'
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (event.metadata ->> 'feedbackId')::uuid
    ELSE NULL
  END;

-- 대상이 없거나 metadata가 잘못된 기존 이벤트는 이미 클릭할 수 없는 알림이므로 제거한다.
-- admin_notification_reads는 기존 event_id FK의 ON DELETE CASCADE로 함께 정리된다.
DELETE FROM public.admin_notification_events
WHERE type = 'FEEDBACK_CREATED'
  AND feedback_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_notification_events_feedback_id_fkey'
      AND conrelid = 'public.admin_notification_events'::regclass
  ) THEN
    ALTER TABLE public.admin_notification_events
      ADD CONSTRAINT admin_notification_events_feedback_id_fkey
      FOREIGN KEY (feedback_id)
      REFERENCES public.feedbacks(id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_notification_events_feedback_target_check'
      AND conrelid = 'public.admin_notification_events'::regclass
  ) THEN
    ALTER TABLE public.admin_notification_events
      ADD CONSTRAINT admin_notification_events_feedback_target_check
      CHECK (
        (type = 'FEEDBACK_CREATED' AND feedback_id IS NOT NULL)
        OR (type <> 'FEEDBACK_CREATED' AND feedback_id IS NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS admin_notification_events_feedback_id_idx
  ON public.admin_notification_events (feedback_id)
  WHERE feedback_id IS NOT NULL;

COMMIT;
