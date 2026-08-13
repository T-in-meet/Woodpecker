-- =========================================
-- ai / save AI setting configurations
-- =========================================

BEGIN;

-- 이 파일에서 수행할 pgTAP assertion 수가 27개인지 선언합니다.
SELECT plan(27);

-- ============================================================================
-- Fixtures
-- ============================================================================

-- Chat/Embedding 모델, Prompt Agent/Family/Version, AI Setting을
-- seed.sql에 의존하지 않는 독립적인 테스트 fixture로 생성합니다.
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
    '10000000-0000-4000-8000-000000000001',
    'Test Save Config Chat',
    'openai',
    'test-chat-model',
    'chat',
    NULL,
    NULL,
    true,
    'pgTAP fixture'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'test-save-config-embedding',
    'Test Save Config Embedding',
    'openai',
    'embedding',
    1536,
    'cosine',
    true,
    'pgTAP fixture'
  );

-- Chat Configuration에서 사용할 Prompt Agent fixture를 생성합니다.
INSERT INTO public.ai_prompt_agents (
  id,
  display_name,
  description,
  purpose,
  tags
)
VALUES (
  '20000000-0000-4000-8000-000000000001',
  'Test Save Config Agent',
  'pgTAP fixture',
  'Test save_ai_setting_configurations RPC',
  ARRAY['test']
);

-- 테스트 Agent에 속하는 Prompt Family fixture를 생성합니다.
INSERT INTO public.ai_prompt_families (
  id,
  agent_id,
  display_name,
  description,
  tags
)
VALUES (
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Test Save Config Family',
  'pgTAP fixture',
  ARRAY['test']
);

-- Chat Configuration에서 사용할 published Prompt Version fixture를 생성합니다.
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
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  1,
  'Test Save Config Version',
  'pgTAP fixture',
  'published',
  'Test system template',
  'Test user template',
  '{}'::jsonb,
  '[]'::jsonb,
  ARRAY['test'],
  'system',
  NULL
);

-- Published 상태 검증에 사용할 draft Prompt Version fixture를 생성합니다.
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
  '40000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000001',
  2,
  'Test Save Config Draft Version',
  'pgTAP fixture',
  'draft',
  'Test draft system template',
  'Test draft user template',
  '{}'::jsonb,
  '[]'::jsonb,
  ARRAY['test'],
  'system',
  NULL
);

-- Configuration 저장 대상이 될 AI Setting fixture를 생성합니다.
INSERT INTO public.ai_settings (
  id,
  key,
  display_name,
  description,
  updated_at
)
VALUES (
  '50000000-0000-4000-8000-000000000001',
  'test-save-config-setting',
  'Test Save Config Setting',
  'pgTAP fixture',
  '2000-01-01 00:00:00+00'
);

-- ============================================================================
-- Function / permissions
-- ============================================================================

-- 저장 RPC의 존재 여부와 service_role 전용 실행 권한 정책을 검증합니다.
SELECT ok(
  to_regprocedure(
    'public.save_ai_setting_configurations(uuid,jsonb)'
  ) IS NOT NULL,
  'save_ai_setting_configurations RPC가 존재해야 한다'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.save_ai_setting_configurations(uuid,jsonb)',
    'EXECUTE'
  ),
  'service_role은 RPC를 실행할 수 있어야 한다'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.save_ai_setting_configurations(uuid,jsonb)',
    'EXECUTE'
  ),
  'authenticated는 RPC를 직접 실행할 수 없어야 한다'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.save_ai_setting_configurations(uuid,jsonb)',
    'EXECUTE'
  ),
  'anon은 RPC를 직접 실행할 수 없어야 한다'
);

-- ============================================================================
-- Initial save
-- ============================================================================

-- Chat과 Embedding 구성을 한 번에 저장했을 때 각 필드와 sort_order가
-- 입력 순서에 맞게 저장되는지 검증합니다.
SELECT lives_ok(
  $$
    SELECT public.save_ai_setting_configurations(
      '50000000-0000-4000-8000-000000000001'::uuid,
      '[
        {
          "kind": "chat",
          "roleKey": "primary-chat",
          "modelConfigId": "10000000-0000-4000-8000-000000000001",
          "promptVersionId": "40000000-0000-4000-8000-000000000001",
          "temperature": 0.7
        },
        {
          "kind": "embedding",
          "roleKey": "primary-embedding",
          "modelConfigId": "10000000-0000-4000-8000-000000000002"
        }
      ]'::jsonb
    )
  $$,
  'Chat과 Embedding 구성을 함께 저장할 수 있어야 한다'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.ai_setting_configurations
    WHERE setting_id = '50000000-0000-4000-8000-000000000001'
  ),
  2::bigint,
  '두 개의 Configuration이 저장되어야 한다'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.ai_setting_configurations
    WHERE setting_id = '50000000-0000-4000-8000-000000000001'
      AND kind = 'chat'
      AND role_key = 'primary-chat'
      AND sort_order = 0
      AND model_config_id = '10000000-0000-4000-8000-000000000001'
      AND prompt_version_id = '40000000-0000-4000-8000-000000000001'
      AND temperature = 0.7
  ),
  'Chat Configuration이 올바르게 저장되어야 한다'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.ai_setting_configurations
    WHERE setting_id = '50000000-0000-4000-8000-000000000001'
      AND kind = 'embedding'
      AND role_key = 'primary-embedding'
      AND sort_order = 1
      AND model_config_id = '10000000-0000-4000-8000-000000000002'
      AND prompt_version_id IS NULL
      AND temperature IS NULL
  ),
  'Embedding Configuration이 올바르게 저장되어야 한다'
);

