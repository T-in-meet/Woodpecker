import type { AdminAiPromptVersionRow } from "../../types";

/** 관리자 AI Prompt Version 폼 값입니다. */
export type AdminAiPromptVersionFormValues = {
  versionDisplayName: string;
  tags: string;
  changeSummary: string;
  systemTemplate: string;
  userTemplate: string;
  variables: string;
  responseSchema: string;
};

/**
 * JSON 값을 Textarea 기본값으로 직렬화합니다.
 *
 * @param value JSON 값
 * @returns 들여쓰기한 JSON 문자열
 */
export function stringifyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

/**
 * Prompt Version 생성 모드 여부를 판별합니다.
 *
 * @param version Prompt Version
 * @returns 생성 모드면 true
 */
export function isCreateMode(version: AdminAiPromptVersionRow | undefined) {
  return version === undefined;
}

/**
 * Prompt Version 폼 값을 서버 액션용 FormData로 변환합니다.
 *
 * @param values RHF에서 관리하는 폼 값
 * @param familyId Prompt Family ID
 * @param version 수정할 Version
 * @returns 서버 액션에 전달할 FormData
 */
export function buildAiPromptVersionFormData(
  values: AdminAiPromptVersionFormValues,
  familyId: string,
  version?: AdminAiPromptVersionRow,
) {
  const formData = new FormData();

  formData.set("familyId", familyId);

  if (version) {
    formData.set("versionId", version.id);
  }

  formData.set("versionDisplayName", values.versionDisplayName);
  formData.set("tags", values.tags);
  formData.set("changeSummary", values.changeSummary);
  formData.set("systemTemplate", values.systemTemplate);
  formData.set("userTemplate", values.userTemplate);
  formData.set("variables", values.variables);
  formData.set("responseSchema", values.responseSchema);

  return formData;
}
