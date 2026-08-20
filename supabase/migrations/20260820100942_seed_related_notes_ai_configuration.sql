/*
 * Related Notes AI 기본 구성을 초기화합니다.
 *
 * Related Notes 기능이 개발용 seed 데이터에 의존하지 않고
 * migration만으로 필요한 Agent, Prompt Family, Prompt Version,
 * Runtime Setting 및 Configuration을 구성할 수 있도록 합니다.
 *
 * 기존 seed.sql에 보존되어 있던 Related Notes Prompt Version 이력도
 * 함께 이전하여 현재 published Prompt뿐 아니라 이전 버전도 유지합니다.
 *
 * migration에서 생성되는 Prompt는 특정 auth.users 계정에 의존하지 않도록
 * created_by_kind = 'system', created_by = NULL로 기록합니다.
 */


/*
 * Related Notes에서 사용하는 Prompt Agent를 생성합니다.
 */
INSERT INTO "public"."ai_prompt_agents" (
    "id",
    "display_name",
    "description",
    "purpose",
    "tags",
    "created_at",
    "updated_at"
) VALUES
    (
        'fdca8286-a631-4fe2-8b3e-f81260e7a5a7',
        'Related Notes Answer',
        '관련 노트를 찾아서 답변을 주는 에이전트입니다',
        '관련 노트를 찾아주는 에이전트',
        '{note,relation}',
        '2026-08-11 08:47:32.145808+00',
        '2026-08-11 08:47:32.145808+00'
    ),
    (
        '8543d4a8-a4c3-40b8-b8a4-8c90504afd64',
        '관련 노트 질의 확장 에이전트',
        '노트 생성 수정 시 노트를 이용해서 llm에게 질문을 던지기 위한 에이전트',
        '노트 생성 수정 시 노트를 이용해서 질문을 던지기 위한 에이전트',
        '{note,relation}',
        '2026-08-11 08:54:41.394694+00',
        '2026-08-11 08:54:41.394694+00'
    )
ON CONFLICT DO NOTHING;


/*
 * Related Notes Prompt Version을 관리하는 Prompt Family를 생성합니다.
 */
INSERT INTO "public"."ai_prompt_families" (
    "id",
    "agent_id",
    "display_name",
    "description",
    "tags",
    "created_at",
    "updated_at"
) VALUES
    (
        '2257c284-b42e-4a20-8d16-18534cebca08',
        'fdca8286-a631-4fe2-8b3e-f81260e7a5a7',
        '관련 노트 답변 프롬프트',
        '관련 노트 답변 프롬프트 패밀리',
        '{노트,relation}',
        '2026-08-11 08:50:42.174571+00',
        '2026-08-11 08:50:42.174571+00'
    ),
    (
        'e8dfe0c9-a246-4d1d-9ace-ec2abcd4af1d',
        '8543d4a8-a4c3-40b8-b8a4-8c90504afd64',
        '관련 노트 질의 확장 프롬프트 패밀리',
        '관련 노트 질의 확장을 위한 프롬프트 패밀리',
        '{}',
        '2026-08-11 09:00:48.771748+00',
        '2026-08-11 09:00:48.771748+00'
    )
ON CONFLICT DO NOTHING;


/*
 * Related Notes Answer Prompt v1을 보존합니다.
 *
 * Context index 기반으로 관련 노트를 선택하던 초기 버전입니다.
 * 현재 Runtime에서는 사용하지 않지만 기존 Prompt Version 이력을
 * 보존하기 위해 migration에 함께 포함합니다.
 */
INSERT INTO "public"."ai_prompt_versions" (
    "id",
    "family_id",
    "version_number",
    "display_name",
    "change_summary",
    "lifecycle_status",
    "system_template",
    "user_template",
    "response_schema",
    "variables",
    "tags",
    "created_by_kind",
    "created_by",
    "created_at"
) VALUES (
    'b4c7b67c-43d0-45bd-b022-63aae824d037',
    '2257c284-b42e-4a20-8d16-18534cebca08',
    1,
    '관련 노트 답변',
    '초기 테스트',
    'published',
    '당신은 노트 관련성 분석을 담당하는 AI입니다.

사용자가 현재 작성하거나 수정한 노트와 관련성이 높은 노트를 검색 결과에서 선택해야 합니다.

입력으로 제공되는 question은 현재 노트의 제목과 내용을 기반으로 확장된 관련 노트 검색 질문입니다.
context에는 검색된 노트들이 번호와 함께 제공됩니다.

각 Context를 question과 비교하여 현재 노트와 의미적으로 관련성이 높은 노트를 선택하세요.

선택할 노트가 없으면 빈 배열을 반환하세요.

응답에는 선택한 Context의 번호만 포함해야 합니다.
설명이나 추가 텍스트는 반환하지 마세요.',
    '관련 노트 검색 질문:

{{question}}

검색된 노트:

{{context}}

위 검색 결과에서 현재 노트와 관련성이 높은 노트의 Context 번호를 선택하세요.',
    '{"type": "object", "required": ["usedContextIndexes"], "properties": {"usedContextIndexes": {"type": "array", "items": {"type": "integer", "minimum": 0}}}, "additionalProperties": false}',
    '["question", "context"]',
    '{노트,relation}',
    'system',
    NULL,
    '2026-08-11 08:50:42.174571+00'
)
ON CONFLICT DO NOTHING;


