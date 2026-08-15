import type { AdminAiAgentDetail } from "../types";

/** 관리자 AI Agent 폼 값입니다. */
export type AdminAiAgentFormValues = {
  displayName: string;
  purpose: string;
  description: string;
  tags: string;
};

/**
 * Agent 생성 모드 여부를 판별합니다.
 *
 * @param agent Agent 상세
 * @returns 생성 모드면 true
 */
export function isCreateMode(agent: AdminAiAgentDetail | undefined) {
  return agent === undefined;
}

/**
 * Agent 폼 값을 서버 액션용 FormData로 변환합니다.
 *
 * @param values RHF에서 관리하는 폼 값
 * @param agent 수정할 Agent
 * @returns 서버 액션에 전달할 FormData
 */
export function buildAiAgentFormData(
  values: AdminAiAgentFormValues,
  agent?: AdminAiAgentDetail,
) {
  const formData = new FormData();

  if (agent) {
    formData.set("agentId", agent.id);
  }

  formData.set("displayName", values.displayName);
  formData.set("purpose", values.purpose);
  formData.set("description", values.description);
  formData.set("tags", values.tags);

  return formData;
}
