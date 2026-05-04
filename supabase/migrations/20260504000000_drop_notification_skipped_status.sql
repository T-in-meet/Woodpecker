DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.notifications
    WHERE status = 'SKIPPED'
  ) THEN
    RAISE EXCEPTION 'Cannot drop SKIPPED notification status while rows still use it.';
  END IF;
END;
$$;

DO $$
DECLARE
  v_has_skipped_at boolean;
  v_has_skipped_at_values boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'skipped_at'
  )
  INTO v_has_skipped_at;

  IF v_has_skipped_at THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.notifications WHERE skipped_at IS NOT NULL)'
    INTO v_has_skipped_at_values;

    IF v_has_skipped_at_values THEN
      RAISE EXCEPTION 'Cannot drop notifications.skipped_at while non-null values exist.';
    END IF;
  END IF;
END;
$$;

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
