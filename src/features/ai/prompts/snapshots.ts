import type {
  AiPromptAgent,
  AiPromptFamily,
  AiPromptSnapshot,
  AiPromptVersion,
} from "./types";

/**
 * AI 실행 기록에 저장할 Prompt 설정 snapshot을 생성합니다.
 *
 * 현재 Agent, Family, Prompt Version에서 실행에 필요한 설정과 식별 정보를
 * 새로운 객체로 복사하여 실행 시점의 Prompt 설정을 기록할 수 있도록 합니다.
 *
 * @param params snapshot 생성에 사용할 Agent, Family, Prompt Version입니다.
 * @param params.agent snapshot에 포함할 Prompt Agent입니다.
 * @param params.family snapshot에 포함할 Prompt Family입니다.
 * @param params.version snapshot에 포함할 Prompt Version입니다.
 * @returns AI 실행 기록에 저장할 Prompt snapshot입니다.
 */
export function createAiPromptSnapshot(params: {
  agent: AiPromptAgent;
  family: AiPromptFamily;
  version: AiPromptVersion;
}): AiPromptSnapshot {
  return {
    agentId: params.agent.id,
    familyId: params.family.id,
    promptVersionId: params.version.id,
    versionNumber: params.version.version_number,
    displayName: params.version.display_name,
    lifecycleStatus: params.version.lifecycle_status,
    systemTemplate: params.version.system_template,
    userTemplate: params.version.user_template,
    responseSchema: params.version.response_schema,
    variables: params.version.variables,
    tags: params.version.tags,
  };
}
