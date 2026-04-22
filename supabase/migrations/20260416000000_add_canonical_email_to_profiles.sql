-- 이메일 정규화 시스템 구현
--
-- 목적:
-- - profiles 테이블에 canonical_email 컬럼 추가
-- - Gmail alias를 동일 identity로 취급 (user+tag@gmail.com == user@gmail.com)
-- - signup/resend/rate-limit에서 canonical_email 기반 처리
--
-- 설계:
-- 1. canonical_email: nullable TEXT 컬럼 (기존 rows 영향 없음)
-- 2. partial UNIQUE index: null 제외 unique 보장
-- 3. handle_new_user() trigger 수정: user_metadata의 canonical_email을 profiles에 기록
--
-- 운영 전제 (중요):
-- - 현재 환경은 기존 사용자 데이터를 유지하는 마이그레이션이 아니라
--   "기존 계정 삭제 후 재가입" 절차를 따른다.
-- - 따라서 legacy row(canonical_email IS NULL) backfill UPDATE는 의도적으로 생략한다.
-- - 추후 기존 사용자 데이터를 유지한 채 배포하는 시점에는 backfill migration을 별도로 추가해야 한다.

-- 1. canonical_email 컬럼 추가 (nullable)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS canonical_email TEXT;

-- 2. partial UNIQUE index — null 제외하고 unique 보장
-- 이유: 기존 rows는 canonical_email = null인데, null은 UNIQUE 제약에서 중복 허용
-- 따라서 "WHERE canonical_email IS NOT NULL" 조건으로 index 생성
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_canonical_email_unique
  ON public.profiles (canonical_email)
  WHERE canonical_email IS NOT NULL;

-- 3. handle_new_user() trigger 함수 수정
--    - canonical_email을 raw_user_meta_data에서 읽어 profiles에 기록
--    - avatar_url은 signup 범위에서 제외 → trigger에서 제거 (mypage 정책)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, nickname, canonical_email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', 'user_' || substring(NEW.id::text from 1 for 5)),
    NEW.raw_user_meta_data->>'canonical_email'
  );
  RETURN NEW;
END;
$$;
