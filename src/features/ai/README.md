# AI Foundation

AI Foundation은 RAG, 노트 요약, 퀴즈 생성, 자동 태깅, 추천, 관련 노트 제품화가 공통으로 사용할 서버 전용 기반입니다. 이 디렉터리의 코드는 기능 도메인의 orchestration을 담당하지 않습니다.

## Boundaries

- `src/features/ai/*`는 `notes`, `notes-rag`, `admin/experiments/note-relations`를 import하지 않습니다.
- Foundation은 활성 모델이나 Prompt Version을 임의로 선택하지 않습니다. 실제 실행에 사용할 모델과 Prompt Version은 기능별 설정에서 명시적으로 결정합니다.
- Prompt style은 `ai_prompt_families`로 표현합니다. Agent는 여러 Family를 가질 수 있고, 각 Family는 여러 lifecycle 상태의 Version을 가질 수 있습니다.
- 임베딩 생성과 검색은 분리되어 있습니다. `matchAiEmbeddings`는 누락된 임베딩을 자동 생성하지 않습니다.
- `ai_embeddings.source_type/source_id`는 polymorphic reference입니다. FK를 두지 않으므로 source 존재 여부와 소유권 검증은 기능별 retrieval query가 책임집니다.
- v1 embedding 저장소는 `vector(1536)`만 지원합니다. 다른 차원은 별도 migration으로 추가합니다.

## Modules

- `models`: `ai_model_configs.id` 기반 조회와 capability/dimensions/is_active 검증
- `prompts`: Agent/Family/Published Prompt Version 조회, template rendering, prompt snapshot 생성
- `providers`: provider-agnostic wrapper와 OpenAI 구현
- `embeddings`: input/content hash, pgvector literal, cache read/insert, vector search RPC wrapper
- `usage`: normalized token usage 기반 비용 추정
- `errors`: operational-errors 기능을 사용하는 AI 전용 오류 기록 helper

## Admin Operations

- `/admin/ai/models`: 모델 설정을 생성, 조회, 수정, 비활성화, 제한 삭제합니다. `provider`, `model`, `capability`는 생성 후 변경하지 않습니다.
- `/admin/ai/agents`: Prompt Family를 그룹화하는 Agent를 생성, 조회, 수정, 제한 삭제합니다.
- `/admin/ai/prompts`: Prompt Family와 Version을 생성, 조회, 수정, publish, archive, 제한 삭제합니다.
- Prompt Version은 `draft`, `published`, `archived` lifecycle 상태를 가집니다.
- Published Version의 System/User Template은 수정할 수 없으며, 그 외 관리 필드는 수정할 수 있습니다.
- Archived Version은 수정할 수 없습니다.

## Follow-up Feature Flow

후속 RAG 기능은 Foundation 위에서 다음 순서로 구현합니다.

1. 기능 도메인에서 사용자 인증과 source 소유권을 검증합니다.
2. 기능별 입력 문자열을 생성합니다. 예: `rag_note_content`.
3. 필요한 경우 별도 단계에서 임베딩을 생성하고 `ai_embeddings`에 저장합니다.
4. `matchAiEmbeddings`로 후보 source id를 조회합니다.
5. 기능 도메인 테이블을 다시 조회해 source 존재와 소유권을 재검증합니다.
6. 기능별 AI Setting에서 사용할 Agent, Prompt Version, Model 설정을 결정합니다.
7. Published Prompt Version의 Agent/Family 관계를 검증한 뒤 Prompt를 조회합니다.
8. provider wrapper로 답변, 요약, 퀴즈 같은 기능별 결과를 생성합니다.

## Out of Scope

- 사용자 RAG 화면과 `/notes/ask`
- 관련 노트 실험 migration 또는 이전
- 청킹, hybrid search, reranking, 대화 메모리

## Prompt 삭제 정책

Prompt Version의 개별 삭제와 Agent/Family 삭제에 따른 하위 Version 정리는 서로 다른 정책을 적용합니다.

### Version 개별 삭제

- `draft` Version은 삭제할 수 있습니다.
- `archived` Version은 삭제할 수 있습니다.
- `published` Version은 개별 삭제할 수 없습니다.

`published` Version은 배포 이력을 보존하기 위해 개별 삭제를 허용하지 않습니다.
더 이상 사용하지 않는 Published Version은 삭제하지 않고 `archived` 상태로 전환합니다.

### Family 삭제

Family 삭제 시에는 하위 Version의 lifecycle 상태를 개별 Version 삭제 정책과 동일하게 적용하지 않습니다.

Family에 속한 Version 중 하나라도 AI Setting에서 참조 중인 경우 Family를 삭제할 수 없습니다.

그 외에는 Family에 속한 모든 Version을 함께 삭제한 후 Family를 삭제합니다.
이때 `draft`, `published`, `archived` lifecycle 상태는 구분하지 않습니다.

### Agent 삭제

Agent 삭제 역시 하위 Version의 lifecycle 상태와 관계없이 처리합니다.

Agent에 속한 Version 중 하나라도 AI Setting에서 참조 중인 경우 Agent를 삭제할 수 없습니다.

그 외에는 Agent에 속한 모든 Version과 Family를 함께 삭제한 후 Agent를 삭제합니다.

따라서 `published` Version의 개별 삭제는 금지하지만, 삭제 가능한 Family 또는 Agent를 제거하는 과정에서는 해당 Version도 함께 삭제될 수 있습니다.
