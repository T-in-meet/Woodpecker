-- 비밀번호 hash를 노출하지 않고 사용자 계정의 password 로그인 가능 여부만 반환합니다.
CREATE OR REPLACE FUNCTION public.has_password_login(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = p_user_id
      AND encrypted_password IS NOT NULL
      AND encrypted_password <> ''
  );
$$;

COMMENT ON FUNCTION public.has_password_login(uuid)
IS 'auth.users의 비밀번호 hash를 노출하지 않고 password 로그인 가능 여부만 반환합니다.';

-- 민감한 auth.users 판정은 서버의 service_role에서만 호출할 수 있습니다.
REVOKE ALL ON FUNCTION public.has_password_login(uuid)
FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.has_password_login(uuid)
TO service_role;