/*
 * Related Notes Query Expansion Prompt v5를 생성합니다.
 *
 * 원본 seed.sql에 보존되어 있던 Query Expansion Prompt Version은
 * v5이며 현재 Runtime Configuration에서도 이 버전을 사용합니다.
 */
INSERT INTO "public"."ai_prompt_versions" (
    "id",
    "family_id",
    "version_number",
    "display_name",
    "change_summary",
    "lifecycle_status",
    "system_template",
    "user_template",
    "response_schema",
    "variables",
    "tags",
    "created_by_kind",
    "created_by",
    "created_at"
) VALUES (
    'c7cd013b-72c1-47a5-9afa-55e8145e6699',
    'e8dfe0c9-a246-4d1d-9ace-ec2abcd4af1d',
    5,
    '관련 노트 질의 확장',
    '질문 수정',
    'published',
    '당신은 학습 노트 간의 관련성을 분석하기 위한 검색 질의를 생성하는 AI입니다.

현재 사용자가 생성하거나 수정한 노트가 주어집니다.

이 노트를 학습할 때 함께 공부하면 이해를 보완하거나 연결해서 학습하기 좋은 다른 노트를 찾기 위한 검색 질의를 하나 생성하세요.

검색 질의는 현재 노트의 핵심 개념, 주제, 기술, 원리, 전제 지식, 밀접하게 연결된 개념 등을 바탕으로 작성하세요.

단순히 현재 노트의 내용을 요약하지 마세요.
특정 사실에 대한 일반적인 답변을 얻기 위한 질문을 만들지 마세요.
현재 노트 자체에 대한 답을 찾는 질문을 만들지 마세요.

목적은 현재 노트와 함께 학습하면 좋은 다른 노트를 찾는 것입니다.

현재 노트에 명시되지 않은 새로운 사실이나 개념을 임의로 추가하지 마세요.

검색 결과에서 현재 노트와 학습적으로 함께 공부하기 좋은 노트를 찾을 수 있도록 하나의 검색 질의만 반환하세요.

응답은 지정된 JSON 형식으로만 반환하세요.',
    '현재 노트 제목:

{{title}}

현재 노트 내용:

{{content}}

위 노트를 바탕으로 관련 노트를 검색하기 위한 질문을 하나 작성하세요.',
    '{"type": "object", "required": ["expandedQuery"], "properties": {"expandedQuery": {"type": "string"}}, "additionalProperties": false}',
    '["title", "content"]',
    '{}',
    'system',
    NULL,
    '2026-08-11 10:27:24.238715+00'
)
ON CONFLICT DO NOTHING;


/*
 * Related Notes Answer Prompt v2를 생성합니다.
 *
 * Context index 기반 추천을 Note ID 기반 추천으로 변경하고,
 * 각 추천에 관련성 판단 이유(reason)를 포함하도록 개선한
 * 현재 Runtime Configuration의 Answer Prompt입니다.
 */
