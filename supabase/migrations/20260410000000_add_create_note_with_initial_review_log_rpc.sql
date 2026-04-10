CREATE OR REPLACE FUNCTION public.create_note_with_initial_review_log(
  p_title text,
  p_content text,
  p_scheduled_at timestamptz,
  p_language text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_note_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_scheduled_at IS NULL THEN
    RAISE EXCEPTION 'scheduled_at is required';
  END IF;

  INSERT INTO public.notes (user_id, title, content, language, next_review_at)
  VALUES (v_user_id, p_title, p_content, p_language, p_scheduled_at)
  RETURNING id INTO v_note_id;

  INSERT INTO public.review_logs (note_id, user_id, round, scheduled_at)
  VALUES (v_note_id, v_user_id, 1, p_scheduled_at);

  RETURN v_note_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_note_with_initial_review_log(text, text, timestamptz, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_note_with_initial_review_log(text, text, timestamptz, text) TO authenticated;
