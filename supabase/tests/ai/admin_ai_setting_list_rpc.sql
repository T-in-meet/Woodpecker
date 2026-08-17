-- =========================================
-- ai / admin AI setting list RPC
-- =========================================

BEGIN;

-- 이 파일에서 수행할 pgTAP assertion 수가 29개인지 선언합니다.
SELECT plan(29);

-- ============================================================================
-- Fixture IDs
-- ============================================================================

-- 각 fixture를 서로 명확히 구분하고 테스트 간 참조에 재사용할 수 있도록
-- 고정 UUID와 검색용 prefix를 세션 설정값에 저장합니다.
SELECT set_config(
  'test.ai_setting_prefix',
  'pgtest-ai-setting-',
  true
);

-- Agent
SELECT set_config(
  'test.ai_setting_agent_alpha_id',
  '91000000-0000-4000-8000-000000000001',
  true
);

SELECT set_config(
  'test.ai_setting_agent_beta_id',
  '91000000-0000-4000-8000-000000000002',
  true
);

-- Prompt Family
SELECT set_config(
  'test.ai_setting_family_alpha_id',
  '92000000-0000-4000-8000-000000000001',
  true
);

SELECT set_config(
  'test.ai_setting_family_beta_id',
  '92000000-0000-4000-8000-000000000002',
  true
);

-- Prompt Version
SELECT set_config(
  'test.ai_setting_version_alpha_id',
  '93000000-0000-4000-8000-000000000001',
  true
);

SELECT set_config(
  'test.ai_setting_version_beta_id',
  '93000000-0000-4000-8000-000000000002',
  true
);

-- Chat Model
SELECT set_config(
  'test.ai_setting_chat_model_alpha_id',
  '94000000-0000-4000-8000-000000000001',
  true
);

SELECT set_config(
  'test.ai_setting_chat_model_beta_id',
  '94000000-0000-4000-8000-000000000002',
  true
);

SELECT set_config(
  'test.ai_setting_chat_model_unused_id',
  '94000000-0000-4000-8000-000000000003',
  true
);

-- Embedding Model
SELECT set_config(
  'test.ai_setting_embedding_model_alpha_id',
  '95000000-0000-4000-8000-000000000001',
  true
);

SELECT set_config(
  'test.ai_setting_embedding_model_beta_id',
  '95000000-0000-4000-8000-000000000002',
  true
);

-- AI Setting
SELECT set_config(
  'test.ai_setting_alpha_id',
  '96000000-0000-4000-8000-000000000001',
  true
);

SELECT set_config(
  'test.ai_setting_beta_id',
  '96000000-0000-4000-8000-000000000002',
  true
);

SELECT set_config(
  'test.ai_setting_gamma_id',
  '96000000-0000-4000-8000-000000000003',
  true
);

-- ============================================================================
-- Prompt Fixture
-- ============================================================================

-- AI Setting의 Chat 구성에서 참조할 Agent, Prompt Family, published Version을
-- seed.sql에 의존하지 않고 테스트 내부 fixture로 생성합니다.
INSERT INTO public.ai_prompt_agents (
  id,
  display_name,
  description,
  purpose,
  tags
)
VALUES
  (
    current_setting('test.ai_setting_agent_alpha_id')::uuid,
    'PGTest Setting Agent Alpha',
    'AI setting list RPC test agent alpha.',
    'AI setting list RPC test.',
    ARRAY['pgtest', 'setting']
  ),
  (
    current_setting('test.ai_setting_agent_beta_id')::uuid,
    'PGTest Setting Agent Beta',
    'AI setting list RPC test agent beta.',
    'AI setting list RPC test.',
    ARRAY['pgtest', 'setting']
  );

