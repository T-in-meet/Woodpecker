-- =========================================
-- ai / prompt versions
-- =========================================

BEGIN;

-- 이 파일에서 수행할 pgTAP assertion 수가 19개인지 선언합니다.
SELECT plan(19);


-- =========================================
-- Test fixtures
-- =========================================

-- Prompt Version의 created_by FK 검증에 사용할 테스트 사용자 ID를 생성합니다.
SELECT set_config(
  'test.ai_version_user_id',
  gen_random_uuid()::text,
  true
);

-- Prompt Family가 참조할 테스트용 Agent ID를 생성합니다.
SELECT set_config(
  'test.ai_version_agent_id',
  gen_random_uuid()::text,
  true
);

-- Prompt Version이 참조할 테스트용 Family ID를 생성합니다.
SELECT set_config(
  'test.ai_version_family_id',
  gen_random_uuid()::text,
  true
);

-- Published Version 수정 정책 검증에 사용할 Version ID를 생성합니다.
SELECT set_config(
  'test.ai_version_published_id',
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
  current_setting('test.ai_version_user_id')::uuid,
  'ai_version_'
    || current_setting('test.ai_version_user_id')
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
  current_setting('test.ai_version_agent_id')::uuid,
  'Version test agent'
);

-- seed.sql에 의존하지 않도록 Prompt Version이 참조할
-- Family fixture를 테스트 내부에서 직접 생성합니다.
INSERT INTO public.ai_prompt_families (
  id,
  agent_id,
  display_name
)
VALUES (
  current_setting('test.ai_version_family_id')::uuid,
  current_setting('test.ai_version_agent_id')::uuid,
  'Version test family'
);

-- Published Version의 template 보호 및 비-template 수정 허용 정책을
-- 검증하기 위한 테스트 fixture를 생성합니다.
INSERT INTO public.ai_prompt_versions (
  id,
  family_id,
  version_number,
  display_name,
  change_summary,
  lifecycle_status,
  system_template,
  user_template,
  response_schema,
  variables,
  tags,
  created_by_kind,
  created_by
)
VALUES (
  current_setting('test.ai_version_published_id')::uuid,
  current_setting('test.ai_version_family_id')::uuid,
  100,
  'Published test version',
  'initial summary',
  'published',
  'published system template',
  'published user template',
  '{"type":"object"}'::jsonb,
  '["question"]'::jsonb,
  ARRAY['published']::text[],
  'user',
  current_setting('test.ai_version_user_id')::uuid
);


-- =========================================
-- Table / columns
-- =========================================

-- ai_prompt_versions 테이블이 생성되어 있는지 검증합니다.
SELECT has_table(
  'public',
  'ai_prompt_versions',
  'ai_prompt_versions table should exist'
);

-- Prompt Version이 소속 Family를 참조하기 위한 family_id 컬럼이
-- 존재하는지 검증합니다.
SELECT has_column(
  'public',
  'ai_prompt_versions',
  'family_id',
  'family_id column should exist'
);

-- Family 내부에서 Prompt Version 순서를 관리하는 version_number 컬럼이
-- 존재하는지 검증합니다.
SELECT has_column(
  'public',
  'ai_prompt_versions',
  'version_number',
  'version_number column should exist'
);

-- draft / published / archived 상태를 관리하는 lifecycle_status 컬럼이
-- 존재하는지 검증합니다.
SELECT has_column(
  'public',
  'ai_prompt_versions',
  'lifecycle_status',
  'lifecycle_status column should exist'
);


-- =========================================
-- Unique / foreign keys
-- =========================================

-- 동일 Family 안에서 같은 version_number를 중복 저장하지 못하도록
-- UNIQUE constraint가 생성되어 있는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ai_prompt_versions'::regclass
      AND conname = 'ai_prompt_versions_family_version_key'
      AND contype = 'u'
  ),
  'family/version number should be unique'
);

-- ai_prompt_versions.family_id가 ai_prompt_families를 참조하는
-- Foreign Key로 구성되어 있는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ai_prompt_versions'::regclass
      AND conname = 'ai_prompt_versions_family_id_fkey'
      AND contype = 'f'
  ),
  'version family foreign key should exist'
);

-- ai_prompt_versions.created_by가 auth.users를 참조하는
-- Foreign Key로 구성되어 있는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ai_prompt_versions'::regclass
      AND conname = 'ai_prompt_versions_created_by_fkey'
      AND contype = 'f'
  ),
  'version created_by foreign key should exist'
);


-- =========================================
-- Check constraints
-- =========================================

-- version_number는 1 이상의 양수여야 하므로
-- 0을 저장하면 CHECK constraint가 거부하는지 검증합니다.
SELECT throws_ok(
  format(
    $$
      INSERT INTO public.ai_prompt_versions (
        family_id,
        version_number,
        display_name,
        lifecycle_status,
        system_template,
        user_template,
        created_by_kind,
        created_by
      )
      VALUES (
        '%s'::uuid,
        0,
        'v0',
        'draft',
        'system',
        'user',
        'user',
        '%s'::uuid
      )
    $$,
    current_setting('test.ai_version_family_id'),
    current_setting('test.ai_version_user_id')
  ),
  '23514',
  NULL,
  'version_number must be positive'
);

-- response_schema는 JSON object만 허용하므로
-- JSON array를 저장하면 CHECK constraint가 거부하는지 검증합니다.
SELECT throws_ok(
  format(
    $$
      INSERT INTO public.ai_prompt_versions (
        family_id,
        version_number,
        display_name,
        lifecycle_status,
        system_template,
        user_template,
        response_schema,
        created_by_kind,
        created_by
      )
      VALUES (
        '%s'::uuid,
        1,
        'v1',
        'draft',
        'system',
        'user',
        '[]'::jsonb,
        'user',
        '%s'::uuid
      )
    $$,
    current_setting('test.ai_version_family_id'),
    current_setting('test.ai_version_user_id')
  ),
  '23514',
  NULL,
  'response_schema should be a JSON object'
);

