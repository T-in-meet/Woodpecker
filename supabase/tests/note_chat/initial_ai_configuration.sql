BEGIN;

SELECT plan(19);

-- ============================================================================
-- Note Chat Agent 초기 구성
-- ============================================================================

-- Note Chat의 질의 확장 Runtime에서 사용할 기본 Agent가 생성되었는지 검증합니다.
SELECT ok(
    EXISTS (
        SELECT 1
        FROM public.ai_prompt_agents
        WHERE display_name = '노트챗봇 질의 확장 에이전트'
    ),
    'Note Chat query expansion agent exists'
);

-- Note Chat의 답변 생성 Runtime에서 사용할 기본 Agent가 생성되었는지 검증합니다.
SELECT ok(
    EXISTS (
        SELECT 1
        FROM public.ai_prompt_agents
        WHERE display_name = '노트챗봇 답변 에이전트'
    ),
    'Note Chat answer agent exists'
);


-- ============================================================================
-- Note Chat Prompt Family 초기 구성
-- ============================================================================

-- 질의 확장 Agent에 초기 Prompt Family가 올바르게 연결되었는지 검증합니다.
SELECT ok(
    EXISTS (
        SELECT 1
        FROM public.ai_prompt_families AS families
        JOIN public.ai_prompt_agents AS agents
          ON agents.id = families.agent_id
        WHERE agents.display_name = '노트챗봇 질의 확장 에이전트'
          AND families.display_name = '노트 챗봇 문맥 기반 질의 확장 프롬프트'
    ),
    'Note Chat query expansion prompt family exists'
);

-- 답변 생성 Agent에 초기 Prompt Family가 올바르게 연결되었는지 검증합니다.
SELECT ok(
    EXISTS (
        SELECT 1
        FROM public.ai_prompt_families AS families
        JOIN public.ai_prompt_agents AS agents
          ON agents.id = families.agent_id
        WHERE agents.display_name = '노트챗봇 답변 에이전트'
          AND families.display_name = '노트 챗봇 답변 프롬프트'
    ),
    'Note Chat answer prompt family exists'
);


-- ============================================================================
-- Note Chat Prompt Version 초기 구성
-- ============================================================================

-- 기존 질의 확장 Prompt 이력을 유지하기 위해 v1, v2가 모두 생성되었는지 검증합니다.
SELECT is(
    (
        SELECT COUNT(*)::integer
        FROM public.ai_prompt_versions AS versions
        JOIN public.ai_prompt_families AS families
          ON families.id = versions.family_id
        JOIN public.ai_prompt_agents AS agents
          ON agents.id = families.agent_id
        WHERE agents.display_name = '노트챗봇 질의 확장 에이전트'
          AND families.display_name = '노트 챗봇 문맥 기반 질의 확장 프롬프트'
    ),
    2,
    'Query expansion prompt has two versions'
);

-- 기존 답변 Prompt 이력을 유지하기 위해 v1, v2, v3가 모두 생성되었는지 검증합니다.
SELECT is(
    (
        SELECT COUNT(*)::integer
        FROM public.ai_prompt_versions AS versions
        JOIN public.ai_prompt_families AS families
          ON families.id = versions.family_id
        JOIN public.ai_prompt_agents AS agents
          ON agents.id = families.agent_id
        WHERE agents.display_name = '노트챗봇 답변 에이전트'
          AND families.display_name = '노트 챗봇 답변 프롬프트'
    ),
    3,
    'Answer prompt has three versions'
);

-- migration에서 생성한 모든 Note Chat Prompt가 특정 사용자 계정에 의존하지 않고
-- system 생성 Prompt로 기록되었는지 검증합니다.
SELECT is(
    (
        SELECT COUNT(*)::integer
        FROM public.ai_prompt_versions AS versions
        JOIN public.ai_prompt_families AS families
          ON families.id = versions.family_id
        JOIN public.ai_prompt_agents AS agents
          ON agents.id = families.agent_id
        WHERE agents.display_name IN (
            '노트챗봇 질의 확장 에이전트',
            '노트챗봇 답변 에이전트'
        )
          AND versions.created_by_kind = 'system'
          AND versions.created_by IS NULL
    ),
    5,
    'All bootstrap Note Chat prompt versions are system-created'
);