INSERT INTO public.ai_prompt_families (
  id,
  agent_id,
  display_name,
  description,
  tags
)
VALUES
  (
    current_setting('test.ai_setting_family_alpha_id')::uuid,
    current_setting('test.ai_setting_agent_alpha_id')::uuid,
    'PGTest Setting Family Alpha',
    'AI setting list RPC test family alpha.',
    ARRAY['pgtest', 'setting']
  ),
  (
    current_setting('test.ai_setting_family_beta_id')::uuid,
    current_setting('test.ai_setting_agent_beta_id')::uuid,
    'PGTest Setting Family Beta',
    'AI setting list RPC test family beta.',
    ARRAY['pgtest', 'setting']
  );

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
VALUES
  (
    current_setting('test.ai_setting_version_alpha_id')::uuid,
    current_setting('test.ai_setting_family_alpha_id')::uuid,
    1,
    'PGTest Setting Version Alpha',
    'Initial test version.',
    'published',
    'Test system prompt alpha.',
    'Test user prompt alpha.',
    '{}'::jsonb,
    '[]'::jsonb,
    ARRAY['pgtest', 'setting'],
    'system',
    NULL
  ),
  (
    current_setting('test.ai_setting_version_beta_id')::uuid,
    current_setting('test.ai_setting_family_beta_id')::uuid,
    1,
    'PGTest Setting Version Beta',
    'Initial test version.',
    'published',
    'Test system prompt beta.',
    'Test user prompt beta.',
    '{}'::jsonb,
    '[]'::jsonb,
    ARRAY['pgtest', 'setting'],
    'system',
    NULL
  );

-- ============================================================================
-- Model Fixture
-- ============================================================================

-- Chat / Embedding 모델 필터와 구성 개수 집계를 검증하기 위한
-- 활성 모델 fixture를 테스트 내부에서 생성합니다.
INSERT INTO public.ai_model_configs (
  id,
  display_name,
  provider,
  model,
  capability,
  dimensions,
  distance_metric,
  is_active,
  notes
)
VALUES
  (
    current_setting('test.ai_setting_chat_model_alpha_id')::uuid,
    'PGTest Chat Model Alpha',
    'test',
    'chat-alpha',
    'chat',
    NULL,
    NULL,
    true,
    'AI setting list RPC test chat model alpha.'
  ),
  (
    current_setting('test.ai_setting_chat_model_beta_id')::uuid,
    'PGTest Chat Model Beta',
    'test',
    'chat-beta',
    'chat',
    NULL,
    NULL,
    true,
    'AI setting list RPC test chat model beta.'
  ),
  (
    current_setting('test.ai_setting_chat_model_unused_id')::uuid,
    'PGTest Chat Model Unused',
    'test',
    'chat-unused',
    'chat',
    NULL,
    NULL,
    true,
    'Unused model for OR filter test.'
  ),
  (
    current_setting('test.ai_setting_embedding_model_alpha_id')::uuid,
    'PGTest Embedding Model Alpha',
    'test',
    'embedding-alpha',
    'embedding',
    1536,
    'cosine',
    true,
    'AI setting list RPC test embedding model alpha.'
  ),
  (
    current_setting('test.ai_setting_embedding_model_beta_id')::uuid,
    'PGTest Embedding Model Beta',
    'test',
    'embedding-beta',
    'embedding',
    1536,
    'cosine',
    true,
    'AI setting list RPC test embedding model beta.'
  );
-- ============================================================================
-- Setting Fixture
--
-- Alpha:
--   Agent: Alpha, Beta
--   Chat: Alpha Model, Beta Model
--   Embedding: Alpha Model
--   Count: Chat 2 / Embedding 1
--
-- Beta:
--   Agent: Alpha
--   Chat: Alpha Model
--   Embedding: Alpha Model, Beta Model
--   Count: Chat 1 / Embedding 2
--
-- Gamma:
--   Configuration 없음
--   Count: Chat 0 / Embedding 0
-- ============================================================================

INSERT INTO public.ai_settings (
  id,
  key,
  display_name,
  description,
  created_at,
  updated_at
)
VALUES
  (
    current_setting('test.ai_setting_alpha_id')::uuid,
    'pgtest-ai-setting-alpha',
    'PGTest Alpha Setting',
    'AI setting list RPC alpha fixture.',
    '2026-08-01 01:00:00+00',
    '2026-08-06 01:00:00+00'
  ),
  (
    current_setting('test.ai_setting_beta_id')::uuid,
    'pgtest-ai-setting-beta',
    'PGTest Beta Setting',
    'AI setting list RPC beta fixture.',
    '2026-08-02 01:00:00+00',
    '2026-08-05 01:00:00+00'
  ),
  (
    current_setting('test.ai_setting_gamma_id')::uuid,
    'pgtest-ai-setting-gamma',
    'PGTest Gamma Setting',
    'AI setting list RPC gamma fixture.',
    '2026-08-03 01:00:00+00',
    '2026-08-04 01:00:00+00'
  );

