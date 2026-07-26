BEGIN;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS click_path text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.notifications
SET click_path = '/notes/' || note_id::text || '/review'
WHERE click_path IS NULL
  AND type = 'REVIEW'
  AND note_id IS NOT NULL;

UPDATE public.notifications
SET click_path = '/'
WHERE click_path IS NULL;

ALTER TABLE public.notifications
  ALTER COLUMN click_path SET NOT NULL;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('REVIEW', 'SYSTEM', 'FEEDBACK_REPLY'))
  NOT VALID;

ALTER TABLE public.notifications
  VALIDATE CONSTRAINT notifications_type_check;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_metadata_object_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_metadata_object_check
  CHECK (jsonb_typeof(metadata) = 'object')
  NOT VALID;

ALTER TABLE public.notifications
  VALIDATE CONSTRAINT notifications_metadata_object_check;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_click_path_not_empty_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_click_path_not_empty_check
  CHECK (length(btrim(click_path)) > 0)
  NOT VALID;

ALTER TABLE public.notifications
  VALIDATE CONSTRAINT notifications_click_path_not_empty_check;

CREATE INDEX IF NOT EXISTS notifications_user_status_sent_at_idx
  ON public.notifications (user_id, status, sent_at DESC);

COMMIT;
