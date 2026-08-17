-- =========================================
-- ai / prompt families
-- =========================================

BEGIN;

-- 이 파일에서 수행할 pgTAP assertion 수가 11개인지 선언합니다.
SELECT plan(11);


-- =========================================
-- Test fixture
-- =========================================

-- Prompt Family가 참조할 테스트용 Agent ID를 생성합니다.
SELECT set_config(
  'test.ai_family_agent_id',
  gen_random_uuid()::text,
  true
);

-- seed.sql에 의존하지 않도록 테스트에서 사용할 Agent fixture를 직접 생성합니다.
INSERT INTO public.ai_prompt_agents (
  id,
  display_name
)
VALUES (
  current_setting('test.ai_family_agent_id')::uuid,
  'Family test agent'
);


-- =========================================
-- Table / columns
-- =========================================

-- ai_prompt_families 테이블이 생성되어 있는지 검증합니다.
SELECT has_table(
  'public',
  'ai_prompt_families',
  'ai_prompt_families table should exist'
);

-- Family가 소속 Agent를 참조하기 위한 agent_id 컬럼이 존재하는지 검증합니다.
SELECT has_column(
  'public',
  'ai_prompt_families',
  'agent_id',
  'agent_id column should exist'
);

-- 관리자 화면 등에 표시할 Family 이름 컬럼이 존재하는지 검증합니다.
SELECT has_column(
  'public',
  'ai_prompt_families',
  'display_name',
  'display_name column should exist'
);


-- =========================================
-- Foreign keys / constraints
-- =========================================

-- ai_prompt_families.agent_id가 ai_prompt_agents를 참조하는
-- Foreign Key로 구성되어 있는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ai_prompt_families'::regclass
      AND conname = 'ai_prompt_families_agent_id_fkey'
      AND contype = 'f'
  ),
  'family agent foreign key should exist'
);

-- 공백만 있는 display_name을 저장하면 CHECK constraint가 거부하는지 검증합니다.
SELECT throws_ok(
  format(
    $sql$
      INSERT INTO public.ai_prompt_families (
        agent_id,
        display_name
      )
      VALUES (
        '%s'::uuid,
        '   '
      )
    $sql$,
    current_setting('test.ai_family_agent_id')
  ),
  '23514',
  NULL,
  'blank family display_name should be rejected'
);


-- =========================================
-- Triggers
-- =========================================

-- Prompt Family 수정 시 updated_at을 자동 갱신하는 trigger가
-- ai_prompt_families에 연결되어 있는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.ai_prompt_families'::regclass
      AND tgname = 'tr_ai_prompt_families_updated_at'
      AND NOT tgisinternal
  ),
  'family updated_at trigger should exist'
);

-- =========================================
-- RLS
-- =========================================

-- ai_prompt_families 테이블에 Row Level Security가 활성화되어 있는지 검증합니다.
SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.ai_prompt_families'::regclass
  ),
  'RLS should be enabled on ai_prompt_families'
);


-- =========================================
-- Permissions
-- =========================================

-- anon과 authenticated 역할이 Prompt Family 테이블을
-- 직접 조회할 수 없는지 검증합니다.
SELECT ok(
  NOT has_table_privilege(
    'anon',
    'public.ai_prompt_families',
    'SELECT'
  )
  AND NOT has_table_privilege(
    'authenticated',
    'public.ai_prompt_families',
    'SELECT'
  ),
  'client roles should not read ai_prompt_families'
);

-- service_role은 서버 측 Prompt Family 조회를 위해
-- SELECT 권한을 가지는지 검증합니다.
SELECT ok(
  has_table_privilege(
    'service_role',
    'public.ai_prompt_families',
    'SELECT'
  ),
  'service_role should read ai_prompt_families'
);


-- =========================================
-- Indexes
-- =========================================

-- Agent별 Prompt Family 조회 성능을 위한 agent_id index가
-- 생성되어 있는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ai_prompt_families'
      AND indexname = 'ai_prompt_families_agent_idx'
  ),
  'family agent index should exist'
);

-- Prompt Family display_name 검색 성능을 위한 trigram index가
-- 생성되어 있는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ai_prompt_families'
      AND indexname = 'ai_prompt_families_display_name_trgm_idx'
  ),
  'family display_name trigram index should exist'
);


-- 선언한 assertion 수와 실제 실행 결과를 확인하고 pgTAP 테스트를 종료합니다.
SELECT * FROM finish();

ROLLBACK;