-- ============================================================================
-- Replace
-- ============================================================================

-- 전체 폼 상태를 다시 저장하면 기존 Configuration을 교체하고
-- 새 목록 기준으로 sort_order를 재계산하는지 검증합니다.
SELECT lives_ok(
  $$
    SELECT public.save_ai_setting_configurations(
      '50000000-0000-4000-8000-000000000001'::uuid,
      '[
        {
          "kind": "embedding",
          "roleKey": "primary-embedding",
          "modelConfigId": "10000000-0000-4000-8000-000000000002"
        }
      ]'::jsonb
    )
  $$,
  '기존 Configuration을 최종 폼 상태로 교체할 수 있어야 한다'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.ai_setting_configurations
    WHERE setting_id = '50000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  '전체 저장 후 전달한 Configuration만 남아야 한다'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.ai_setting_configurations
    WHERE setting_id = '50000000-0000-4000-8000-000000000001'
      AND kind = 'embedding'
      AND sort_order = 0
  ),
  '전체 교체 후 sort_order는 다시 0부터 저장되어야 한다'
);

-- ============================================================================
-- Atomic rollback
-- ============================================================================

-- 새 Configuration 저장 중 하나라도 실패하면 기존 데이터 삭제까지
-- 같은 트랜잭션에서 롤백되어 이전 상태가 보존되는지 검증합니다.
SELECT throws_ok(
  $$
    SELECT public.save_ai_setting_configurations(
      '50000000-0000-4000-8000-000000000001'::uuid,
      '[
        {
          "kind": "chat",
          "roleKey": "primary-chat",
          "modelConfigId": "10000000-0000-4000-8000-000000000001",
          "promptVersionId": "40000000-0000-4000-8000-000000000001",
          "temperature": 0.5
        },
        {
          "kind": "embedding",
          "roleKey": "primary-embedding",
          "modelConfigId": "99999999-9999-4999-8999-999999999999"
        }
      ]'::jsonb
    )
  $$,
  '23514',
  NULL,
  'INSERT 중 하나가 실패하면 전체 저장이 실패해야 한다'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.ai_setting_configurations
    WHERE setting_id = '50000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  '저장 실패 시 기존 Configuration 개수는 유지되어야 한다'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.ai_setting_configurations
    WHERE setting_id = '50000000-0000-4000-8000-000000000001'
      AND kind = 'embedding'
      AND role_key = 'primary-embedding'
      AND model_config_id = '10000000-0000-4000-8000-000000000002'
  ),
  '저장 실패 시 DELETE 이전의 기존 Configuration이 복구되어야 한다'
);

-- ============================================================================
-- Capability / status validation
-- ============================================================================

-- Chat/Embedding 구성에 맞는 모델 capability와 Published Prompt Version만
-- 사용할 수 있으며 검증 실패 시 기존 구성이 유지되는지 확인합니다.
SELECT throws_ok(
  $$
    SELECT public.save_ai_setting_configurations(
      '50000000-0000-4000-8000-000000000001'::uuid,
      '[
        {
          "kind": "chat",
          "roleKey": "invalid-chat-model",
          "modelConfigId": "10000000-0000-4000-8000-000000000002",
          "promptVersionId": "40000000-0000-4000-8000-000000000001",
          "temperature": 0.5
        }
      ]'::jsonb
    )
  $$,
  '23514',
  NULL,
  'Chat 구성에는 활성 Chat 모델만 사용할 수 있어야 한다'
);

SELECT throws_ok(
  $$
    SELECT public.save_ai_setting_configurations(
      '50000000-0000-4000-8000-000000000001'::uuid,
      '[
        {
          "kind": "embedding",
          "roleKey": "invalid-embedding-model",
          "modelConfigId": "10000000-0000-4000-8000-000000000001"
        }
      ]'::jsonb
    )
  $$,
  '23514',
  NULL,
  'Embedding 구성에는 활성 Embedding 모델만 사용할 수 있어야 한다'
);

