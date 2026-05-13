BEGIN;

-- Orphan REVIEW notifications cannot navigate to a note or be completed, so remove them before enforcing note ownership.
DO $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM public.notifications
  WHERE type = 'REVIEW'
    AND note_id IS NULL;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % orphan REVIEW notifications before enforcing note_id constraints.', v_deleted_count;
END $$;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_note_id_fkey;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_note_id_fkey
  FOREIGN KEY (note_id)
  REFERENCES public.notes(id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.notifications
  VALIDATE CONSTRAINT notifications_note_id_fkey;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_review_note_id_not_null_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_review_note_id_not_null_check
  CHECK (type <> 'REVIEW' OR note_id IS NOT NULL)
  NOT VALID;

ALTER TABLE public.notifications
  VALIDATE CONSTRAINT notifications_review_note_id_not_null_check;

COMMIT;
