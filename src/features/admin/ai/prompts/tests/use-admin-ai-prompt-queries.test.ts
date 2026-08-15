import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAiPromptListQuery } from "../types";

const {
  getAdminAiPromptFamiliesMock,
  getAdminAiPromptFamilyDetailMock,
  getAdminAiPromptFamilyOptionsMock,
  getAdminAiPromptVersionDetailMock,
  getAdminAiPromptVersionOptionsMock,
} = vi.hoisted(() => ({
  getAdminAiPromptFamiliesMock: vi.fn(),
  getAdminAiPromptFamilyDetailMock: vi.fn(),
  getAdminAiPromptFamilyOptionsMock: vi.fn(),
  getAdminAiPromptVersionDetailMock: vi.fn(),
  getAdminAiPromptVersionOptionsMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: Symbol("keepPreviousData"),
  useQuery: vi.fn((options: AdminAiPromptQueryOptions) => options),
}));

vi.mock("../queries", () => ({
  getAdminAiPromptFamilies: getAdminAiPromptFamiliesMock,
  getAdminAiPromptFamilyDetail: getAdminAiPromptFamilyDetailMock,
  getAdminAiPromptFamilyOptions: getAdminAiPromptFamilyOptionsMock,
  getAdminAiPromptVersionDetail: getAdminAiPromptVersionDetailMock,
  getAdminAiPromptVersionOptions: getAdminAiPromptVersionOptionsMock,
}));

import {
  useAdminAiPromptFamilies,
  useAdminAiPromptFamilyDetail,
  useAdminAiPromptFamilyOptions,
  useAdminAiPromptVersionDetail,
  useAdminAiPromptVersionOptions,
} from "../hooks/use-admin-ai-prompt-queries";

/** 테스트에서 검증하는 React Query 옵션의 최소 구조입니다. */
type AdminAiPromptQueryOptions = {
  enabled?: boolean;
  placeholderData?: unknown;
  queryFn: () => unknown;
  queryKey: readonly unknown[];
  retry?: boolean;
};

/**
 * Prompt Family 목록 조회 조건 fixture를 생성합니다.
 *
 * @returns Prompt Family 목록 조회 조건
 */
function createQuery(): AdminAiPromptListQuery {
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

  return latestCall[0] as AdminAiPromptQueryOptions;
}

describe("use-admin-ai-prompt-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Prompt Family 목록 조회는 서버 오류 보고가 retry로 중복 기록되지 않도록 retry를 끈다", () => {
    const query = createQuery();

    useAdminAiPromptFamilies(query);

    const options = getLatestUseQueryOptions();

    expect(options.retry).toBe(false);
    expect(options.placeholderData).toBe(keepPreviousData);

    options.queryFn();

    expect(getAdminAiPromptFamiliesMock).toHaveBeenCalledWith(query);
  });

  it("Prompt Family 상세 조회는 서버 오류 보고가 retry로 중복 기록되지 않도록 retry를 끈다", () => {
    const familyId = "22222222-2222-4222-8222-222222222222";

    useAdminAiPromptFamilyDetail(familyId);

    const options = getLatestUseQueryOptions();

    expect(options.retry).toBe(false);

    options.queryFn();

    expect(getAdminAiPromptFamilyDetailMock).toHaveBeenCalledWith(familyId);
  });

  it("Prompt Version 상세 조회는 서버 오류 보고가 retry로 중복 기록되지 않도록 retry를 끈다", () => {
    const familyId = "22222222-2222-4222-8222-222222222222";
    const versionId = "33333333-3333-4333-8333-333333333333";

    useAdminAiPromptVersionDetail(familyId, versionId);

    const options = getLatestUseQueryOptions();

    expect(options.retry).toBe(false);

    options.queryFn();

    expect(getAdminAiPromptVersionDetailMock).toHaveBeenCalledWith(
      familyId,
      versionId,
    );
  });

  it("Prompt Family 선택 목록 조회는 enabled 조건을 유지하고 retry를 끈다", () => {
    const agentId = "11111111-1111-4111-8111-111111111111";

    useAdminAiPromptFamilyOptions(agentId);

    const options = getLatestUseQueryOptions();

    expect(options.enabled).toBe(true);
    expect(options.retry).toBe(false);

    options.queryFn();

    expect(getAdminAiPromptFamilyOptionsMock).toHaveBeenCalledWith(agentId);
  });

  it("Prompt Family 선택 목록 조회는 빈 Agent ID에서 비활성화한다", () => {
    useAdminAiPromptFamilyOptions("");

    const options = getLatestUseQueryOptions();

    expect(options.enabled).toBe(false);
    expect(options.retry).toBe(false);
  });

  it("Prompt Version 선택 목록 조회는 enabled 조건을 유지하고 retry를 끈다", () => {
    const familyId = "22222222-2222-4222-8222-222222222222";

    useAdminAiPromptVersionOptions(familyId);

    const options = getLatestUseQueryOptions();

    expect(options.enabled).toBe(true);
    expect(options.retry).toBe(false);

    options.queryFn();

    expect(getAdminAiPromptVersionOptionsMock).toHaveBeenCalledWith(familyId);
  });

  it("Prompt Version 선택 목록 조회는 빈 Family ID에서 비활성화한다", () => {
    useAdminAiPromptVersionOptions("");

    const options = getLatestUseQueryOptions();

    expect(options.enabled).toBe(false);
    expect(options.retry).toBe(false);
  });
});
