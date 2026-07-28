-- 관리자 사용자 목록 조회에 필요한 사용자 정보와 약관 정보를 하나로 결합합니다.
--
-- 검색, 필터, 정렬, 페이지네이션을 애플리케이션 메모리가 아닌
-- 데이터베이스에서 처리할 수 있도록 목록 전용 View를 제공합니다.
CREATE VIEW public.admin_user_list
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.nickname,
  p.avatar_url,
  p.canonical_email,
  p.role,
  p.created_at,

  -- user_agreements 레코드가 없는 사용자는 NULL로 반환합니다.
  ua.source AS agreement_source,

  -- email_backfill은 테스트 또는 데이터 보정용 값이므로
  -- 관리자 화면에서는 일반 이메일 가입과 동일하게 취급합니다.
  CASE
    WHEN ua.source = 'oauth' THEN 'OAUTH'
    WHEN ua.source IN ('email', 'email_backfill') THEN 'EMAIL'
    ELSE NULL
  END AS signup_method,

  -- 실제 동의 시각의 존재 여부를 화면에서 사용하기 쉬운 boolean으로 변환합니다.
  ua.terms_agreed_at IS NOT NULL AS terms_agreed,
  ua.privacy_agreed_at IS NOT NULL AS privacy_agreed,

  -- 이용약관과 개인정보 처리방침의 동의 상태를 하나의 값으로 제공합니다.
  CASE
    WHEN ua.terms_agreed_at IS NOT NULL
      AND ua.privacy_agreed_at IS NOT NULL
      THEN 'COMPLETED'
    WHEN ua.terms_agreed_at IS NULL
      AND ua.privacy_agreed_at IS NULL
      THEN 'NOT_AGREED'
    ELSE 'PARTIAL'
  END AS agreement_status
FROM public.profiles AS p
LEFT JOIN public.user_agreements AS ua
  ON ua.user_id = p.id;


-- View와 각 파생 컬럼의 목적을 PostgreSQL 메타데이터에 기록합니다.
COMMENT ON VIEW public.admin_user_list IS
  '관리자 사용자 목록의 검색, 필터, 정렬, 페이지네이션을 위한 조회 전용 View';

COMMENT ON COLUMN public.admin_user_list.id IS
  'auth.users.id를 참조하는 사용자 ID';

COMMENT ON COLUMN public.admin_user_list.nickname IS
  '사용자 닉네임';

COMMENT ON COLUMN public.admin_user_list.avatar_url IS
  '사용자 프로필 이미지 URL';

COMMENT ON COLUMN public.admin_user_list.canonical_email IS
  '관리자 목록 표시와 검색에 사용하는 정규화 이메일';

COMMENT ON COLUMN public.admin_user_list.role IS
  '사용자 Role: USER 또는 ADMIN';

COMMENT ON COLUMN public.admin_user_list.created_at IS
  'profiles 레코드 생성 시각으로 사용하는 사용자 가입일';

COMMENT ON COLUMN public.admin_user_list.agreement_source IS
  '약관 동의 레코드 생성 경로: email, oauth 또는 email_backfill';

COMMENT ON COLUMN public.admin_user_list.signup_method IS
  '관리자 화면용 가입 방법: EMAIL 또는 OAUTH';

COMMENT ON COLUMN public.admin_user_list.terms_agreed IS
  '이용약관 동의 시각 존재 여부';

COMMENT ON COLUMN public.admin_user_list.privacy_agreed IS
  '개인정보 처리방침 동의 시각 존재 여부';

COMMENT ON COLUMN public.admin_user_list.agreement_status IS
  '통합 약관 동의 상태: COMPLETED, NOT_AGREED 또는 PARTIAL';


-- 관리자용 Server Action에서 service role로만 조회하도록 권한을 제한합니다.
REVOKE ALL ON TABLE public.admin_user_list FROM anon, authenticated;
GRANT SELECT ON TABLE public.admin_user_list TO service_role;