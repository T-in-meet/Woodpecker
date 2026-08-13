-- =========================================
-- ai / prompt creation RPCs
-- =========================================

BEGIN;

-- 이 파일에서 수행할 pgTAP assertion 수가 11개인지 선언합니다.
SELECT plan(11);


-- =========================================
-- Test fixtures
-- =========================================

-- Prompt 생성 RPC에서 created_by로 사용할 테스트 관리자 ID를 생성합니다.
SELECT set_config(
  'test.ai_create_admin_id',
  gen_random_uuid()::text,
  true
);

-- Prompt Family가 참조할 테스트용 Agent ID를 생성합니다.
SELECT set_config(
  'test.ai_create_agent_id',
  gen_random_uuid()::text,
  true
);

-- seed.sql에 의존하지 않도록 Prompt Version의 created_by가 참조할
-- auth.users fixture를 테스트 내부에서 직접 생성합니다.
INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at
)
VALUES (
  current_setting('test.ai_create_admin_id')::uuid,
  'ai_create_'
    || current_setting('test.ai_create_admin_id')
    || '@example.com',
  now()
);

-- seed.sql에 의존하지 않도록 Prompt Family가 참조할
-- Agent fixture를 테스트 내부에서 직접 생성합니다.
INSERT INTO public.ai_prompt_agents (
  id,
  display_name
)
VALUES (
  current_setting('test.ai_create_agent_id')::uuid,
  'Creation RPC agent'
);


-- =========================================
-- RPC existence
-- =========================================

-- Family와 초기 v1 Draft Version을 함께 생성하는
-- create_ai_prompt_family_with_initial_version() RPC가
-- 정확한 signature로 존재하는지 검증합니다.
SELECT ok(
  to_regprocedure(
    'public.create_ai_prompt_family_with_initial_version(uuid,text,text,text[],text,text,text,text,jsonb,jsonb,uuid)'
  ) IS NOT NULL,
  'create_ai_prompt_family_with_initial_version() should exist'
);

-- 기존 Family에 새로운 Draft Version을 추가하는
-- create_ai_prompt_version() RPC가 정확한 signature로 존재하는지 검증합니다.
SELECT ok(
  to_regprocedure(
    'public.create_ai_prompt_version(uuid,text,text,text,text,jsonb,jsonb,text[],uuid)'
  ) IS NOT NULL,
  'create_ai_prompt_version() should exist'
);


-- =========================================
-- Family creation RPC
-- =========================================

-- Family 생성 RPC를 실행하고 반환된 Family ID를 이후 검증에서 사용할 수 있도록 저장합니다.
SELECT set_config(
  'test.ai_create_family_id',
  public.create_ai_prompt_family_with_initial_version(
    current_setting('test.ai_create_agent_id')::uuid,
    'Default',
    'Family created by SQL test',
    ARRAY['test'],
    'Initial draft',
    'initial',
    'system template',
    'user template',
    '{}'::jsonb,
    '["question"]'::jsonb,
    current_setting('test.ai_create_admin_id')::uuid
  )::text,
  true
);

-- Family 생성 RPC가 지정한 Agent에 속한 Family를
-- 실제로 생성하는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.ai_prompt_families
    WHERE id = current_setting('test.ai_create_family_id')::uuid
      AND agent_id = current_setting('test.ai_create_agent_id')::uuid
      AND display_name = 'Default'
  ),
  'family creation RPC should create a family'
);

-- Family 생성 RPC가 Family와 함께 version_number 1의 Draft Version을
-- 생성하고 created_by를 관리자 사용자로 기록하는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.ai_prompt_versions
    WHERE family_id = current_setting('test.ai_create_family_id')::uuid
      AND version_number = 1
      AND lifecycle_status = 'draft'
      AND created_by = current_setting('test.ai_create_admin_id')::uuid
  ),
  'family creation RPC should create v1 draft'
);


-- =========================================
-- Version creation RPC
-- =========================================

-- 기존 Family에 두 번째 Prompt Version을 생성하고 반환된 Version ID를 저장합니다.
SELECT set_config(
  'test.ai_create_version_id',
  public.create_ai_prompt_version(
    current_setting('test.ai_create_family_id')::uuid,
    'Second draft',
    'second',
    'system template 2',
    'user template 2',
    '{}'::jsonb,
    '["question"]'::jsonb,
    ARRAY['test'],
    current_setting('test.ai_create_admin_id')::uuid
  )::text,
  true
);

-- create_ai_prompt_version()이 동일 Family의 기존 최대 version_number 다음 값을
-- 자동으로 할당하는지 검증합니다.
SELECT is(
  (
    SELECT version_number
    FROM public.ai_prompt_versions
    WHERE id = current_setting('test.ai_create_version_id')::uuid
  ),
  2,
  'create_ai_prompt_version() should allocate the next family version number'
);

-- 새로 생성한 Prompt Version이 항상 Draft 상태로 시작하는지 검증합니다.
SELECT is(
  (
    SELECT lifecycle_status
    FROM public.ai_prompt_versions
    WHERE id = current_setting('test.ai_create_version_id')::uuid
  ),
  'draft',
  'new prompt version should start as draft'
);

-- 존재하지 않는 Family ID로 Prompt Version 생성을 요청하면
-- 23503 오류와 명시적인 오류 메시지로 거부하는지 검증합니다.
SELECT throws_ok(
  format(
    $$
      SELECT public.create_ai_prompt_version(
        '%s'::uuid,
        'x',
        '',
        'system',
        'user',
        '{}'::jsonb,
        '[]'::jsonb,
        '{}'::text[],
        '%s'::uuid
      )
    $$,
    gen_random_uuid(),
    current_setting('test.ai_create_admin_id')
  ),
  '23503',
  'AI prompt family not found',
  'create_ai_prompt_version() should reject a missing family'
);


-- =========================================
-- Family creation RPC permissions
-- =========================================

-- anon 역할이 Family 생성 RPC를 직접 실행할 수 없는지 검증합니다.
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.create_ai_prompt_family_with_initial_version(uuid,text,text,text[],text,text,text,text,jsonb,jsonb,uuid)',
    'EXECUTE'
  ),
  'anon should not execute family creation RPC'
);

-- service_role이 서버 측에서 Family 생성 RPC를 실행할 수 있는지 검증합니다.
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.create_ai_prompt_family_with_initial_version(uuid,text,text,text[],text,text,text,text,jsonb,jsonb,uuid)',
    'EXECUTE'
  ),
  'service_role should execute family creation RPC'
);


-- =========================================
-- Version creation RPC permissions
-- =========================================

-- anon 역할이 Prompt Version 생성 RPC를 직접 실행할 수 없는지 검증합니다.
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.create_ai_prompt_version(uuid,text,text,text,text,jsonb,jsonb,text[],uuid)',
    'EXECUTE'
  ),
  'anon should not execute prompt version creation RPC'
);

-- service_role이 서버 측에서 Prompt Version 생성 RPC를 실행할 수 있는지 검증합니다.
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.create_ai_prompt_version(uuid,text,text,text,text,jsonb,jsonb,text[],uuid)',
    'EXECUTE'
  ),
  'service_role should execute prompt version creation RPC'
);


-- 선언한 assertion 수와 실제 실행 결과를 확인하고 pgTAP 테스트를 종료합니다.
SELECT * FROM finish();

ROLLBACK;