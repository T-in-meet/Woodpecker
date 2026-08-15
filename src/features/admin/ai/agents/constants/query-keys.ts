import { AdminAiAgentListQuery } from "../types";

/** 모든 관리자 AI Agent Query의 최상위 Key 값입니다. */
const ADMIN_AI_AGENTS_ALL_QUERY_KEY = ["admin-ai-agents"] as const;

/** 관리자 AI Agent Query Key입니다. */
export const ADMIN_AI_AGENTS_QUERY_KEY = {
  /** 모든 관리자 AI Agent Query의 최상위 Key */
  all: ADMIN_AI_AGENTS_ALL_QUERY_KEY,

  /**
   * 조회 조건별 Agent 목록 Query Key를 생성합니다.
   *
   * @param query Agent 목록 조회 조건
   * @returns 조회 조건을 포함한 Query Key
   */
  list: (query: AdminAiAgentListQuery) =>
    [...ADMIN_AI_AGENTS_QUERY_KEY.all, query] as const,

  /**
   * Agent 상세 Query Key를 생성합니다.
   *
   * @param agentId Agent ID
   * @returns Agent 상세 Query Key
   */
  detail: (agentId: string) =>
    [...ADMIN_AI_AGENTS_QUERY_KEY.all, "detail", agentId] as const,

  /** Agent 선택 목록 Query Key입니다. */
  options: [...ADMIN_AI_AGENTS_ALL_QUERY_KEY, "options"] as const,
};
