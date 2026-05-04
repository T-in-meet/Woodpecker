-- 잔존 SKIPPED 행을 READ로 백필 (UI는 이미 SKIPPED를 "읽음"으로 표시하므로 의미 동등)
UPDATE public.notifications
SET status = 'READ'
WHERE status = 'SKIPPED';

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_status_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_status_check
  CHECK (((status)::text = ANY ((ARRAY['SENT'::character varying, 'READ'::character varying])::text[])))
  NOT VALID;

ALTER TABLE public.notifications
  VALIDATE CONSTRAINT notifications_status_check;

ALTER TABLE public.notifications
  DROP COLUMN IF EXISTS skipped_at;
