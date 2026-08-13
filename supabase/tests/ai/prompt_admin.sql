-- =========================================
-- ai / prompt admin views and RPCs
-- =========================================


BEGIN;


-- 이 파일은 Prompt 도입 이후 확장되는 관리자 Agent/Prompt 조회 및 삭제 계약을 검증합니다.
-- Settings 참조에 따른 삭제 보호는 아직 이 단계의 책임이 아니며 후속 Settings migration에서 검증합니다.
SELECT plan(20);



-- =========================================
-- Admin views
-- =========================================


-- 관리자 Agent 목록 View가 Prompt 관리 기능 도입 이후에도 존재하는지 검증합니다.
SELECT ok(
  to_regclass('public.admin_ai_agent_list') IS NOT NULL,
  'admin_ai_agent_list view should exist'
);


-- Prompt Family 관리자 목록 조회를 위한 View가 생성되었는지 검증합니다.
SELECT ok(
  to_regclass('public.admin_ai_prompt_family_list') IS NOT NULL,
  'admin_ai_prompt_family_list view should exist'
);



-- =========================================
-- Admin list RPCs
-- =========================================


-- Agent 목록 RPC가 Prompt Family 수 집계를 포함하는 최종 시그니처로 제공되는지 검증합니다.
SELECT ok(
  to_regprocedure(
    'public.get_admin_ai_agent_list(text,text,integer,integer,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,text,text,integer,integer)'
  ) IS NOT NULL,
  'get_admin_ai_agent_list() should exist'
);


-- Prompt Family 목록 RPC가 관리자 검색/필터/정렬에 필요한 시그니처로 제공되는지 검증합니다.
SELECT ok(
  to_regprocedure(
    'public.get_admin_ai_prompt_family_list(text,text,uuid[],integer,integer,integer,integer,integer,integer,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,text,text,integer,integer)'
  ) IS NOT NULL,
  'get_admin_ai_prompt_family_list() should exist'
);



-- =========================================
-- Agent Prompt Family count
-- =========================================


-- 305의 Agent-only 단계에서는 family_count를 0으로 반환했습니다.
-- Prompt Family가 도입된 306에서는 Agent별 실제 Family 수를 집계해야 합니다.
SELECT set_config(
  'test.ai_admin_count_agent_id',
  gen_random_uuid()::text,
  true
);


SELECT set_config(
  'test.ai_admin_count_family_id_1',
  gen_random_uuid()::text,
  true
);


SELECT set_config(
  'test.ai_admin_count_family_id_2',
  gen_random_uuid()::text,
  true
);


-- 실제 집계 검증을 위해 하나의 Agent에 두 개의 Prompt Family를 연결합니다.
INSERT INTO public.ai_prompt_agents (
  id,
  display_name
)
VALUES (
  current_setting('test.ai_admin_count_agent_id')::uuid,
  'Family count agent'
);


INSERT INTO public.ai_prompt_families (
  id,
  agent_id,
  display_name
)
VALUES
(
  current_setting('test.ai_admin_count_family_id_1')::uuid,
  current_setting('test.ai_admin_count_agent_id')::uuid,
  'Family count one'
),
(
  current_setting('test.ai_admin_count_family_id_2')::uuid,
  current_setting('test.ai_admin_count_agent_id')::uuid,
  'Family count two'
);


-- Agent 목록 View가 고정값이 아니라 실제 연결된 Prompt Family 수를 반환하는지 검증합니다.
SELECT is(
  (
    SELECT family_count
    FROM public.admin_ai_agent_list
    WHERE id = current_setting('test.ai_admin_count_agent_id')::uuid
  ),
  2,
  'admin_ai_agent_list should return the actual prompt family count'
);


-- 관리자 목록 RPC도 View에서 집계한 Prompt Family 수를 JSON 응답에 그대로 전달하는지 검증합니다.
SELECT is(
  (
    SELECT (item ->> 'family_count')::integer
    FROM public.get_admin_ai_agent_list(
      'displayName',
      'Family count agent',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      'displayName',
      'asc',
      1,
      10
    )
    CROSS JOIN LATERAL jsonb_array_elements(items) AS item
    WHERE item ->> 'id'
      = current_setting('test.ai_admin_count_agent_id')
  ),
  2,
  'get_admin_ai_agent_list() should return the actual prompt family count'
);



