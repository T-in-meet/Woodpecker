import type { AdminAiPromptFamilyDetail } from "../types";

/** 관리자 AI Prompt Family 폼 값입니다. */
export type AdminAiPromptFamilyFormValues = {
  agentId: string;
  displayName: string;
  description: string;
  tags: string;
  versionDisplayName: string;
  changeSummary: string;
  systemTemplate: string;
  userTemplate: string;
  variables: string;
  responseSchema: string;
};

/**
 * Prompt Family 생성 모드 여부를 판별합니다.
 *
 * @param family Prompt Family 상세
 * @returns 생성 모드면 true
 */
export function isCreateMode(family: AdminAiPromptFamilyDetail | undefined) {
  return family === undefined;
}

/**
 * Prompt Family 폼 값을 서버 액션용 FormData로 변환합니다.
 *
 * 생성 모드에서는 Agent 및 초기 Draft Version 값을 함께 전달하고,
 * 수정 모드에서는 Family 수정에 필요한 값만 전달합니다.
 *
 * @param values RHF에서 관리하는 폼 값
 * @param family 수정할 Prompt Family
 * @returns 서버 액션에 전달할 FormData
 */
export function buildAiPromptFamilyFormData(
  values: AdminAiPromptFamilyFormValues,
  family?: AdminAiPromptFamilyDetail,
) {
  const formData = new FormData();

  if (family) {
    formData.set("familyId", family.id);
  } else {
    formData.set("agentId", values.agentId);
    formData.set("versionDisplayName", values.versionDisplayName);
    formData.set("changeSummary", values.changeSummary);
    formData.set("systemTemplate", values.systemTemplate);
    formData.set("userTemplate", values.userTemplate);
    formData.set("variables", values.variables);
    formData.set("responseSchema", values.responseSchema);
  }

  formData.set("displayName", values.displayName);
  formData.set("description", values.description);
  formData.set("tags", values.tags);

  return formData;
}
