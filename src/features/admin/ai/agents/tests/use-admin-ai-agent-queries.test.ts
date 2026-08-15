import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAiAgentListQuery } from "../types";

const {
  getAdminAiAgentDetailMock,
  getAdminAiAgentOptionsMock,
  getAdminAiAgentsMock,
} = vi.hoisted(() => ({
  getAdminAiAgentDetailMock: vi.fn(),
  getAdminAiAgentOptionsMock: vi.fn(),
  getAdminAiAgentsMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: Symbol("keepPreviousData"),
  useQuery: vi.fn((options: AdminAiAgentQueryOptions) => options),
}));

vi.mock("../queries", () => ({
  getAdminAiAgentDetail: getAdminAiAgentDetailMock,
  getAdminAiAgentOptions: getAdminAiAgentOptionsMock,
  getAdminAiAgents: getAdminAiAgentsMock,
}));

import {
  useAdminAiAgentDetail,
  useAdminAiAgentOptions,
  useAdminAiAgents,
} from "../hooks/use-admin-ai-agent-queries";

/** 테스트에서 검증하는 React Query 옵션의 최소 구조입니다. */
type AdminAiAgentQueryOptions = {
  placeholderData?: unknown;
  queryFn: () => unknown;
  queryKey: readonly unknown[];
  retry?: boolean;
};

/**
 * Agent 목록 조회 조건 fixture를 생성합니다.
 *
 * @returns Agent 목록 조회 조건
 */
function createQuery(): AdminAiAgentListQuery {
  return {
    filters: {},
    page: 1,
    pageSize: 10,
    search: {
      field: "displayName",
      query: "",
    },
    sort: {
      direction: "desc",
      field: "updatedAt",
    },
  };
}

/**
 * 가장 최근 useQuery 호출 옵션을 반환합니다.
 *
 * @returns React Query 호출 옵션
 */
function getLatestUseQueryOptions() {
  const calls = vi.mocked(useQuery).mock.calls;
  const latestCall = calls.at(-1);

  if (!latestCall) {
    throw new Error("useQuery was not called.");
  }

  return latestCall[0] as AdminAiAgentQueryOptions;
}

describe("use-admin-ai-agent-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Agent 목록 조회는 서버 오류 보고가 retry로 중복 기록되지 않도록 retry를 끈다", () => {
    const query = createQuery();

    useAdminAiAgents(query);

    const options = getLatestUseQueryOptions();

    expect(options.retry).toBe(false);
    expect(options.placeholderData).toBe(keepPreviousData);

    options.queryFn();

    expect(getAdminAiAgentsMock).toHaveBeenCalledWith(query);
  });

  it("Agent 상세 조회는 서버 오류 보고가 retry로 중복 기록되지 않도록 retry를 끈다", () => {
    const agentId = "11111111-1111-4111-8111-111111111111";

    useAdminAiAgentDetail(agentId);

    const options = getLatestUseQueryOptions();

    expect(options.retry).toBe(false);

    options.queryFn();

    expect(getAdminAiAgentDetailMock).toHaveBeenCalledWith(agentId);
  });

  it("Agent 선택 목록 조회는 서버 오류 보고가 retry로 중복 기록되지 않도록 retry를 끈다", () => {
    useAdminAiAgentOptions();

    const options = getLatestUseQueryOptions();

    expect(options.retry).toBe(false);

    options.queryFn();

    expect(getAdminAiAgentOptionsMock).toHaveBeenCalledOnce();
  });
});