-- =========================================
-- Admin delete RPCs
-- =========================================


-- Prompt Family와 하위 Version을 함께 정리하는 관리자 삭제 RPC가 존재하는지 검증합니다.
SELECT ok(
  to_regprocedure(
    'public.delete_admin_ai_prompt_family(uuid)'
  ) IS NOT NULL,
  'delete family RPC should exist'
);


-- 305의 Agent-only 삭제 RPC가 Prompt Family/Version까지 처리하도록 재정의되어 있는지
-- 이후 동작 테스트를 수행하기 전에 RPC 존재 여부를 먼저 검증합니다.
SELECT ok(
  to_regprocedure(
    'public.delete_admin_ai_agent(uuid)'
  ) IS NOT NULL,
  'delete agent RPC should exist'
);



-- =========================================
-- Admin view permissions
-- =========================================


-- 관리자 전용 View이므로 anon/authenticated 역할의 직접 SELECT 접근을 차단해야 합니다.
SELECT ok(
  NOT has_table_privilege(
    'anon',
    'public.admin_ai_agent_list',
    'SELECT'
  )
  AND NOT has_table_privilege(
    'authenticated',
    'public.admin_ai_agent_list',
    'SELECT'
  ),
  'client roles should not read admin_ai_agent_list'
);


-- 서버 관리자 조회에 사용하는 service_role에는 Agent 목록 View 읽기 권한이 필요합니다.
SELECT ok(
  has_table_privilege(
    'service_role',
    'public.admin_ai_agent_list',
    'SELECT'
  ),
  'service_role should read admin_ai_agent_list'
);


-- Prompt Family 목록 역시 관리자 전용 데이터이므로 클라이언트 역할의 직접 접근을 차단합니다.
SELECT ok(
  NOT has_table_privilege(
    'anon',
    'public.admin_ai_prompt_family_list',
    'SELECT'
  )
  AND NOT has_table_privilege(
    'authenticated',
    'public.admin_ai_prompt_family_list',
    'SELECT'
  ),
  'client roles should not read admin_ai_prompt_family_list'
);


-- 서버 관리자 조회를 위해 service_role에는 Prompt Family 목록 View 읽기 권한을 허용합니다.
SELECT ok(
  has_table_privilege(
    'service_role',
    'public.admin_ai_prompt_family_list',
    'SELECT'
  ),
  'service_role should read admin_ai_prompt_family_list'
);



-- =========================================
-- Family deletion:
-- unreferenced Published Version
-- =========================================


-- 306에서는 Settings가 아직 도입되지 않았으므로 Settings 참조 여부는 검사하지 않습니다.
-- 외부 참조가 없는 Published Version을 가진 Family는 Version과 함께 삭제할 수 있어야 합니다.
SELECT set_config(
  'test.ai_admin_family_agent_id',
  gen_random_uuid()::text,
  true
);


SELECT set_config(
  'test.ai_admin_family_id',
  gen_random_uuid()::text,
  true
);


SELECT set_config(
  'test.ai_admin_family_version_id',
  gen_random_uuid()::text,
  true
);


-- Family 삭제 fixture의 상위 Agent를 생성합니다.
INSERT INTO public.ai_prompt_agents (
  id,
  display_name
)
VALUES (
  current_setting('test.ai_admin_family_agent_id')::uuid,
  'Family deletion agent'
);


-- 삭제 대상 Prompt Family를 생성합니다.
INSERT INTO public.ai_prompt_families (
  id,
  agent_id,
  display_name
)
VALUES (
  current_setting('test.ai_admin_family_id')::uuid,
  current_setting('test.ai_admin_family_agent_id')::uuid,
  'Deletable family'
);


-- Published 상태 자체는 삭제 금지 사유가 아니며,
-- Settings 등 외부 참조가 없는 경우 Family 삭제와 함께 제거되어야 합니다.
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
  current_setting('test.ai_admin_family_version_id')::uuid,
  current_setting('test.ai_admin_family_id')::uuid,
  1,
  'Published version',
  'published',
  'system',
  'user',
  'system',
  NULL
);


