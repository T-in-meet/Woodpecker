import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAiModelListQuery } from "../types";

const {
  getAdminAiModelDetailMock,
  getAdminAiModelOptionsMock,
  getAdminAiModelsMock,
} = vi.hoisted(() => ({
  getAdminAiModelDetailMock: vi.fn(),
  getAdminAiModelOptionsMock: vi.fn(),
  getAdminAiModelsMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: Symbol("keepPreviousData"),
  useQuery: vi.fn((options: AdminAiModelQueryOptions) => options),
}));

vi.mock("../queries", () => ({
  getAdminAiModelDetail: getAdminAiModelDetailMock,
  getAdminAiModelOptions: getAdminAiModelOptionsMock,
  getAdminAiModels: getAdminAiModelsMock,
}));

import {
  useAdminAiModelDetail,
  useAdminAiModelOptions,
  useAdminAiModels,
} from "../hooks/use-admin-ai-model-queries";

/**
 * 테스트에서 검증하는 React Query 옵션의 최소 구조입니다.
 */
type AdminAiModelQueryOptions = {
  placeholderData?: unknown;
  queryFn: () => unknown;
  queryKey: readonly unknown[];
  retry?: boolean;
};

/**
 * 모델 목록 조회 조건 fixture를 생성합니다.
 *
 * @returns 모델 목록 조회 조건
 */
function createQuery(): AdminAiModelListQuery {
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

  return latestCall[0] as AdminAiModelQueryOptions;
}

describe("use-admin-ai-model-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("모델 목록 조회는 서버 오류 보고가 retry로 중복 기록되지 않도록 retry를 끈다", () => {
    const query = createQuery();

    useAdminAiModels(query);

    const options = getLatestUseQueryOptions();

    expect(options.retry).toBe(false);
    expect(options.placeholderData).toBe(keepPreviousData);

    options.queryFn();

    expect(getAdminAiModelsMock).toHaveBeenCalledWith(query);
  });

  it("모델 상세 조회는 서버 오류 보고가 retry로 중복 기록되지 않도록 retry를 끈다", () => {
    const modelConfigId = "11111111-1111-4111-8111-111111111111";

    useAdminAiModelDetail(modelConfigId);

    const options = getLatestUseQueryOptions();

    expect(options.retry).toBe(false);

    options.queryFn();

    expect(getAdminAiModelDetailMock).toHaveBeenCalledWith(modelConfigId);
  });

  it("모델 선택 목록 조회는 서버 오류 보고가 retry로 중복 기록되지 않도록 retry를 끈다", () => {
    useAdminAiModelOptions("chat");

    const options = getLatestUseQueryOptions();

    expect(options.retry).toBe(false);

    options.queryFn();

    expect(getAdminAiModelOptionsMock).toHaveBeenCalledWith("chat");
  });
});
