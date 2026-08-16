import { useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAiSettingListQuery } from "../types/ai-settings-list";

const { getAdminAiSettingDetailMock, getAdminAiSettingsMock } = vi.hoisted(
  () => ({
    getAdminAiSettingDetailMock: vi.fn(),
    getAdminAiSettingsMock: vi.fn(),
  }),
);

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn((options: AdminAiSettingQueryOptions) => options),
}));

vi.mock("../queries", () => ({
  getAdminAiSettingDetail: getAdminAiSettingDetailMock,
  getAdminAiSettings: getAdminAiSettingsMock,
}));

import {
  useAdminAiSettingDetail,
  useAdminAiSettings,
} from "../hooks/use-admin-ai-setting-queries";

/** 테스트에서 검증하는 React Query 옵션의 최소 구조입니다. */
type AdminAiSettingQueryOptions = {
  /** Query 활성화 조건입니다. */
  enabled?: boolean;

  /** 이전 페이지 데이터를 유지하기 위한 placeholder 설정입니다. */
  placeholderData?: unknown;

  /** Query 실행 함수입니다. */
  queryFn: () => unknown;

  /** Query key입니다. */
  queryKey: readonly unknown[];

  /** React Query 자동 재시도 설정입니다. */
  retry?: boolean;
};

/**
 * Settings 목록 조회 조건 fixture를 생성합니다.
 *
 * @returns Settings 목록 조회 조건
 */
function createQuery(): AdminAiSettingListQuery {
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

  return latestCall[0] as AdminAiSettingQueryOptions;
}

describe("use-admin-ai-setting-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AI 설정 목록 조회는 서버 오류 보고가 retry로 중복 기록되지 않도록 retry를 끈다", () => {
    const query = createQuery();

    useAdminAiSettings(query);

    const options = getLatestUseQueryOptions();

    expect(options.retry).toBe(false);

    options.queryFn();

    expect(getAdminAiSettingsMock).toHaveBeenCalledWith(query);
  });

  it("AI 설정 상세 조회는 enabled 조건을 유지하고 retry를 끈다", () => {
    const settingId = "11111111-1111-4111-8111-111111111111";

    useAdminAiSettingDetail(settingId);

    const options = getLatestUseQueryOptions();

    expect(options.enabled).toBe(true);
    expect(options.retry).toBe(false);

    options.queryFn();

    expect(getAdminAiSettingDetailMock).toHaveBeenCalledWith(settingId);
  });

  it("AI 설정 상세 조회는 빈 Setting ID에서 비활성화하고 retry를 끈다", () => {
    useAdminAiSettingDetail("");

    const options = getLatestUseQueryOptions();

    expect(options.enabled).toBe(false);
    expect(options.retry).toBe(false);
  });
});