INSERT INTO "public"."ai_prompt_versions" (
    "id",
    "family_id",
    "version_number",
    "display_name",
    "change_summary",
    "lifecycle_status",
    "system_template",
    "user_template",
    "response_schema",
    "variables",
    "tags",
    "created_by_kind",
    "created_by",
    "created_at"
) VALUES (
    'cd32eccd-fc3b-4335-b976-8212c0da3f5f',
    '2257c284-b42e-4a20-8d16-18534cebca08',
    2,
    '관련 노트 답변',
    'Context 번호 기반 추천 방식을 Note ID 기반으로 변경하고, 각 추천에 관련성 판단 이유(reason)를 포함하도록 개선했습니다. 동일 Note의 중복 추천을 방지하고, Context에 존재하는 Note만 추천하도록 제한했으며, reason은 반드시 한국어로 작성하도록 명시했습니다.',
    'published',
    '당신은 노트 관련성 분석을 담당하는 AI입니다.

사용자가 현재 작성하거나 수정한 노트와 관련성이 높은 노트를 검색 결과에서 선택해야 합니다.

입력으로 제공되는 question은 현재 노트의 제목과 내용을 기반으로 확장된 관련 노트 검색 질문입니다.
context에는 검색된 노트들이 Note ID와 함께 제공됩니다.

각 Context를 question과 비교하여 현재 노트와 의미적으로 관련성이 높은 노트를 선택하세요.

같은 Note ID를 가진 여러 Context는 동일한 노트의 서로 다른 chunk입니다.
동일한 Note ID의 노트는 한 번만 선택하세요.

선택한 각 노트에 대해 현재 노트와 관련성이 있다고 판단한 이유를 간결하게 작성하세요.
reason은 반드시 한국어로 작성하세요.

반환하는 noteId는 반드시 context에 제공된 Note ID 중 하나여야 합니다.
context에 없는 Note ID를 생성하거나 추측하지 마세요.

선택할 노트가 없으면 recommendations에 빈 배열을 반환하세요.

응답에는 선택한 노트의 noteId와 reason만 포함해야 합니다.
설명이나 추가 텍스트는 반환하지 마세요.',
    '관련 노트 검색 질문:

{{question}}

검색된 노트:

{{context}}

위 검색 결과에서 현재 노트와 관련성이 높은 노트를 선택하고, 각 노트의 noteId와 추천 이유인 reason을 반환하세요.',
    '{"type": "object", "required": ["recommendations"], "properties": {"recommendations": {"type": "array", "items": {"type": "object", "required": ["noteId", "reason"], "properties": {"noteId": {"type": "string"}, "reason": {"type": "string", "minLength": 1}}, "additionalProperties": false}}}, "additionalProperties": false}',
    '["question", "context"]',
    '{노트,relation}',
    'system',
    NULL,
    '2026-08-20 03:17:13.283751+00'
)
ON CONFLICT DO NOTHING;


/*
 * Related Notes Runtime Setting을 생성합니다.
 */
INSERT INTO "public"."ai_settings" (
    "id",
    "key",
    "display_name",
    "description",
    "created_at",
    "updated_at"
) VALUES (
    'f5af3b5e-d9c7-4608-ab93-433f429cb15f',
    'related-notes',
    '관련 노트',
    '관련 노트를 생성하기 위한 설정입니다',
    '2026-08-11 08:39:52.734967+00',
    '2026-08-11 08:39:52.734967+00'
)
ON CONFLICT DO NOTHING;


/*
 * Related Notes의 Chat Runtime Configuration을 생성합니다.
 *
 * Answer Generation은 현재 Answer Prompt v2를 사용하고,
 * Query Expansion은 현재 Query Expansion Prompt v5를 사용합니다.
 *
 * Note 검색용 Embedding Runtime은 Related Notes 전용 설정을 만들지 않고
 * 공통 Note Retrieval Runtime Configuration을 사용합니다.
 */
INSERT INTO "public"."ai_setting_configurations" (
    "id",
    "setting_id",
    "role_key",
    "kind",
    "model_config_id",
    "prompt_version_id",
    "temperature",
    "sort_order",
    "created_at",
    "updated_at"
) VALUES
    (
        '0a036f90-6afe-4625-8242-b4fb3fc03ee0',
        'f5af3b5e-d9c7-4608-ab93-433f429cb15f',
        'answer-generation',
        'chat',
        (
            SELECT "id"
            FROM "public"."ai_model_configs"
            WHERE "provider" = 'openai'
              AND "model" = 'gpt-4o-mini'
              AND "capability" = 'chat'
        ),
        'cd32eccd-fc3b-4335-b976-8212c0da3f5f',
        0.2,
        1,
        '2026-08-11 10:27:45.881049+00',
        '2026-08-11 10:27:45.881049+00'
    ),
    (
        '3bd387bc-289e-4e50-872c-b0871085ce79',
        'f5af3b5e-d9c7-4608-ab93-433f429cb15f',
        'query-expansion',
        'chat',
        (
            SELECT "id"
            FROM "public"."ai_model_configs"
            WHERE "provider" = 'openai'
              AND "model" = 'gpt-4o-mini'
              AND "capability" = 'chat'
        ),
        'c7cd013b-72c1-47a5-9afa-55e8145e6699',
        0.2,
        2,
        '2026-08-11 10:27:45.881049+00',
        '2026-08-11 10:27:45.881049+00'
    )
ON CONFLICT DO NOTHING;