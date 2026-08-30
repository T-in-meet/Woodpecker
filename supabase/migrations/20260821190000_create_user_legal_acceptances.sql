CREATE TABLE IF NOT EXISTS public.user_legal_acceptances (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  document_version text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  CONSTRAINT user_legal_acceptances_event_type_check CHECK (
    event_type IN (
      'terms_accepted',
      'privacy_notice_acknowledged',
      'age_14_confirmed'
    )
  ),
  CONSTRAINT user_legal_acceptances_document_version_check CHECK (
    document_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ),
  CONSTRAINT user_legal_acceptances_source_check CHECK (
    source IN ('email', 'oauth', 'email_backfill', 'reconsent')
  ),
  CONSTRAINT user_legal_acceptances_user_event_version_key UNIQUE (
    user_id,
    event_type,
    document_version
  )
);

ALTER TABLE public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_legal_acceptances FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.user_legal_acceptances_id_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.user_legal_acceptances TO authenticated;
GRANT SELECT, INSERT ON TABLE public.user_legal_acceptances TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.user_legal_acceptances_id_seq TO service_role;

DROP POLICY IF EXISTS "user_legal_acceptances_select_own"
  ON public.user_legal_acceptances;

CREATE POLICY "user_legal_acceptances_select_own"
  ON public.user_legal_acceptances
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

INSERT INTO public.user_legal_acceptances (
  user_id,
  event_type,
  document_version,
  occurred_at,
  source
)
SELECT
  user_id,
  event.event_type,
  '2026-03-24',
  CASE event.event_type
    WHEN 'terms_accepted' THEN terms_agreed_at
    ELSE privacy_agreed_at
  END,
  source
FROM public.user_agreements
CROSS JOIN (
  VALUES
    ('terms_accepted'),
    ('privacy_notice_acknowledged')
) AS event(event_type)
ON CONFLICT (user_id, event_type, document_version) DO NOTHING;

-- 호환 기간에는 기존 조회만 허용하고 새 동의 기록은 신규 테이블에만 쌓는다.
REVOKE ALL ON TABLE public.user_agreements FROM anon, authenticated, service_role;
GRANT SELECT ON TABLE public.user_agreements TO authenticated, service_role;

COMMENT ON TABLE public.user_legal_acceptances IS
  'Append-only audit log for terms acceptance, privacy notice acknowledgement, and age eligibility confirmation.';