INSERT INTO public.ai_setting_configurations (
  setting_id,
  role_key,
  kind,
  sort_order,
  model_config_id,
  prompt_version_id,
  temperature
)
VALUES
  -- Alpha: Chat 2
  (
    current_setting('test.ai_setting_alpha_id')::uuid,
    'alpha-chat-primary',
    'chat',
    0,
    current_setting('test.ai_setting_chat_model_alpha_id')::uuid,
    current_setting('test.ai_setting_version_alpha_id')::uuid,
    0.2
  ),
  (
    current_setting('test.ai_setting_alpha_id')::uuid,
    'alpha-chat-secondary',
    'chat',
    1,
    current_setting('test.ai_setting_chat_model_beta_id')::uuid,
    current_setting('test.ai_setting_version_beta_id')::uuid,
    0.4
  ),

  -- Alpha: Embedding 1
  (
    current_setting('test.ai_setting_alpha_id')::uuid,
    'alpha-embedding-primary',
    'embedding',
    2,
    current_setting('test.ai_setting_embedding_model_alpha_id')::uuid,
    NULL,
    NULL
  ),

  -- Beta: Chat 1
  (
    current_setting('test.ai_setting_beta_id')::uuid,
    'beta-chat-primary',
    'chat',
    0,
    current_setting('test.ai_setting_chat_model_alpha_id')::uuid,
    current_setting('test.ai_setting_version_alpha_id')::uuid,
    0.3
  ),

  -- Beta: Embedding 2
  (
    current_setting('test.ai_setting_beta_id')::uuid,
    'beta-embedding-primary',
    'embedding',
    1,
    current_setting('test.ai_setting_embedding_model_alpha_id')::uuid,
    NULL,
    NULL
  ),
  (
    current_setting('test.ai_setting_beta_id')::uuid,
    'beta-embedding-secondary',
    'embedding',
    2,
    current_setting('test.ai_setting_embedding_model_beta_id')::uuid,
    NULL,
    NULL
  );

-- ============================================================================
-- Function permissions
-- ============================================================================

-- 관리자 목록 RPC는 service_role만 실행할 수 있고
-- 일반 클라이언트 역할에서는 직접 실행할 수 없는지 검증합니다.
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.get_admin_ai_setting_list(integer,integer,text,text,uuid[],integer,integer,uuid[],integer,integer,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,text,text)',
    'EXECUTE'
  ),
  'service_role은 관리자 AI 설정 목록 RPC를 실행할 수 있어야 한다'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.get_admin_ai_setting_list(integer,integer,text,text,uuid[],integer,integer,uuid[],integer,integer,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,text,text)',
    'EXECUTE'
  ),
  'authenticated는 관리자 AI 설정 목록 RPC를 직접 실행할 수 없어야 한다'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.get_admin_ai_setting_list(integer,integer,text,text,uuid[],integer,integer,uuid[],integer,integer,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,text,text)',
    'EXECUTE'
  ),
  'anon은 관리자 AI 설정 목록 RPC를 직접 실행할 수 없어야 한다'
);

-- ============================================================================
-- 기본 조회
-- ============================================================================

-- 검색 prefix에 해당하는 테스트 AI Setting 전체 건수와
-- 현재 페이지의 items 개수가 올바르게 반환되는지 검증합니다.
SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := current_setting('test.ai_setting_prefix')
    )
  ),
  3::bigint,
  '테스트 AI 설정 3개를 모두 조회한다'
);

SELECT is(
  (
    SELECT jsonb_array_length(items)
    FROM public.get_admin_ai_setting_list(
      p_page := 1,
      p_page_size := 20,
      p_search_field := 'key',
      p_search_query := current_setting('test.ai_setting_prefix')
    )
  ),
  3,
  '조회 결과 items에 테스트 AI 설정 3개가 포함된다'
);

-- ============================================================================
-- 검색
-- ============================================================================

-- displayName, key, Agent 표시 이름을 기준으로
-- 관리자 AI Setting 목록 검색이 동작하는지 검증합니다.
SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'displayName',
      p_search_query := 'PGTest Alpha Setting'
    )
  ),
  1::bigint,
  '설정 이름으로 검색할 수 있다'
);

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := 'pgtest-ai-setting-beta'
    )
  ),
  1::bigint,
  '설정 key로 검색할 수 있다'
);

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'agent',
      p_search_query := 'PGTest Setting Agent Beta'
    )
  ),
  1::bigint,
  'Agent 표시 이름으로 검색할 수 있다'
);

