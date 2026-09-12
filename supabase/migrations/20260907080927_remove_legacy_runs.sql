BEGIN;

DROP FUNCTION public.get_admin_note_chat_run_list(
  text,
  text[],
  uuid[],
  boolean,
  timestamp with time zone,
  timestamp with time zone,
  text,
  text,
  integer,
  integer
);

DROP VIEW public.admin_note_chat_run_detail;

DROP TABLE public.note_chat_runs;

DROP TABLE public.related_note_recommendation_runs;

COMMIT;
