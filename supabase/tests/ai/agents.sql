-- =========================================
-- ai / agents
-- =========================================

BEGIN;


-- 이 파일에서 수행할 pgTAP assertion 수가 14개인지 선언합니다.
SELECT plan(14);



-- =========================================
-- Table / columns
-- =========================================


-- ai_prompt_agents 테이블이 생성되어 있는지 검증합니다.
SELECT has_table(
  'public',
  'ai_prompt_agents',
  'ai_prompt_agents table should exist'
);


-- 관리자 화면과 런타임에서 사용하는 Agent 표시 이름 컬럼이 존재하는지 검증합니다.
SELECT has_column(
  'public',
  'ai_prompt_agents',
  'display_name',
  'display_name column should exist'
);



-- =========================================
-- Constraints
-- =========================================


-- 공백만 있는 display_name을 저장하면 CHECK constraint가 거부하는지 검증합니다.
SELECT throws_ok(
  $$
    INSERT INTO public.ai_prompt_agents (
      display_name
    )
    VALUES (
      '   '
    )
  $$,
  '23514',
  NULL,
  'blank agent display_name should be rejected'
);



-- =========================================
-- Test fixtures
-- =========================================


-- Agent 목록 View/RPC 검증에 사용할 일반 Agent fixture를 생성합니다.
INSERT INTO public.ai_prompt_agents (
  id,
  display_name,
  purpose
)
VALUES (
  '61000000-0000-4000-8000-000000000001',
  'Agent SQL test',
  'Agent SQL test purpose'
);


-- 삭제 RPC 검증은 목록 조회 fixture에 영향을 주지 않도록
-- 별도의 Agent를 사용합니다.
INSERT INTO public.ai_prompt_agents (
  id,
  display_name,
  purpose
)
VALUES (
  '61000000-0000-4000-8000-000000000002',
  'Agent delete test',
  'Agent delete test purpose'
);



-- =========================================
-- Triggers
-- =========================================


-- Agent 수정 시 updated_at을 자동 갱신하는 trigger가
-- ai_prompt_agents 테이블에 연결되어 있는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.ai_prompt_agents'::regclass
      AND tgname = 'tr_ai_prompt_agents_updated_at'
      AND NOT tgisinternal
  ),
  'updated_at trigger should exist'
);



-- =========================================
-- RLS
-- =========================================


-- ai_prompt_agents 테이블에 Row Level Security가 활성화되어 있는지 검증합니다.
SELECT ok(
  (
    SELECT relrowsecurity
    FROM pg_class
    WHERE oid = 'public.ai_prompt_agents'::regclass
  ),
  'RLS should be enabled on ai_prompt_agents'
);



-- =========================================
-- Permissions
-- =========================================


-- anon과 authenticated 역할이 Agent 테이블을 직접 조회할 수 없는지 검증합니다.
SELECT ok(
  NOT has_table_privilege(
    'anon',
    'public.ai_prompt_agents',
    'SELECT'
  )
  AND NOT has_table_privilege(
    'authenticated',
    'public.ai_prompt_agents',
    'SELECT'
  ),
  'client roles should not read ai_prompt_agents'
);


-- service_role은 서버 측 Agent 조회를 위해 SELECT 권한을 가지는지 검증합니다.
SELECT ok(
  has_table_privilege(
    'service_role',
    'public.ai_prompt_agents',
    'SELECT'
  ),
  'service_role should read ai_prompt_agents'
);



-- =========================================
-- Indexes
-- =========================================


-- Agent display_name 검색 성능을 위한 trigram index가 존재하는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ai_prompt_agents'
      AND indexname = 'ai_prompt_agents_display_name_trgm_idx'
  ),
  'agent display_name trigram index should exist'
);


-- Agent purpose 검색 성능을 위한 trigram index가 존재하는지 검증합니다.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'ai_prompt_agents'
      AND indexname = 'ai_prompt_agents_purpose_trgm_idx'
  ),
  'agent purpose trigram index should exist'
);



-- =========================================
-- Admin Agent list
-- =========================================


-- 현재 305에서 제공하는 관리자 Agent 목록 View가 생성되어 있는지 검증합니다.
-- Prompt Family 관련 최종 집계 동작은 이후 Prompt migration에서 검증합니다.
SELECT has_view(
  'public',
  'admin_ai_agent_list',
  'admin_ai_agent_list view should exist'
);


-- 현재 Agent-only 단계에서도 관리자 목록 RPC가
-- 저장된 Agent를 정상적으로 조회하는지 검증합니다.
SELECT is(
  (
    SELECT items -> 0 ->> 'display_name'
    FROM public.get_admin_ai_agent_list(
      p_search_field := 'displayName',
      p_search_query := 'Agent SQL test',
      p_family_count_min := NULL,
      p_family_count_max := NULL,
      p_created_from := NULL,
      p_created_to := NULL,
      p_updated_from := NULL,
      p_updated_to := NULL,
      p_sort_field := 'displayName',
      p_sort_direction := 'asc',
      p_page := 1,
      p_page_size := 10
    )
  ),
  'Agent SQL test',
  'agent list RPC should return matching agent'
);



-- =========================================
-- Admin Agent delete
-- =========================================


-- 존재하지 않는 Agent를 삭제하면 NOT_FOUND를 반환하는지 검증합니다.
SELECT is(
  public.delete_admin_ai_agent(
    '61999999-9999-4999-8999-999999999999'::uuid
  ),
  'NOT_FOUND',
  'delete_admin_ai_agent should return NOT_FOUND for missing agent'
);


-- 현재 Agent-only 단계에서 존재하는 Agent는 삭제할 수 있어야 합니다.
-- Prompt Family 참조에 따른 삭제 보호는 Prompt migration에서 검증합니다.
SELECT is(
  public.delete_admin_ai_agent(
    '61000000-0000-4000-8000-000000000002'::uuid
  ),
  'OK',
  'delete_admin_ai_agent should return OK for existing agent'
);


-- 삭제 RPC가 OK를 반환한 뒤 실제 Agent row가 제거되었는지 검증합니다.
SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.ai_prompt_agents
    WHERE id = '61000000-0000-4000-8000-000000000002'::uuid
  ),
  'deleted agent should no longer exist'
);



-- 선언한 assertion 수와 실제 실행 결과를 확인하고 pgTAP 테스트를 종료합니다.
SELECT * FROM finish();


ROLLBACK;