-- 외부 참조가 없는 Family 삭제 요청이 성공하는지 검증합니다.
SELECT is(
  public.delete_admin_ai_prompt_family(
    current_setting('test.ai_admin_family_id')::uuid
  ),
  'OK',
  'family with unreferenced published version should be deletable'
);


-- Family 삭제 RPC가 하위 Prompt Version을 먼저 정리하는지 검증합니다.
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.ai_prompt_versions
    WHERE id = current_setting('test.ai_admin_family_version_id')::uuid
  ),
  'delete family RPC should remove child versions'
);


-- 하위 Version 정리 후 대상 Prompt Family 자체도 삭제되는지 검증합니다.
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.ai_prompt_families
    WHERE id = current_setting('test.ai_admin_family_id')::uuid
  ),
  'delete family RPC should remove the family'
);



-- =========================================
-- Agent deletion:
-- unreferenced Archived Version
-- =========================================


-- Prompt 도입 이후 Agent 삭제는 하위 Version과 Family를 함께 정리해야 합니다.
-- Settings 참조 보호는 후속 Settings migration에서 추가되므로 여기서는 외부 참조 없는 계층 삭제만 검증합니다.
SELECT set_config(
  'test.ai_admin_agent_id',
  gen_random_uuid()::text,
  true
);


SELECT set_config(
  'test.ai_admin_agent_family_id',
  gen_random_uuid()::text,
  true
);


SELECT set_config(
  'test.ai_admin_agent_version_id',
  gen_random_uuid()::text,
  true
);


-- cascade 삭제 검증 대상 Agent를 생성합니다.
INSERT INTO public.ai_prompt_agents (
  id,
  display_name
)
VALUES (
  current_setting('test.ai_admin_agent_id')::uuid,
  'Deletable agent'
);


-- 삭제 대상 Agent에 속한 Prompt Family를 생성합니다.
INSERT INTO public.ai_prompt_families (
  id,
  agent_id,
  display_name
)
VALUES (
  current_setting('test.ai_admin_agent_family_id')::uuid,
  current_setting('test.ai_admin_agent_id')::uuid,
  'Agent deletion family'
);


-- Archived Version도 Agent 삭제 시 하위 데이터로 함께 제거되어야 합니다.
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
  current_setting('test.ai_admin_agent_version_id')::uuid,
  current_setting('test.ai_admin_agent_family_id')::uuid,
  1,
  'Archived version',
  'archived',
  'system',
  'user',
  'system',
  NULL
);


-- Prompt 계층을 가진 Agent의 관리자 삭제 요청이 성공하는지 검증합니다.
SELECT is(
  public.delete_admin_ai_agent(
    current_setting('test.ai_admin_agent_id')::uuid
  ),
  'OK',
  'agent with unreferenced archived version should be deletable'
);


-- Agent 삭제 RPC가 가장 하위의 Prompt Version을 제거하는지 검증합니다.
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.ai_prompt_versions
    WHERE id = current_setting('test.ai_admin_agent_version_id')::uuid
  ),
  'delete agent RPC should remove child versions'
);


-- Prompt Version 정리 후 Agent 소속 Family도 제거되는지 검증합니다.
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.ai_prompt_families
    WHERE id = current_setting('test.ai_admin_agent_family_id')::uuid
  ),
  'delete agent RPC should remove child families'
);


-- 모든 하위 Prompt 데이터 정리 후 대상 Agent 자체가 삭제되는지 검증합니다.
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.ai_prompt_agents
    WHERE id = current_setting('test.ai_admin_agent_id')::uuid
  ),
  'delete agent RPC should remove the agent'
);



-- =========================================
-- Missing Agent
-- =========================================


-- 존재하지 않는 Agent 삭제 요청은 예외 대신 명시적인 NOT_FOUND 결과를 반환해야 합니다.
SELECT is(
  public.delete_admin_ai_agent(
    gen_random_uuid()
  ),
  'NOT_FOUND',
  'delete agent RPC should return NOT_FOUND for missing agent'
);



SELECT * FROM finish();


ROLLBACK;