-- ============================================================================
-- Chat Model 다중 선택
--
-- Alpha는 Beta Chat Model을 사용한다.
-- unused 모델과 함께 전달하므로 OR 조건이어야 Alpha가 조회된다.
-- ============================================================================

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := current_setting('test.ai_setting_prefix'),
      p_chat_model_id_filters := ARRAY[
        current_setting('test.ai_setting_chat_model_beta_id')::uuid,
        current_setting('test.ai_setting_chat_model_unused_id')::uuid
      ]
    )
  ),
  1::bigint,
  'Chat Model 다중 선택 필터는 OR 조건으로 적용된다'
);

-- ============================================================================
-- Embedding Model 다중 선택
--
-- Alpha/Beta 모두 Alpha Embedding Model을 사용한다.
-- Beta만 Beta Embedding Model도 사용한다.
-- 두 모델 선택 시 OR 조건으로 Alpha/Beta 모두 반환되어야 한다.
-- ============================================================================

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := current_setting('test.ai_setting_prefix'),
      p_embedding_model_id_filters := ARRAY[
        current_setting('test.ai_setting_embedding_model_alpha_id')::uuid,
        current_setting('test.ai_setting_embedding_model_beta_id')::uuid
      ]
    )
  ),
  2::bigint,
  'Embedding Model 다중 선택 필터는 OR 조건으로 적용된다'
);

-- ============================================================================
-- Chat 구성 개수 Number Range
-- ============================================================================

-- Setting별 Chat 구성 개수의 최소/최대 범위 필터가
-- 구성 0개인 Setting까지 포함해 올바르게 동작하는지 검증합니다.
SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := current_setting('test.ai_setting_prefix'),
      p_chat_count_min := 2
    )
  ),
  1::bigint,
  'Chat 구성 최소 개수로 필터링할 수 있다'
);

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := current_setting('test.ai_setting_prefix'),
      p_chat_count_max := 1
    )
  ),
  2::bigint,
  'Chat 구성 최대 개수로 필터링할 수 있고 0개 구성도 포함한다'
);

-- ============================================================================
-- Embedding 구성 개수 Number Range
-- ============================================================================

-- Setting별 Embedding 구성 개수의 최소/최대 범위 필터가
-- 구성 0개인 Setting까지 포함해 올바르게 동작하는지 검증합니다.
SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := current_setting('test.ai_setting_prefix'),
      p_embedding_count_min := 2
    )
  ),
  1::bigint,
  'Embedding 구성 최소 개수로 필터링할 수 있다'
);

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := current_setting('test.ai_setting_prefix'),
      p_embedding_count_max := 1
    )
  ),
  2::bigint,
  'Embedding 구성 최대 개수로 필터링할 수 있고 0개 구성도 포함한다'
);

-- ============================================================================
-- Date Range
-- ============================================================================

-- 생성일과 수정일의 시작/종료 범위를 적용했을 때
-- 해당 기간의 Setting만 반환되는지 검증합니다.
SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := current_setting('test.ai_setting_prefix'),
      p_created_from := '2026-08-02 00:00:00+00',
      p_created_to := '2026-08-03 23:59:59+00'
    )
  ),
  2::bigint,
  '생성일 Date Range를 적용할 수 있다'
);

SELECT is(
  (
    SELECT total_count
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := current_setting('test.ai_setting_prefix'),
      p_updated_from := '2026-08-05 00:00:00+00',
      p_updated_to := '2026-08-06 23:59:59+00'
    )
  ),
  2::bigint,
  '수정일 Date Range를 적용할 수 있다'
);

-- ============================================================================
-- 정렬
-- ============================================================================

-- displayName, key, createdAt, updatedAt 기준 정렬과
-- 오름차순/내림차순 방향이 올바르게 적용되는지 검증합니다.
SELECT is(
  (
    SELECT items -> 0 ->> 'displayName'
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := current_setting('test.ai_setting_prefix'),
      p_sort_field := 'displayName',
      p_sort_direction := 'asc'
    )
  ),
  'PGTest Alpha Setting',
  '설정 이름 오름차순 정렬을 지원한다'
);

