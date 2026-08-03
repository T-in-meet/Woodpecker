BEGIN;

CREATE OR REPLACE FUNCTION public.mark_notification_as_read(p_notification_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email_confirmed_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT email_confirmed_at
    INTO v_email_confirmed_at
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'email not confirmed';
  END IF;

  UPDATE public.notifications
  SET status = 'READ',
      read_at = COALESCE(read_at, clock_timestamp())
  WHERE id = p_notification_id
    AND user_id = v_user_id
    AND status = 'SENT'
    AND type <> 'REVIEW';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notification_as_read(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_notification_as_read(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_feedback_reply_with_notifications(
  p_feedback_id uuid
)
RETURNS TABLE (
  image_paths text[],
  deleted_notification_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feedback_user_id uuid;
  v_reply_id uuid;
  v_image_paths text[];
BEGIN
  SELECT f.user_id
    INTO v_feedback_user_id
  FROM public.feedbacks AS f
  WHERE f.id = p_feedback_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'feedback_not_found';
  END IF;

  SELECT fr.id, fr.image_paths
    INTO v_reply_id, v_image_paths
  FROM public.feedback_replies AS fr
  WHERE fr.feedback_id = p_feedback_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'feedback_reply_not_found';
  END IF;

  DELETE FROM public.notifications AS n
  WHERE n.user_id = v_feedback_user_id
    AND n.type = 'FEEDBACK_REPLY'
    AND n.metadata->>'feedbackId' = p_feedback_id::text;

  GET DIAGNOSTICS deleted_notification_count = ROW_COUNT;

  DELETE FROM public.feedback_replies AS fr
  WHERE fr.id = v_reply_id;

  UPDATE public.feedbacks AS f
  SET status = 'OPEN'
  WHERE f.id = p_feedback_id;

  image_paths := COALESCE(v_image_paths, '{}'::text[]);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_feedback_reply_with_notifications(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_feedback_reply_with_notifications(uuid)
  TO service_role;

COMMIT;
