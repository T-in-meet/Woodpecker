-- =========================================
-- ai / models
-- =========================================

BEGIN;

-- 이 파일에서 수행할 pgTAP assertion 수가 17개인지 선언합니다.
SELECT plan(16);


-- =========================================
-- Table / columns
-- =========================================

-- ai_model_configs 테이블이 생성되어 있는지 검증합니다.
SELECT has_table(
  'public',
  'ai_model_configs',
  'ai_model_configs table should exist'
);

-- 모델 Provider를 저장하는 provider 컬럼이 존재하는지 검증합니다.
SELECT has_column(
  'public',
  'ai_model_configs',
  'provider',
  'provider column should exist'
);

-- 실제 Provider 모델명을 저장하는 model 컬럼이 존재하는지 검증합니다.
SELECT has_column(
  'public',
  'ai_model_configs',
  'model',
  'model column should exist'
);

-- chat / embedding 용도를 구분하는 capability 컬럼이 존재하는지 검증합니다.
SELECT has_column(
  'public',
  'ai_model_configs',
  'capability',
  'capability column should exist'
);


-- =========================================
-- Constraints
-- =========================================

-- 동일한 provider / model / capability 조합을 중복 저장하지 못하도록
-- UNIQUE constraint가 생성되어 있는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ai_model_configs'::regclass
      AND conname = 'ai_model_configs_provider_model_capability_key'
      AND contype = 'u'
  ),
  'provider/model/capability should be unique'
);

-- 허용하지 않는 capability 값을 저장하면 CHECK constraint가 거부하는지 검증합니다.
SELECT throws_ok(
  $$
    INSERT INTO public.ai_model_configs (
      display_name,
      provider,
      model,
      capability
    )
    VALUES (
      'x',
      'test',
      'model',
      'invalid'
    )
  $$,
  '23514',
  NULL,
  'invalid capability should be rejected'
);

-- embedding 모델에서 dimensions가 누락되면
-- embedding 필수 필드 CHECK constraint가 거부하는지 검증합니다.
SELECT throws_ok(
  $$
    INSERT INTO public.ai_model_configs (
      display_name,
      provider,
      model,
      capability,
      dimensions,
      distance_metric
    )
    VALUES (
      'x',
      'test',
      'embedding-a',
      'embedding',
      NULL,
      'cosine'
    )
  $$,
  '23514',
  NULL,
  'embedding model should require dimensions'
);

-- embedding 모델의 dimensions가 현재 지원하는 1536이 아니면
-- CHECK constraint가 거부하는지 검증합니다.
SELECT throws_ok(
  $$
    INSERT INTO public.ai_model_configs (
      display_name,
      provider,
      model,
      capability,
      dimensions,
      distance_metric
    )
    VALUES (
      'x',
      'test',
      'embedding-b',
      'embedding',
      1024,
      'cosine'
    )
  $$,
  '23514',
  NULL,
  'embedding dimensions should be fixed at 1536'
);


-- =========================================
-- Migration system data
-- =========================================

-- Models migration이 기본 OpenAI embedding 모델을
-- 올바른 dimensions / distance metric으로 생성했는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.ai_model_configs
    WHERE provider = 'openai'
      AND model = 'text-embedding-3-small'
      AND capability = 'embedding'
      AND dimensions = 1536
      AND distance_metric = 'cosine'
  ),
  'default OpenAI embedding model should be seeded'
);

-- Models migration이 기본 OpenAI chat 모델을 생성했는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.ai_model_configs
    WHERE provider = 'openai'
      AND model = 'gpt-4o-mini'
      AND capability = 'chat'
  ),
  'default OpenAI chat model should be seeded'
);

-- =========================================
-- Triggers
-- =========================================

-- 모델 수정 시 updated_at을 갱신하는 trigger가
-- ai_model_configs에 연결되어 있는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.ai_model_configs'::regclass
      AND tgname = 'tr_ai_model_configs_updated_at'
      AND NOT tgisinternal
  ),
  'updated_at trigger should exist'
);


-- =========================================
-- RLS
-- =========================================

-- ai_model_configs 테이블에 Row Level Security가 활성화되어 있는지 검증합니다.
SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.ai_model_configs'::regclass
  ),
  'RLS should be enabled on ai_model_configs'
);


-- =========================================
-- Permissions
-- =========================================

-- anon과 authenticated 역할이 ai_model_configs를 직접 조회할 수 없는지 검증합니다.
SELECT ok(
  NOT has_table_privilege(
    'anon',
    'public.ai_model_configs',
    'SELECT'
  )
  AND NOT has_table_privilege(
    'authenticated',
    'public.ai_model_configs',
    'SELECT'
  ),
  'client roles should not read ai_model_configs'
);

-- service_role은 서버 측 모델 조회를 위해 SELECT 권한을 가지는지 검증합니다.
SELECT ok(
  has_table_privilege(
    'service_role',
    'public.ai_model_configs',
    'SELECT'
  ),
  'service_role should read ai_model_configs'
);


-- =========================================
-- Admin model objects
-- =========================================

-- 관리자 모델 목록 조회에 사용하는 admin_ai_model_list View가
-- 생성되어 있는지 검증합니다.
SELECT ok(
  to_regclass('public.admin_ai_model_list') IS NOT NULL,
  'admin_ai_model_list view should exist'
);

-- 관리자 모델 목록의 검색 / 필터 / 정렬 / 페이지네이션을 담당하는
-- get_admin_ai_model_list() RPC가 정확한 signature로 생성되어 있는지 검증합니다.
SELECT ok(
  to_regprocedure(
    'public.get_admin_ai_model_list(text,text,text[],text[],boolean,integer,integer,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,text,text,integer,integer)'
  ) IS NOT NULL,
  'get_admin_ai_model_list() should exist'
);


-- 선언한 assertion 수와 실제 실행 결과를 확인하고 pgTAP 테스트를 종료합니다.
SELECT * FROM finish();

ROLLBACK;