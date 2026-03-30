ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS language VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'notes_language_check'
  ) THEN
    ALTER TABLE public.notes
    ADD CONSTRAINT notes_language_check
    CHECK (
      language IS NULL OR language IN (
        'markdown',
        'javascript',
        'typescript',
        'python',
        'rust',
        'go'
      )
    );
  END IF;
END $$;