SELECT is(
  (
    SELECT items -> 0 ->> 'key'
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := current_setting('test.ai_setting_prefix'),
      p_sort_field := 'key',
      p_sort_direction := 'desc'
    )
  ),
  'pgtest-ai-setting-gamma',
  '설정 key 내림차순 정렬을 지원한다'
);

SELECT is(
  (
    SELECT items -> 0 ->> 'key'
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := current_setting('test.ai_setting_prefix'),
      p_sort_field := 'createdAt',
      p_sort_direction := 'desc'
    )
  ),
  'pgtest-ai-setting-gamma',
  '생성일 내림차순 정렬을 지원한다'
);

SELECT is(
  (
    SELECT items -> 0 ->> 'key'
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := current_setting('test.ai_setting_prefix'),
      p_sort_field := 'updatedAt',
      p_sort_direction := 'desc'
    )
  ),
  'pgtest-ai-setting-alpha',
  '수정일 내림차순 정렬을 지원한다'
);

-- ============================================================================
-- Pagination
-- ============================================================================

-- 정렬된 결과에 page/pageSize를 적용했을 때
-- 요청한 페이지의 첫 항목이 정확히 반환되는지 검증합니다.
SELECT is(
  (
    SELECT items -> 0 ->> 'key'
    FROM public.get_admin_ai_setting_list(
      p_page := 2,
      p_page_size := 1,
      p_search_field := 'key',
      p_search_query := current_setting('test.ai_setting_prefix'),
      p_sort_field := 'displayName',
      p_sort_direction := 'asc'
    )
  ),
  'pgtest-ai-setting-beta',
  '페이지네이션은 정렬된 결과에서 올바른 페이지를 반환한다'
);

-- ============================================================================
-- 반환 데이터
-- ============================================================================

-- 목록 응답에 Agent/Chat Model/Embedding Model 목록과
-- Chat/Embedding 구성 개수가 올바르게 집계되어 포함되는지 검증합니다.
SELECT is(
  (
    SELECT jsonb_array_length(items -> 0 -> 'agents')
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := 'pgtest-ai-setting-alpha'
    )
  ),
  2,
  'Chat 구성에서 사용하는 Agent 목록을 반환한다'
);

SELECT is(
  (
    SELECT jsonb_array_length(items -> 0 -> 'chatModels')
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := 'pgtest-ai-setting-alpha'
    )
  ),
  2,
  'Chat Model 목록을 반환한다'
);

SELECT is(
  (
    SELECT jsonb_array_length(items -> 0 -> 'embeddingModels')
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := 'pgtest-ai-setting-alpha'
    )
  ),
  1,
  'Embedding Model 목록을 반환한다'
);

SELECT is(
  (
    SELECT (items -> 0 ->> 'chatConfigurationCount')::integer
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := 'pgtest-ai-setting-alpha'
    )
  ),
  2,
  'Chat 구성 개수를 반환한다'
);

SELECT is(
  (
    SELECT (items -> 0 ->> 'embeddingConfigurationCount')::integer
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'key',
      p_search_query := 'pgtest-ai-setting-beta'
    )
  ),
  2,
  'Embedding 구성 개수를 반환한다'
);

-- ============================================================================
-- 잘못된 입력
-- ============================================================================

-- 허용되지 않은 검색 필드, 정렬 필드, 정렬 방향을 전달하면
-- RPC가 명시적인 오류로 요청을 거부하는지 검증합니다.
SELECT throws_ok(
  $$
    SELECT *
    FROM public.get_admin_ai_setting_list(
      p_search_field := 'invalid'
    )
  $$,
  'P0001',
  'Invalid search field: invalid',
  '허용되지 않은 검색 필드는 실패한다'
);

SELECT throws_ok(
  $$
    SELECT *
    FROM public.get_admin_ai_setting_list(
      p_sort_field := 'invalid'
    )
  $$,
  'P0001',
  'Invalid sort field: invalid',
  '허용되지 않은 정렬 필드는 실패한다'
);

SELECT throws_ok(
  $$
    SELECT *
    FROM public.get_admin_ai_setting_list(
      p_sort_direction := 'invalid'
    )
  $$,
  'P0001',
  'Invalid sort direction: invalid',
  '허용되지 않은 정렬 방향은 실패한다'
);

-- 선언한 assertion 수와 실제 실행 결과를 확인하고 pgTAP 테스트를 종료합니다.
SELECT * FROM finish();

ROLLBACK;
