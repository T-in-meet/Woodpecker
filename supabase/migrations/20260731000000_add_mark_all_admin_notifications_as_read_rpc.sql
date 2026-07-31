BEGIN;

CREATE OR REPLACE FUNCTION public.mark_all_admin_notifications_as_read(
  p_admin_user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_count integer := 0;
BEGIN
  INSERT INTO public.admin_notification_reads (
    event_id,
    admin_user_id
  )
  SELECT
    event.id,
    p_admin_user_id
  FROM public.admin_notification_events AS event
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.admin_notification_reads AS read
    WHERE read.event_id = event.id
      AND read.admin_user_id = p_admin_user_id
  );

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  RETURN v_inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_all_admin_notifications_as_read(uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_all_admin_notifications_as_read(uuid)
  FROM anon;
REVOKE ALL ON FUNCTION public.mark_all_admin_notifications_as_read(uuid)
  FROM authenticated;
GRANT ALL ON FUNCTION public.mark_all_admin_notifications_as_read(uuid)
  TO service_role;

COMMIT;