SELECT throws_ok(
  $$
    SELECT public.save_ai_setting_configurations(
      '50000000-0000-4000-8000-000000000001'::uuid,
      '[
        {
          "kind": "chat",
          "roleKey": "draft-prompt-version",
          "modelConfigId": "10000000-0000-4000-8000-000000000001",
          "promptVersionId": "40000000-0000-4000-8000-000000000002",
          "temperature": 0.5
        }
      ]'::jsonb
    )
  $$,
  '23514',
  NULL,
  'Chat 구성에는 Published Prompt Version만 사용할 수 있어야 한다'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.ai_setting_configurations
    WHERE setting_id = '50000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'Capability 또는 상태 검증 실패 시 기존 Configuration은 유지되어야 한다'
);

-- ============================================================================
-- Role key validation
-- ============================================================================

-- roleKey의 kebab-case 형식, 필수 입력, 동일 Setting 내 중복 금지 정책과
-- 검증 실패 시 기존 Configuration 보존 여부를 확인합니다.
SELECT throws_ok(
  $$
    SELECT public.save_ai_setting_configurations(
      '50000000-0000-4000-8000-000000000001'::uuid,
      '[
        {
          "kind": "embedding",
          "roleKey": "Invalid Role",
          "modelConfigId": "10000000-0000-4000-8000-000000000002"
        }
      ]'::jsonb
    )
  $$,
  '22023',
  NULL,
  'Configuration roleKey는 kebab-case여야 한다'
);

SELECT throws_ok(
  $$
    SELECT public.save_ai_setting_configurations(
      '50000000-0000-4000-8000-000000000001'::uuid,
      '[
        {
          "kind": "embedding",
          "modelConfigId": "10000000-0000-4000-8000-000000000002"
        }
      ]'::jsonb
    )
  $$,
  '22023',
  NULL,
  'Configuration roleKey가 없으면 실패해야 한다'
);

SELECT throws_ok(
  $$
    SELECT public.save_ai_setting_configurations(
      '50000000-0000-4000-8000-000000000001'::uuid,
      '[
        {
          "kind": "chat",
          "roleKey": "duplicate-role",
          "modelConfigId": "10000000-0000-4000-8000-000000000001",
          "promptVersionId": "40000000-0000-4000-8000-000000000001",
          "temperature": 0.5
        },
        {
          "kind": "embedding",
          "roleKey": "duplicate-role",
          "modelConfigId": "10000000-0000-4000-8000-000000000002"
        }
      ]'::jsonb
    )
  $$,
  '23505',
  NULL,
  '같은 AI 설정 안에서는 roleKey가 중복될 수 없어야 한다'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.ai_setting_configurations
    WHERE setting_id = '50000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'roleKey 검증 실패 시 기존 Configuration은 유지되어야 한다'
);

-- ============================================================================
-- Empty / invalid input
-- ============================================================================

-- 빈 배열은 전체 Configuration 삭제로 처리하고,
-- 존재하지 않는 Setting이나 JSON 배열이 아닌 입력 및 NULL은 거부하는지 검증합니다.
SELECT lives_ok(
  $$
    SELECT public.save_ai_setting_configurations(
      '50000000-0000-4000-8000-000000000001'::uuid,
      '[]'::jsonb
    )
  $$,
  '빈 배열을 저장하면 모든 Configuration을 제거할 수 있어야 한다'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.ai_setting_configurations
    WHERE setting_id = '50000000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  '빈 배열 저장 후 Configuration이 남지 않아야 한다'
);

SELECT throws_ok(
  $$
    SELECT public.save_ai_setting_configurations(
      '59999999-9999-4999-8999-999999999999'::uuid,
      '[]'::jsonb
    )
  $$,
  'P0002',
  NULL,
  '존재하지 않는 AI 설정은 허용하지 않아야 한다'
);

SELECT throws_ok(
  $$
    SELECT public.save_ai_setting_configurations(
      '50000000-0000-4000-8000-000000000001'::uuid,
      '{}'::jsonb
    )
  $$,
  '22023',
  NULL,
  'Configuration 입력은 JSON 배열이어야 한다'
);

SELECT throws_ok(
  $$
    SELECT public.save_ai_setting_configurations(
      '50000000-0000-4000-8000-000000000001'::uuid,
      NULL
    )
  $$,
  '22023',
  NULL,
  'Configuration 입력이 NULL이면 실패해야 한다'
);

-- 선언한 assertion 수와 실제 실행 결과를 확인하고 pgTAP 테스트를 종료합니다.
SELECT * FROM finish();

ROLLBACK;
