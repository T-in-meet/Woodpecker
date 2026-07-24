CREATE TABLE IF NOT EXISTS public.user_agreements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_agreed_at timestamptz NOT NULL,
  privacy_agreed_at timestamptz NOT NULL,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_agreements_source_check
    CHECK (source IN ('email', 'oauth', 'email_backfill'))
);

ALTER TABLE public.user_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_agreements_select_own" ON public.user_agreements;

CREATE POLICY "user_agreements_select_own"
  ON public.user_agreements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS tr_user_agreements_updated_at ON public.user_agreements;

CREATE TRIGGER tr_user_agreements_updated_at
  BEFORE UPDATE ON public.user_agreements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.user_agreements (
  user_id,
  terms_agreed_at,
  privacy_agreed_at,
  source
)
SELECT
  u.id,
  COALESCE(u.created_at, now()),
  COALESCE(u.created_at, now()),
  'email_backfill'
FROM auth.users u
WHERE EXISTS (
  SELECT 1
  FROM auth.identities i
  WHERE i.user_id = u.id
    AND i.provider = 'email'
)
ON CONFLICT (user_id) DO NOTHING;

