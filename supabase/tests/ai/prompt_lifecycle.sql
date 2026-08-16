-- =========================================
-- ai / prompt lifecycle
-- =========================================

BEGIN;

-- 이 파일에서 수행할 pgTAP assertion 수가 7개인지 선언합니다.
SELECT plan(7);


-- =========================================
-- Test fixtures
-- =========================================

-- Prompt lifecycle 테스트에서 created_by로 사용할 관리자 사용자 ID를 생성합니다.
SELECT set_config(
  'test.ai_lifecycle_admin_id',
  gen_random_uuid()::text,
  true
);

-- lifecycle 대상 Prompt Version을 소유할 Agent ID를 생성합니다.
SELECT set_config(
  'test.ai_lifecycle_agent_id',
  gen_random_uuid()::text,
  true
);

-- lifecycle 대상 Prompt Version이 속할 Family ID를 생성합니다.
SELECT set_config(
  'test.ai_lifecycle_family_id',
  gen_random_uuid()::text,
  true
);

-- lifecycle 상태 전이를 검증할 Prompt Version ID를 생성합니다.
SELECT set_config(
  'test.ai_lifecycle_version_id',
  gen_random_uuid()::text,
  true
);

-- seed.sql에 의존하지 않도록 Prompt Version의 created_by가 참조할
-- 테스트 사용자를 직접 생성합니다.
INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at
)
VALUES (
  current_setting('test.ai_lifecycle_admin_id')::uuid,
  'ai_lifecycle_'
    || current_setting('test.ai_lifecycle_admin_id')
    || '@example.com',
  now()
);

-- lifecycle 대상 Agent fixture를 테스트 내부에서 직접 생성합니다.
INSERT INTO public.ai_prompt_agents (
  id,
  display_name
)
VALUES (
  current_setting('test.ai_lifecycle_agent_id')::uuid,
  'Lifecycle agent'
);

-- Prompt Version이 속할 Family fixture를 테스트 내부에서 직접 생성합니다.
INSERT INTO public.ai_prompt_families (
  id,
  agent_id,
  display_name
)
VALUES (
  current_setting('test.ai_lifecycle_family_id')::uuid,
  current_setting('test.ai_lifecycle_agent_id')::uuid,
  'Lifecycle family'
);

-- lifecycle 상태 전이를 시작할 Draft Prompt Version fixture를 생성합니다.
INSERT INTO public.ai_prompt_versions (
  id,
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
  current_setting('test.ai_lifecycle_version_id')::uuid,
  current_setting('test.ai_lifecycle_family_id')::uuid,
  1,
  'Lifecycle v1',
  'draft',
  'system',
  'user',
  'user',
  current_setting('test.ai_lifecycle_admin_id')::uuid
);


-- =========================================
-- RPC existence
-- =========================================

-- Draft 또는 Archived Prompt Version을 Published로 전환하는
-- publish_ai_prompt_version() RPC가 존재하는지 검증합니다.
SELECT ok(
  to_regprocedure(
    'public.publish_ai_prompt_version(uuid)'
  ) IS NOT NULL,
  'publish RPC should exist'
);

-- Published Prompt Version을 Archived 상태로 전환하는
-- archive_ai_prompt_version() RPC가 존재하는지 검증합니다.
SELECT ok(
  to_regprocedure(
    'public.archive_ai_prompt_version(uuid)'
  ) IS NOT NULL,
  'archive RPC should exist'
);


-- =========================================
-- Publish lifecycle
-- =========================================

-- Draft Prompt Version을 publish하면 성공 결과인 OK를 반환하는지 검증합니다.
SELECT is(
  public.publish_ai_prompt_version(
    current_setting('test.ai_lifecycle_version_id')::uuid
  ),
  'OK',
  'draft version should publish'
);

-- publish RPC 실행 후 실제 lifecycle_status가 published로 변경되는지 검증합니다.
SELECT is(
  (
    SELECT lifecycle_status
    FROM public.ai_prompt_versions
    WHERE id = current_setting('test.ai_lifecycle_version_id')::uuid
  ),
  'published',
  'publish should update lifecycle status'
);


-- =========================================
-- Archive lifecycle
-- =========================================

-- Published Prompt Version을 archive하면 성공 결과인 OK를 반환하는지 검증합니다.
SELECT is(
  public.archive_ai_prompt_version(
    current_setting('test.ai_lifecycle_version_id')::uuid
  ),
  'OK',
  'published version should archive'
);

-- archive RPC 실행 후 실제 lifecycle_status가 archived로 변경되는지 검증합니다.
SELECT is(
  (
    SELECT lifecycle_status
    FROM public.ai_prompt_versions
    WHERE id = current_setting('test.ai_lifecycle_version_id')::uuid
  ),
  'archived',
  'archive should update lifecycle status'
);


-- =========================================
-- Republish lifecycle
-- =========================================

-- Archived Prompt Version을 다시 publish할 수 있고
-- 성공 결과인 OK를 반환하는지 검증합니다.
SELECT is(
  public.publish_ai_prompt_version(
    current_setting('test.ai_lifecycle_version_id')::uuid
  ),
  'OK',
  'archived version should be republishable'
);


-- 선언한 assertion 수와 실제 실행 결과를 확인하고 pgTAP 테스트를 종료합니다.
SELECT * FROM finish();

ROLLBACK;