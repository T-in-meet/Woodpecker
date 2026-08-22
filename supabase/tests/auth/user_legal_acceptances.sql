BEGIN;

SELECT plan(17);

SELECT has_table(
  'public',
  'user_legal_acceptances',
  'user_legal_acceptances table exists'
);

SELECT col_is_pk(
  'public',
  'user_legal_acceptances',
  'id',
  'id is the primary key'
);

SELECT fk_ok(
  'public',
  'user_legal_acceptances',
  'user_id',
  'auth',
  'users',
  'id',
  'user_id references auth.users'
);

SELECT policies_are(
  'public',
  'user_legal_acceptances',
  ARRAY['user_legal_acceptances_select_own'],
  'only the own-row select policy exists'
);

SELECT table_privs_are(
  'public',
  'user_legal_acceptances',
  'anon',
  ARRAY[]::text[],
  'anon has no table privileges'
);

SELECT table_privs_are(
  'public',
  'user_legal_acceptances',
  'service_role',
  ARRAY['INSERT', 'SELECT'],
  'service role can insert and select but cannot mutate history'
);

SELECT table_privs_are(
  'public',
  'user_legal_acceptances',
  'authenticated',
  ARRAY['SELECT'],
  'authenticated can only select'
);

SELECT table_privs_are(
  'public',
  'user_agreements',
  'service_role',
  ARRAY['SELECT'],
  'the legacy agreements table is read-only during compatibility'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.user_agreements AS legacy
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.user_legal_acceptances AS acceptance
      WHERE acceptance.user_id = legacy.user_id
        AND acceptance.document_version = '2026-03-24'
        AND acceptance.event_type = 'terms_accepted'
    )
    OR NOT EXISTS (
      SELECT 1
      FROM public.user_legal_acceptances AS acceptance
      WHERE acceptance.user_id = legacy.user_id
        AND acceptance.document_version = '2026-03-24'
        AND acceptance.event_type = 'privacy_notice_acknowledged'
    )
  ),
  0::bigint,
  'legacy agreements are backfilled as terms and privacy events'
);

INSERT INTO auth.users (id, aud, role, email, encrypted_password)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated', 'legal-a@example.com', ''),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'authenticated', 'authenticated', 'legal-b@example.com', '');

INSERT INTO public.user_legal_acceptances (
  user_id,
  event_type,
  document_version,
  source
)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'terms_accepted', '2026-03-24', 'email_backfill'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'terms_accepted', '2026-03-24', 'email_backfill');

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'role', 'authenticated'
  )::text,
  true
);

SELECT results_eq(
  $$SELECT user_id FROM public.user_legal_acceptances ORDER BY user_id$$,
  $$VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid)$$,
  'authenticated users only see their own rows'
);

SELECT throws_ok(
  $$INSERT INTO public.user_legal_acceptances (user_id, event_type, document_version, source)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'age_14_confirmed', '2026-09-20', 'agreements_page')$$,
  '42501',
  NULL,
  'authenticated users cannot insert'
);

RESET ROLE;

SELECT throws_ok(
  $$INSERT INTO public.user_legal_acceptances (user_id, event_type, document_version, source)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'unknown', '2026-09-20', 'agreements_page')$$,
  '23514',
  NULL,
  'unsupported event types are rejected'
);

SELECT throws_ok(
  $$INSERT INTO public.user_legal_acceptances (user_id, event_type, document_version, source)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'age_14_confirmed', 'v1', 'agreements_page')$$,
  '23514',
  NULL,
  'document versions must use YYYY-MM-DD'
);

SELECT lives_ok(
  $$INSERT INTO public.user_legal_acceptances (user_id, event_type, document_version, source)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'age_14_confirmed', '2026-09-20', 'agreements_page')$$,
  'agreements_page is an accepted source'
);

SELECT throws_ok(
  $$INSERT INTO public.user_legal_acceptances (user_id, event_type, document_version, source)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'age_14_confirmed', '2026-09-21', 'reconsent')$$,
  '23514',
  NULL,
  'unsupported sources are rejected'
);

SELECT throws_ok(
  $$INSERT INTO public.user_legal_acceptances (user_id, event_type, document_version, source)
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'terms_accepted', '2026-03-24', 'email_backfill')$$,
  '23505',
  NULL,
  'duplicate user event versions are rejected'
);

DELETE FROM auth.users WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

SELECT is(
  (SELECT count(*) FROM public.user_legal_acceptances
    WHERE user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  0::bigint,
  'deleting an auth user cascades to legal acceptances'
);

SELECT finish();
ROLLBACK;
