import type { AdminAiPromptListQuery } from "../types";

/** 관리자 AI Prompt Query Key입니다. */
export const ADMIN_AI_PROMPTS_QUERY_KEY = {
  /** 모든 관리자 AI Prompt Query의 최상위 Key */
  all: ["admin-ai-prompts"] as const,

  /**
   * 조회 조건별 Prompt Family 목록 Query Key를 생성합니다.
   *
   * @param query Prompt Family 목록 조회 조건
   * @returns 조회 조건을 포함한 Query Key
   */
  list: (query: AdminAiPromptListQuery) =>
    [...ADMIN_AI_PROMPTS_QUERY_KEY.all, "list", query] as const,

  /**
   * Prompt Family 상세 Query Key를 생성합니다.
   *
   * @param familyId Prompt Family ID
   * @returns Prompt Family 상세 Query Key
   */
  familyDetail: (familyId: string) =>
    [
      ...ADMIN_AI_PROMPTS_QUERY_KEY.all,
      "families",
      familyId,
      "detail",
    ] as const,

  /**
   * Prompt Version 상세 Query Key를 생성합니다.
   *
   * @param familyId Prompt Family ID
   * @param versionId Prompt Version ID
   * @returns Prompt Version 상세 Query Key
   */
  versionDetail: (familyId: string, versionId: string) =>
    [
      ...ADMIN_AI_PROMPTS_QUERY_KEY.all,
      "families",
      familyId,
      "versions",
      versionId,
      "detail",
    ] as const,

  /**
   * Agent별 Prompt Family 선택 항목 Query Key를 생성합니다.
   *
   * @param agentId Prompt Agent ID
   * @returns Agent ID를 포함한 Prompt Family 선택 항목 Query Key
   */
  familyOptions: (agentId: string) =>
    [...ADMIN_AI_PROMPTS_QUERY_KEY.all, "family-options", agentId] as const,

  /**
   * Family별 Prompt Version 선택 항목 Query Key를 생성합니다.
   *
   * @param familyId Prompt Family ID
   * @returns Family ID를 포함한 Prompt Version 선택 항목 Query Key
   */
  versionOptions: (familyId: string) =>
    [...ADMIN_AI_PROMPTS_QUERY_KEY.all, "version-options", familyId] as const,
};