-- 현재 Query Expansion Runtime에서 사용하는 질의 확장 Prompt v2가
-- published 상태로 생성되었는지 검증합니다.
SELECT ok(
    EXISTS (
        SELECT 1
        FROM public.ai_prompt_versions AS versions
        JOIN public.ai_prompt_families AS families
          ON families.id = versions.family_id
        JOIN public.ai_prompt_agents AS agents
          ON agents.id = families.agent_id
        WHERE agents.display_name = '노트챗봇 질의 확장 에이전트'
          AND families.display_name = '노트 챗봇 문맥 기반 질의 확장 프롬프트'
          AND versions.version_number = 2
          AND versions.lifecycle_status = 'published'
    ),
    'Query expansion prompt v2 is published'
);

-- 현재 Answer Generation Runtime에서 사용하는 답변 Prompt v3가
-- published 상태로 생성되었는지 검증합니다.
SELECT ok(
    EXISTS (
        SELECT 1
        FROM public.ai_prompt_versions AS versions
        JOIN public.ai_prompt_families AS families
          ON families.id = versions.family_id
        JOIN public.ai_prompt_agents AS agents
          ON agents.id = families.agent_id
        WHERE agents.display_name = '노트챗봇 답변 에이전트'
          AND families.display_name = '노트 챗봇 답변 프롬프트'
          AND versions.version_number = 3
          AND versions.lifecycle_status = 'published'
    ),
    'Answer prompt v3 is published'
);


-- ============================================================================
-- Note Chat Setting 초기 구성
-- ============================================================================

-- Runtime resolver가 조회할 note-chat Setting이 migration에서 생성되었는지 검증합니다.
SELECT ok(
    EXISTS (
        SELECT 1
        FROM public.ai_settings
        WHERE key = 'note-chat'
    ),
    'Note Chat setting exists'
);

-- Note Chat 실행에 필요한 query-expansion, note-retrieval,
-- answer-generation 세 Runtime Role이 모두 구성되었는지 검증합니다.
SELECT is(
    (
        SELECT COUNT(*)::integer
        FROM public.ai_setting_configurations AS configurations
        JOIN public.ai_settings AS settings
          ON settings.id = configurations.setting_id
        WHERE settings.key = 'note-chat'
    ),
    3,
    'Note Chat setting has three runtime configurations'
);


-- ============================================================================
-- Query Expansion Runtime 구성
-- ============================================================================

-- query-expansion Role이 기본 Chat Model인 gpt-4o-mini와
-- 현재 질의 확장 Prompt v2를 사용하도록 연결되었는지 검증합니다.
SELECT ok(
    EXISTS (
        SELECT 1
        FROM public.ai_setting_configurations AS configurations
        JOIN public.ai_settings AS settings
          ON settings.id = configurations.setting_id
        JOIN public.ai_model_configs AS models
          ON models.id = configurations.model_config_id
        JOIN public.ai_prompt_versions AS versions
          ON versions.id = configurations.prompt_version_id
        JOIN public.ai_prompt_families AS families
          ON families.id = versions.family_id
        JOIN public.ai_prompt_agents AS agents
          ON agents.id = families.agent_id
        WHERE settings.key = 'note-chat'
          AND configurations.role_key = 'query-expansion'
          AND configurations.kind = 'chat'
          AND configurations.temperature = 0.2
          AND configurations.sort_order = 0
          AND models.provider = 'openai'
          AND models.model = 'gpt-4o-mini'
          AND models.capability = 'chat'
          AND agents.display_name = '노트챗봇 질의 확장 에이전트'
          AND families.display_name = '노트 챗봇 문맥 기반 질의 확장 프롬프트'
          AND versions.version_number = 2
    ),
    'Query expansion runtime uses gpt-4o-mini and prompt v2'
);


-- ============================================================================
-- Note Retrieval Runtime 구성
-- ============================================================================

-- note-retrieval Role이 Prompt 없이 text-embedding-3-small Embedding Model을
-- 사용하도록 구성되었는지 검증합니다.
SELECT ok(
    EXISTS (
        SELECT 1
        FROM public.ai_setting_configurations AS configurations
        JOIN public.ai_settings AS settings
          ON settings.id = configurations.setting_id
        JOIN public.ai_model_configs AS models
          ON models.id = configurations.model_config_id
        WHERE settings.key = 'note-chat'
          AND configurations.role_key = 'note-retrieval'
          AND configurations.kind = 'embedding'
          AND configurations.prompt_version_id IS NULL
          AND configurations.temperature IS NULL
          AND configurations.sort_order = 1
          AND models.provider = 'openai'
          AND models.model = 'text-embedding-3-small'
          AND models.capability = 'embedding'
    ),
    'Note retrieval runtime uses text-embedding-3-small without prompt'
);


