-- OAuth provider metadata 기반 닉네임 초기화 정책을 정리합니다.
--
-- 우선순위:
-- 1. raw_user_meta_data.nickname
-- 2. raw_user_meta_data.name
-- 3. raw_user_meta_data.full_name
-- 4. user_{uuid prefix} fallback
--
-- provider 이름은 사용자 입력 닉네임과 동일하게 trim 후 1~10자일 때만 사용합니다.
-- 10자를 초과한 이름을 임의로 자르면 부자연스럽거나 중복 가능성이 커지므로 fallback을 사용합니다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  resolved_nickname text;
BEGIN
  SELECT candidate
    INTO resolved_nickname
  FROM (
    VALUES
      (1, NULLIF(btrim(NEW.raw_user_meta_data->>'nickname'), '')),
      (2, NULLIF(btrim(NEW.raw_user_meta_data->>'name'), '')),
      (3, NULLIF(btrim(NEW.raw_user_meta_data->>'full_name'), ''))
  ) AS nickname_candidates(priority, candidate)
  WHERE candidate IS NOT NULL
    AND char_length(candidate) BETWEEN 1 AND 10
  ORDER BY priority
  LIMIT 1;

  INSERT INTO public.profiles (id, nickname, canonical_email)
  VALUES (
    NEW.id,
    COALESCE(resolved_nickname, 'user_' || substring(NEW.id::text from 1 for 5)),
    NEW.raw_user_meta_data->>'canonical_email'
  );
  RETURN NEW;
END;
$$;
