import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ADMIN_AI_AGENTS_QUERY_KEY } from "../constants/query-keys";
import {
  getAdminAiAgentDetail,
  getAdminAiAgentOptions,
  getAdminAiAgents,
} from "../queries";
import type { AdminAiAgentListQuery } from "../types";

/**
 * 관리자 AI agent 목록 Query 훅입니다.
 *
 * @param query agent 목록 조회 조건
 * @returns agent 목록 Query 결과
 */
export function useAdminAiAgents(query: AdminAiAgentListQuery) {
  return useQuery({
    queryKey: ADMIN_AI_AGENTS_QUERY_KEY.list(query),
    queryFn: () => getAdminAiAgents(query),
    placeholderData: keepPreviousData,
    // 서버 조회 함수가 운영 오류를 보고한 뒤 throw하므로 React Query retry 시 동일 실패가 중복 기록된다.
    // Agent 조회 실패는 한 번만 보고하도록 이 query에서는 자동 retry를 비활성화한다.
    retry: false,
  });
}

/**
 * 지정한 관리자 AI Agent 상세 정보를 조회합니다.
 *
 * @param agentId 조회할 Agent ID
 * @returns Agent 상세 Query 결과
 */
export function useAdminAiAgentDetail(agentId: string) {
  return useQuery({
    queryKey: ADMIN_AI_AGENTS_QUERY_KEY.detail(agentId),
    queryFn: () => getAdminAiAgentDetail(agentId),
    // 서버 조회 함수가 운영 오류를 보고한 뒤 throw하므로 React Query retry 시 동일 실패가 중복 기록된다.
    // Agent 조회 실패는 한 번만 보고하도록 이 query에서는 자동 retry를 비활성화한다.
    retry: false,
  });
}

/**
 * 관리자 AI prompt family 생성 화면에서 사용할 agent 선택 목록 Query 훅입니다.
 *
 * @returns agent 선택 목록 Query 결과
 */
export function useAdminAiAgentOptions() {
  return useQuery({
    queryKey: ADMIN_AI_AGENTS_QUERY_KEY.options,
    queryFn: getAdminAiAgentOptions,
    // 서버 조회 함수가 운영 오류를 보고한 뒤 throw하므로 React Query retry 시 동일 실패가 중복 기록된다.
    // Agent 조회 실패는 한 번만 보고하도록 이 query에서는 자동 retry를 비활성화한다.
    retry: false,
  });
}
