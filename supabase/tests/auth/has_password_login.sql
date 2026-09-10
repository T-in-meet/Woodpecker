BEGIN;

SELECT plan(7);

-- 비밀번호 존재 여부 함수가 생성되었는지 검증합니다.
SELECT has_function(
  'public',
  'has_password_login',
  ARRAY['uuid'],
  'has_password_login function exists'
);

INSERT INTO auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  raw_app_meta_data
)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'authenticated',
    'authenticated',
    'password-null@example.com',
    NULL,
    '{"providers":["google"]}'::jsonb
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'authenticated',
    'authenticated',
    'password-empty@example.com',
    '',
    '{"providers":["email"]}'::jsonb
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'authenticated',
    'authenticated',
    'password-set@example.com',
    '$2a$10$test-password-hash',
    '{"providers":["google"]}'::jsonb
  );

-- encrypted_password가 NULL이면 provider와 무관하게 false를 반환합니다.
SELECT is(
  public.has_password_login('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  false,
  'null encrypted password returns false'
);

-- encrypted_password가 빈 문자열이면 email provider가 있어도 false를 반환합니다.
SELECT is(
  public.has_password_login('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  false,
  'empty encrypted password returns false'
);

-- Google provider만 있어도 encrypted_password가 존재하면 true를 반환합니다.
SELECT is(
  public.has_password_login('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  true,
  'non-empty encrypted password returns true for a Google-only user'
);

-- service_role은 함수를 실행할 수 있습니다.
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.has_password_login(uuid)',
    'EXECUTE'
  ),
  'service_role can execute has_password_login'
);

-- authenticated는 함수를 실행할 수 없습니다.
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.has_password_login(uuid)',
    'EXECUTE'
  ),
  'authenticated cannot execute has_password_login'
);

-- anon은 함수를 실행할 수 없습니다.
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.has_password_login(uuid)',
    'EXECUTE'
  ),
  'anon cannot execute has_password_login'
);

SELECT finish();
ROLLBACK;
