BEGIN;

CREATE OR REPLACE FUNCTION public.update_operational_error_status_with_history(
  p_operational_error_id uuid,
  p_status character varying,
  p_resolution_note text,
  p_admin_user_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_error record;
  has_note boolean := length(btrim(coalesce(p_resolution_note, ''))) > 0;
BEGIN
  SELECT fingerprint, status
  INTO current_error
  FROM public.operational_errors
  WHERE id = p_operational_error_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  IF current_error.status = p_status AND NOT has_note THEN
    RETURN 'NO_CHANGES';
  END IF;

  IF current_error.status <> 'OPEN' AND p_status = 'OPEN' AND EXISTS (
    SELECT 1
    FROM public.operational_errors
    WHERE fingerprint = current_error.fingerprint
      AND status = 'OPEN'
      AND id <> p_operational_error_id
  ) THEN
    RETURN 'OPEN_DUPLICATE';
  END IF;

  UPDATE public.operational_errors
  SET
    resolution_note = CASE
      WHEN p_status = 'OPEN' THEN NULL
      WHEN has_note THEN btrim(p_resolution_note)
      ELSE NULL
    END,
    resolved_at = CASE
      WHEN p_status = 'OPEN' THEN NULL
      ELSE now()
    END,
    resolved_by = CASE
      WHEN p_status = 'OPEN' THEN NULL
      ELSE p_admin_user_id
    END,
    status = p_status
  WHERE id = p_operational_error_id;

  INSERT INTO public.operational_error_status_history (
    changed_by,
    from_status,
    note,
    operational_error_id,
    to_status
  )
  VALUES (
    p_admin_user_id,
    current_error.status,
    CASE WHEN has_note THEN btrim(p_resolution_note) ELSE NULL END,
    p_operational_error_id,
    p_status
  );

  RETURN 'OK';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_unread_notification_counts(
  p_admin_user_id uuid
)
RETURNS TABLE (
  type character varying,
  unread_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    event.type,
    count(*)::bigint AS unread_count
  FROM public.admin_notification_events AS event
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.admin_notification_reads AS read
    WHERE read.event_id = event.id
      AND read.admin_user_id = p_admin_user_id
  )
  GROUP BY event.type;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_unread_notification_list(
  p_admin_user_id uuid,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  title character varying,
  body text,
  type character varying,
  click_path text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    event.id,
    event.title,
    event.body,
    event.type,
    event.click_path,
    event.created_at
  FROM public.admin_notification_events AS event
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.admin_notification_reads AS read
    WHERE read.event_id = event.id
      AND read.admin_user_id = p_admin_user_id
  )
  ORDER BY event.created_at DESC
  LIMIT greatest(1, least(coalesce(p_limit, 20), 50));
$$;

REVOKE ALL ON FUNCTION public.update_operational_error_status_with_history(
  uuid,
  character varying,
  text,
  uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_operational_error_status_with_history(
  uuid,
  character varying,
  text,
  uuid
) FROM anon;
REVOKE ALL ON FUNCTION public.update_operational_error_status_with_history(
  uuid,
  character varying,
  text,
  uuid
) FROM authenticated;
GRANT ALL ON FUNCTION public.update_operational_error_status_with_history(
  uuid,
  character varying,
  text,
  uuid
) TO service_role;

REVOKE ALL ON FUNCTION public.get_admin_unread_notification_counts(uuid)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_unread_notification_counts(uuid)
  FROM anon;
REVOKE ALL ON FUNCTION public.get_admin_unread_notification_counts(uuid)
  FROM authenticated;
GRANT ALL ON FUNCTION public.get_admin_unread_notification_counts(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.get_admin_unread_notification_list(uuid, integer)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_unread_notification_list(uuid, integer)
  FROM anon;
REVOKE ALL ON FUNCTION public.get_admin_unread_notification_list(uuid, integer)
  FROM authenticated;
GRANT ALL ON FUNCTION public.get_admin_unread_notification_list(uuid, integer)
  TO service_role;

COMMIT;
