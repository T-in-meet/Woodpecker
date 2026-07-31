BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_notification_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  type character varying(50) NOT NULL,
  title character varying(200) NOT NULL,
  body text,
  click_path text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT admin_notification_events_pkey PRIMARY KEY (id),
  CONSTRAINT admin_notification_events_type_check
    CHECK (type IN ('FEEDBACK_CREATED', 'OPERATIONAL_ERROR')),
  CONSTRAINT admin_notification_events_click_path_not_empty_check
    CHECK (length(btrim(click_path)) > 0),
  CONSTRAINT admin_notification_events_metadata_object_check
    CHECK (jsonb_typeof(metadata) = 'object')
);

ALTER TABLE public.admin_notification_events
  ADD CONSTRAINT admin_notification_events_created_by_fkey
  FOREIGN KEY (created_by)
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.admin_notification_reads (
  event_id uuid NOT NULL,
  admin_user_id uuid NOT NULL,
  read_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT admin_notification_reads_pkey
    PRIMARY KEY (event_id, admin_user_id),
  CONSTRAINT admin_notification_reads_event_id_fkey
    FOREIGN KEY (event_id)
    REFERENCES public.admin_notification_events(id)
    ON DELETE CASCADE,
  CONSTRAINT admin_notification_reads_admin_user_id_fkey
    FOREIGN KEY (admin_user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS admin_notification_events_created_at_idx
  ON public.admin_notification_events (created_at DESC);

CREATE INDEX IF NOT EXISTS admin_notification_reads_admin_user_id_idx
  ON public.admin_notification_reads (admin_user_id);

ALTER TABLE public.admin_notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notification_reads ENABLE ROW LEVEL SECURITY;

-- 관리자 알림 테이블은 Server Action의 service_role 경로로만 접근한다.
-- 향후 클라이언트 직접 조회가 필요해질 때 관리자 RLS 정책과 함께 권한을 명시적으로 연다.
REVOKE ALL ON TABLE public.admin_notification_events FROM anon;
REVOKE ALL ON TABLE public.admin_notification_events FROM authenticated;
GRANT ALL ON TABLE public.admin_notification_events TO service_role;

REVOKE ALL ON TABLE public.admin_notification_reads FROM anon;
REVOKE ALL ON TABLE public.admin_notification_reads FROM authenticated;
GRANT ALL ON TABLE public.admin_notification_reads TO service_role;

COMMIT;