-- variables는 JSON array만 허용하므로
-- JSON object를 저장하면 CHECK constraint가 거부하는지 검증합니다.
SELECT throws_ok(
  format(
    $$
      INSERT INTO public.ai_prompt_versions (
        family_id,
        version_number,
        display_name,
        lifecycle_status,
        system_template,
        user_template,
        variables,
        created_by_kind,
        created_by
      )
      VALUES (
        '%s'::uuid,
        1,
        'v1',
        'draft',
        'system',
        'user',
        '{}'::jsonb,
        'user',
        '%s'::uuid
      )
    $$,
    current_setting('test.ai_version_family_id'),
    current_setting('test.ai_version_user_id')
  ),
  '23514',
  NULL,
  'variables should be a JSON array'
);

-- lifecycle_status는 draft / published / archived만 허용하므로
-- 그 외 값을 저장하면 CHECK constraint가 거부하는지 검증합니다.
SELECT throws_ok(
  format(
    $$
      INSERT INTO public.ai_prompt_versions (
        family_id,
        version_number,
        display_name,
        lifecycle_status,
        system_template,
        user_template,
        created_by_kind,
        created_by
      )
      VALUES (
        '%s'::uuid,
        1,
        'v1',
        'invalid',
        'system',
        'user',
        'user',
        '%s'::uuid
      )
    $$,
    current_setting('test.ai_version_family_id'),
    current_setting('test.ai_version_user_id')
  ),
  '23514',
  NULL,
  'invalid lifecycle_status should be rejected'
);

-- created_by_kind가 system인 Version은 사용자 생성자가 없어야 하므로
-- created_by를 함께 저장하면 CHECK constraint가 거부하는지 검증합니다.
SELECT throws_ok(
  format(
    $$
      INSERT INTO public.ai_prompt_versions (
        family_id,
        version_number,
        display_name,
        lifecycle_status,
        system_template,
        user_template,
        created_by_kind,
        created_by
      )
      VALUES (
        '%s'::uuid,
        1,
        'v1',
        'draft',
        'system',
        'user',
        'system',
        '%s'::uuid
      )
    $$,
    current_setting('test.ai_version_family_id'),
    current_setting('test.ai_version_user_id')
  ),
  '23514',
  NULL,
  'system-created version should not have created_by'
);


-- =========================================
-- Published Version update policy
-- =========================================

-- Published Version의 system_template은 immutable이므로
-- 변경하려 하면 보호 trigger가 거부해야 합니다.
SELECT throws_ok(
  format(
    $$
      UPDATE public.ai_prompt_versions
      SET system_template = 'changed system template'
      WHERE id = '%s'::uuid
    $$,
    current_setting('test.ai_version_published_id')
  ),
  '23514',
  'Published AI prompt templates cannot be modified',
  'published system_template should be immutable'
);

-- Published Version의 user_template은 immutable이므로
-- 변경하려 하면 보호 trigger가 거부해야 합니다.
SELECT throws_ok(
  format(
    $$
      UPDATE public.ai_prompt_versions
      SET user_template = 'changed user template'
      WHERE id = '%s'::uuid
    $$,
    current_setting('test.ai_version_published_id')
  ),
  '23514',
  'Published AI prompt templates cannot be modified',
  'published user_template should be immutable'
);

-- Published Version의 비-template 관리 필드는 수정 가능해야 합니다.
SELECT lives_ok(
  format(
    $$
      UPDATE public.ai_prompt_versions
      SET
        display_name = 'Updated published version',
        change_summary = 'updated summary',
        response_schema = '{"type":"object","additionalProperties":false}'::jsonb,
        variables = '["question","context"]'::jsonb,
        tags = ARRAY['published', 'updated']::text[]
      WHERE id = '%s'::uuid
    $$,
    current_setting('test.ai_version_published_id')
  ),
  'published non-template fields should be editable'
);



-- =========================================
-- RLS
-- =========================================

-- ai_prompt_versions 테이블에 Row Level Security가 활성화되어 있는지 검증합니다.
SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.ai_prompt_versions'::regclass
  ),
  'RLS should be enabled on ai_prompt_versions'
);


-- =========================================
-- Permissions
-- =========================================

-- anon과 authenticated 역할이 Prompt Version 테이블을
-- 직접 조회할 수 없는지 검증합니다.
SELECT ok(
  NOT has_table_privilege(
    'anon',
    'public.ai_prompt_versions',
    'SELECT'
  )
  AND NOT has_table_privilege(
    'authenticated',
    'public.ai_prompt_versions',
    'SELECT'
  ),
  'client roles should not read ai_prompt_versions'
);

-- service_role은 서버 측 Prompt Version 조회를 위해
-- SELECT 권한을 가지는지 검증합니다.
SELECT ok(
  has_table_privilege(
    'service_role',
    'public.ai_prompt_versions',
    'SELECT'
  ),
  'service_role should read ai_prompt_versions'
);


-- =========================================
-- Indexes
-- =========================================

-- Family별 lifecycle 상태 기반 Prompt Version 조회 성능을 위한
-- 복합 index가 생성되어 있는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ai_prompt_versions'
      AND indexname = 'ai_prompt_versions_family_status_idx'
  ),
  'version family/status index should exist'
);


-- 선언한 assertion 수와 실제 실행 결과를 확인하고 pgTAP 테스트를 종료합니다.
SELECT * FROM finish();

ROLLBACK;