-- ============================================================================
-- Answer Generation Runtime 구성
-- ============================================================================

-- answer-generation Role이 기본 Chat Model인 gpt-4o-mini와
-- 현재 답변 Prompt v3를 사용하도록 연결되었는지 검증합니다.
SELECT ok(
    EXISTS (
        SELECT 1
        FROM public.ai_setting_configurations AS configurations
        JOIN public.ai_settings AS settings
          ON settings.id = configurations.setting_id
        JOIN public.ai_model_configs AS models
          ON models.id = configurations.model_config_id
        JOIN public.ai_prompt_versions AS versions
          ON versions.id = configurations.prompt_version_id
        JOIN public.ai_prompt_families AS families
          ON families.id = versions.family_id
        JOIN public.ai_prompt_agents AS agents
          ON agents.id = families.agent_id
        WHERE settings.key = 'note-chat'
          AND configurations.role_key = 'answer-generation'
          AND configurations.kind = 'chat'
          AND configurations.temperature = 0.2
          AND configurations.sort_order = 2
          AND models.provider = 'openai'
          AND models.model = 'gpt-4o-mini'
          AND models.capability = 'chat'
          AND agents.display_name = '노트챗봇 답변 에이전트'
          AND families.display_name = '노트 챗봇 답변 프롬프트'
          AND versions.version_number = 3
    ),
    'Answer generation runtime uses gpt-4o-mini and prompt v3'
);


-- ============================================================================
-- Runtime Role 유일성
-- ============================================================================

-- query-expansion Role이 중복 없이 하나만 존재하는지 검증합니다.
SELECT is(
    (
        SELECT COUNT(*)::integer
        FROM public.ai_setting_configurations AS configurations
        JOIN public.ai_settings AS settings
          ON settings.id = configurations.setting_id
        WHERE settings.key = 'note-chat'
          AND configurations.role_key = 'query-expansion'
    ),
    1,
    'Note Chat has exactly one query-expansion configuration'
);

-- note-retrieval Role이 중복 없이 하나만 존재하는지 검증합니다.
SELECT is(
    (
        SELECT COUNT(*)::integer
        FROM public.ai_setting_configurations AS configurations
        JOIN public.ai_settings AS settings
          ON settings.id = configurations.setting_id
        WHERE settings.key = 'note-chat'
          AND configurations.role_key = 'note-retrieval'
    ),
    1,
    'Note Chat has exactly one note-retrieval configuration'
);

-- answer-generation Role이 중복 없이 하나만 존재하는지 검증합니다.
SELECT is(
    (
        SELECT COUNT(*)::integer
        FROM public.ai_setting_configurations AS configurations
        JOIN public.ai_settings AS settings
          ON settings.id = configurations.setting_id
        WHERE settings.key = 'note-chat'
          AND configurations.role_key = 'answer-generation'
    ),
    1,
    'Note Chat has exactly one answer-generation configuration'
);


-- ============================================================================
-- Prompt 연결 무결성
-- ============================================================================

-- 모든 Chat Runtime Configuration이 실행에 필요한 Prompt Version을
-- 반드시 참조하는지 검증합니다.
SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM public.ai_setting_configurations AS configurations
        JOIN public.ai_settings AS settings
          ON settings.id = configurations.setting_id
        WHERE settings.key = 'note-chat'
          AND configurations.kind = 'chat'
          AND configurations.prompt_version_id IS NULL
    ),
    'All Note Chat chat configurations have a prompt version'
);

-- Embedding Runtime Configuration에는 불필요한 Prompt Version이
-- 연결되지 않았는지 검증합니다.
SELECT ok(
    NOT EXISTS (
        SELECT 1
        FROM public.ai_setting_configurations AS configurations
        JOIN public.ai_settings AS settings
          ON settings.id = configurations.setting_id
        WHERE settings.key = 'note-chat'
          AND configurations.kind = 'embedding'
          AND configurations.prompt_version_id IS NOT NULL
    ),
    'Note Chat embedding configuration has no prompt version'
);

SELECT * FROM finish();

ROLLBACK;